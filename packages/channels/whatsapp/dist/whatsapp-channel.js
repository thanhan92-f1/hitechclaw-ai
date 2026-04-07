import { WhatsAppApi } from './whatsapp-api.js';
/**
 * WhatsApp channel adapter for HiTechClaw.
 *
 * Uses the official Meta WhatsApp Business Cloud API.
 * Messages are received via webhook (configured in the gateway)
 * and responses are sent via the Cloud API.
 */
export class WhatsAppChannel {
    id = 'whatsapp-channel';
    platform = 'whatsapp';
    name = 'WhatsApp Channel';
    version = '2.0.0';
    api;
    config;
    messageHandler;
    running = false;
    async initialize(config) {
        const phoneNumberId = config.phoneNumberId;
        const accessToken = config.accessToken;
        const verifyToken = config.verifyToken;
        if (!phoneNumberId || !accessToken) {
            throw new Error('WhatsAppChannel: phoneNumberId and accessToken are required');
        }
        this.api = new WhatsAppApi(phoneNumberId, accessToken, config.apiVersion);
        this.config = { phoneNumberId, accessToken, verifyToken, apiVersion: config.apiVersion };
        console.log(`   WhatsApp:   initialized for phone ID ${phoneNumberId}`);
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        console.log('   WhatsApp:   ready for incoming webhooks');
    }
    async stop() {
        this.running = false;
        console.log('   WhatsApp:   stopped');
    }
    async send(message) {
        const chunks = this.splitMessage(message.content, 4096);
        for (const chunk of chunks) {
            await this.api.sendTextMessage(message.channelId, chunk);
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    /**
     * Verify webhook challenge from Meta.
     */
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
            return challenge;
        }
        return null;
    }
    /**
     * Process incoming WhatsApp webhook payload.
     */
    async handleWebhook(payload) {
        if (!this.running || !this.messageHandler)
            return;
        for (const entry of payload.entry) {
            for (const change of entry.changes) {
                const messages = change.value.messages;
                if (!messages)
                    continue;
                for (const msg of messages) {
                    if (msg.type !== 'text' || !msg.text?.body)
                        continue;
                    // Mark as read
                    this.api.markAsRead(msg.id).catch(() => { });
                    const incoming = {
                        platform: 'whatsapp',
                        channelId: msg.from,
                        userId: msg.from,
                        content: msg.text.body,
                        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                        metadata: {
                            messageId: msg.id,
                            phoneNumberId: change.value.metadata.phone_number_id,
                            displayPhone: change.value.metadata.display_phone_number,
                        },
                    };
                    try {
                        await this.messageHandler(incoming);
                    }
                    catch (err) {
                        console.error('WhatsApp handler error:', err instanceof Error ? err.message : err);
                        await this.api.sendTextMessage(msg.from, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.').catch(() => { });
                    }
                }
            }
        }
    }
    getApi() {
        return this.api;
    }
    // ─── Private ────────────────────────────────────────────
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
//# sourceMappingURL=whatsapp-channel.js.map