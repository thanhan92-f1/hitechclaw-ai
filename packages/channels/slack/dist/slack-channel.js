import { SlackApi } from './slack-api.js';
/**
 * Slack channel adapter for HiTechClaw.
 *
 * Uses the Slack Web API with polling for incoming messages.
 * For production use, consider switching to Socket Mode or Events API
 * which require a public webhook endpoint.
 */
export class SlackChannel {
    constructor() {
        this.id = 'slack-channel';
        this.platform = 'slack';
        this.name = 'Slack Channel';
        this.version = '2.0.0';
        this.running = false;
        this.lastTimestamps = new Map();
    }
    async initialize(config) {
        const botToken = config.botToken;
        if (!botToken) {
            throw new Error('SlackChannel: botToken is required');
        }
        this.api = new SlackApi(botToken);
        const auth = await this.api.authTest();
        this.config = {
            botToken,
            appToken: config.appToken,
            signingSecret: config.signingSecret,
            botUserId: auth.user_id,
            pollInterval: config.pollInterval || 2000,
        };
        console.log(`   Slack:      connected as @${auth.user} (team: ${auth.team})`);
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        console.log('   Slack:      ready for incoming messages');
    }
    async stop() {
        this.running = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        console.log('   Slack:      stopped');
    }
    async send(message) {
        const threadTs = message.replyTo;
        const chunks = this.splitMessage(message.content, 4000);
        for (const chunk of chunks) {
            await this.api.postMessage(message.channelId, chunk, threadTs);
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    /**
     * Process an incoming Slack event (called by the gateway webhook handler).
     */
    async handleEvent(event) {
        const msg = event.event;
        if (!msg || msg.type !== 'message' || msg.subtype || msg.bot_id)
            return;
        if (msg.user === this.config.botUserId)
            return;
        const incoming = {
            platform: 'slack',
            channelId: msg.channel,
            userId: msg.user || 'unknown',
            content: this.stripBotMention(msg.text),
            timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
            replyTo: msg.thread_ts,
            metadata: {
                messageTs: msg.ts,
                threadTs: msg.thread_ts,
            },
        };
        if (this.messageHandler) {
            try {
                await this.messageHandler(incoming);
            }
            catch (err) {
                console.error('Slack message handler error:', err instanceof Error ? err.message : err);
                await this.api.postMessage(msg.channel, '❌ Sorry, an error occurred processing your message.', msg.thread_ts || msg.ts).catch(() => { });
            }
        }
    }
    getApi() {
        return this.api;
    }
    // ─── Private ────────────────────────────────────────────
    stripBotMention(text) {
        if (!this.config.botUserId)
            return text;
        return text.replace(new RegExp(`<@${this.config.botUserId}>`, 'g'), '').trim();
    }
    splitMessage(text, maxLen) {
        if (text.length <= maxLen)
            return [text];
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxLen) {
                chunks.push(remaining);
                break;
            }
            let splitIdx = remaining.lastIndexOf('\n', maxLen);
            if (splitIdx <= 0)
                splitIdx = maxLen;
            chunks.push(remaining.slice(0, splitIdx));
            remaining = remaining.slice(splitIdx).replace(/^\n/, '');
        }
        return chunks;
    }
}
