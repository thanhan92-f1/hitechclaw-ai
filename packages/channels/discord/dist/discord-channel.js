import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DISCORD_API = 'https://discord.com/api/v10';
// Discord Gateway opcodes
const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;
/** Minimal Discord REST helper */
async function discordFetch(path, token, options = {}) {
    var _a;
    const res = await fetch(`${DISCORD_API}${path}`, Object.assign(Object.assign({}, options), { headers: Object.assign({ Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, ((_a = options.headers) !== null && _a !== void 0 ? _a : {})) }));
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Discord API ${path} → ${res.status}: ${body}`);
    }
    return res.json();
}
/**
 * Discord channel adapter for HiTechClaw.
 *
 * Uses Discord Gateway WebSocket (v10) for receiving messages and
 * the REST API for sending messages. Supports slash-less text commands.
 */
export class DiscordChannel {
    constructor() {
        this.id = 'discord-channel';
        this.platform = 'discord';
        this.name = 'Discord Channel';
        this.version = '2.0.0';
        this.running = false;
        this.lastSequence = null;
    }
    async initialize(config) {
        const botToken = config.botToken;
        if (!botToken)
            throw new Error('DiscordChannel: botToken is required');
        this.config = {
            botToken,
            guildIds: config.guildIds ? String(config.guildIds).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        };
        // Verify token and get bot user info
        const me = await discordFetch('/users/@me', botToken);
        this.botUserId = me.id;
        console.log(`   Discord:    connected as @${me.username}#${me.discriminator}`);
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        await this.connectGateway();
        console.log('   Discord:    gateway connected, listening for messages');
    }
    async stop() {
        this.running = false;
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch ( /* ignore */_a) { /* ignore */ }
            this.ws = undefined;
        }
        console.log('   Discord:    stopped');
    }
    async send(message) {
        const chunks = this.splitMessage(message.content, 2000);
        for (const chunk of chunks) {
            await discordFetch(`/channels/${message.channelId}/messages`, this.config.botToken, {
                method: 'POST',
                body: JSON.stringify({ content: chunk }),
            });
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    // ─── Gateway ───────────────────────────────────────────────
    async connectGateway() {
        // Get gateway URL
        const gatewayInfo = await discordFetch('/gateway/bot', this.config.botToken);
        const gatewayUrl = `${gatewayInfo.url}?v=10&encoding=json`;
        const { WebSocket } = require('ws');
        this.ws = new WebSocket(gatewayUrl);
        this.ws.on('message', (data) => {
            try {
                const payload = JSON.parse(data.toString());
                this.handleGatewayMessage(payload);
            }
            catch ( /* invalid JSON */_a) { /* invalid JSON */ }
        });
        this.ws.on('close', (code) => {
            if (!this.running)
                return;
            console.warn(`   Discord:    gateway closed (code ${code}), reconnecting in 5s...`);
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = undefined;
            }
            this.reconnectTimer = setTimeout(() => this.connectGateway(), 5000);
        });
        this.ws.on('error', (err) => {
            console.error('   Discord:    gateway error:', err.message);
        });
    }
    handleGatewayMessage(payload) {
        if (payload.s !== null)
            this.lastSequence = payload.s;
        switch (payload.op) {
            case OP_HELLO:
                this.startHeartbeat(payload.d.heartbeat_interval);
                this.identify();
                break;
            case OP_HEARTBEAT:
                this.sendGateway({ op: OP_HEARTBEAT_ACK, d: null });
                break;
            case OP_HEARTBEAT_ACK:
                // Heartbeat acknowledged
                break;
            case OP_DISPATCH:
                this.handleDispatch(payload.t, payload.d);
                break;
        }
    }
    handleDispatch(event, data) {
        switch (event) {
            case 'READY':
                this.sessionId = data.session_id;
                break;
            case 'MESSAGE_CREATE':
                this.handleMessageCreate(data).catch((err) => console.error('Discord message handler error:', err instanceof Error ? err.message : err));
                break;
        }
    }
    async handleMessageCreate(msg) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Ignore bots and our own messages
        if ((_a = msg.author) === null || _a === void 0 ? void 0 : _a.bot)
            return;
        if (((_b = msg.author) === null || _b === void 0 ? void 0 : _b.id) === this.botUserId)
            return;
        // Filter by guild if configured
        if (((_c = this.config.guildIds) === null || _c === void 0 ? void 0 : _c.length) && msg.guild_id && !this.config.guildIds.includes(msg.guild_id))
            return;
        const incoming = {
            platform: 'discord',
            channelId: msg.channel_id,
            userId: (_e = (_d = msg.author) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : 'unknown',
            content: (_f = msg.content) !== null && _f !== void 0 ? _f : '',
            timestamp: new Date(msg.timestamp).toISOString(),
            replyTo: (_g = msg.message_reference) === null || _g === void 0 ? void 0 : _g.message_id,
            metadata: {
                guildId: msg.guild_id,
                messageId: msg.id,
                authorUsername: (_h = msg.author) === null || _h === void 0 ? void 0 : _h.username,
            },
        };
        if (this.messageHandler) {
            await this.messageHandler(incoming);
        }
    }
    identify() {
        this.sendGateway({
            op: OP_IDENTIFY,
            d: {
                token: this.config.botToken,
                intents: 33280, // GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)
                properties: { os: 'linux', browser: 'hitechclaw', device: 'hitechclaw' },
            },
        });
    }
    startHeartbeat(intervalMs) {
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            this.sendGateway({ op: OP_HEARTBEAT, d: this.lastSequence });
        }, intervalMs);
    }
    sendGateway(payload) {
        var _a;
        if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === 1 /* OPEN */) {
            this.ws.send(JSON.stringify(payload));
        }
    }
    splitMessage(text, maxLength) {
        if (text.length <= maxLength)
            return [text];
        const chunks = [];
        let i = 0;
        while (i < text.length) {
            chunks.push(text.slice(i, i + maxLength));
            i += maxLength;
        }
        return chunks;
    }
}
