import { FacebookApi } from './facebook-api.js';
/**
 * Facebook Messenger channel adapter for HiTechClaw.
 * Receives messages from webhook events and replies via Send API.
 */
export class FacebookChannel {
    constructor() {
        this.id = 'facebook-channel';
        this.platform = 'facebook';
        this.name = 'Facebook Messenger Channel';
        this.version = '2.0.0';
        this.running = false;
    }
    async initialize(config) {
        const pageAccessToken = config.pageAccessToken;
        const verifyToken = config.verifyToken;
        if (!pageAccessToken || !verifyToken) {
            throw new Error('FacebookChannel: pageAccessToken and verifyToken are required');
        }
        this.api = new FacebookApi(pageAccessToken);
        this.config = {
            pageAccessToken,
            verifyToken,
            appSecret: config.appSecret,
        };
        try {
            const data = await this.api.getPageInfo();
            console.log(`   Facebook:   connected to page "${String(data.name || 'unknown')}"`);
        }
        catch (_a) {
            console.log('   Facebook:   initialized (could not verify token with page info)');
        }
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        console.log('   Facebook:   ready for incoming webhooks');
    }
    async stop() {
        this.running = false;
        console.log('   Facebook:   stopped');
    }
    async send(message) {
        const chunks = this.splitMessage(message.content, 2000);
        for (const chunk of chunks) {
            await this.api.sendTextMessage(message.channelId, chunk);
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
            return challenge;
        }
        return null;
    }
    async handleWebhook(event) {
        var _a, _b, _c, _d, _e, _f;
        if (!this.running || !this.messageHandler)
            return;
        if (event.object !== 'page')
            return;
        for (const entry of event.entry) {
            for (const messagingEvent of entry.messaging) {
                const senderId = (_a = messagingEvent.sender) === null || _a === void 0 ? void 0 : _a.id;
                const recipientId = (_b = messagingEvent.recipient) === null || _b === void 0 ? void 0 : _b.id;
                if (!senderId || !recipientId)
                    continue;
                const text = ((_c = messagingEvent.message) === null || _c === void 0 ? void 0 : _c.text) || ((_d = messagingEvent.postback) === null || _d === void 0 ? void 0 : _d.payload);
                if (!text)
                    continue;
                const incoming = {
                    platform: 'facebook',
                    channelId: senderId,
                    userId: senderId,
                    content: text,
                    timestamp: new Date(messagingEvent.timestamp).toISOString(),
                    metadata: {
                        recipientId,
                        messageId: (_e = messagingEvent.message) === null || _e === void 0 ? void 0 : _e.mid,
                        postbackTitle: (_f = messagingEvent.postback) === null || _f === void 0 ? void 0 : _f.title,
                    },
                };
                try {
                    await this.messageHandler(incoming);
                }
                catch (err) {
                    console.error('Facebook handler error:', err instanceof Error ? err.message : err);
                    await this.api.sendTextMessage(senderId, 'Xin loi, co loi xay ra khi xu ly tin nhan.').catch(() => { });
                }
            }
        }
    }
    getApi() {
        return this.api;
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
