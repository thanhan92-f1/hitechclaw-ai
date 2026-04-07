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
    const res = await fetch(`${DISCORD_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    });
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
    id = 'discord-channel';
    platform = 'discord';
    name = 'Discord Channel';
    version = '2.0.0';
    config;
    messageHandler;
    running = false;
    ws; // ws.WebSocket
    heartbeatInterval;
    sessionId;
    lastSequence = null;
    botUserId;
    reconnectTimer;
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
            catch { /* ignore */ }
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
            catch { /* invalid JSON */ }
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
        // Ignore bots and our own messages
        if (msg.author?.bot)
            return;
        if (msg.author?.id === this.botUserId)
            return;
        // Filter by guild if configured
        if (this.config.guildIds?.length && msg.guild_id && !this.config.guildIds.includes(msg.guild_id))
            return;
        const incoming = {
            platform: 'discord',
            channelId: msg.channel_id,
            userId: msg.author?.id ?? 'unknown',
            content: msg.content ?? '',
            timestamp: new Date(msg.timestamp).toISOString(),
            replyTo: msg.message_reference?.message_id,
            metadata: {
                guildId: msg.guild_id,
                messageId: msg.id,
                authorUsername: msg.author?.username,
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
        if (this.ws?.readyState === 1 /* OPEN */) {
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
//# sourceMappingURL=discord-channel.js.map