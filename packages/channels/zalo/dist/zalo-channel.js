import { ZaloApi } from './zalo-api.js';
/**
 * Zalo OA channel adapter for HiTechClaw.
 *
 * Uses the Zalo Official Account Open API v3.
 * Messages arrive via webhook and responses are sent via the OA API.
 * Specially designed for Vietnamese enterprise market.
 */
export class ZaloChannel {
    constructor() {
        this.id = 'zalo-channel';
        this.platform = 'zalo';
        this.name = 'Zalo Channel';
        this.version = '2.0.0';
        this.running = false;
    }
    async initialize(config) {
        const oaId = config.oaId;
        const appId = config.appId;
        const accessToken = config.accessToken;
        if (!oaId || !appId) {
            throw new Error('ZaloChannel: oaId and appId are required');
        }
        this.config = {
            oaId,
            appId,
            accessToken: accessToken || undefined,
            secretKey: config.secretKey,
        };
        // Only create API client if accessToken is available
        if (accessToken) {
            this.api = new ZaloApi(accessToken);
            try {
                const info = await this.api.getOAInfo();
                const data = info.data;
                console.log(`   Zalo:       connected to OA "${(data === null || data === void 0 ? void 0 : data.name) || oaId}"`);
            }
            catch (_a) {
                console.log(`   Zalo:       initialized for OA ${oaId} (could not verify token)`);
            }
        }
        else {
            console.log(`   Zalo:       webhook mode for OA ${oaId} (App: ${appId}) — no access token, receive-only`);
        }
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        console.log('   Zalo:       ready for incoming webhooks');
    }
    async stop() {
        this.running = false;
        console.log('   Zalo:       stopped');
    }
    async send(message) {
        if (!this.api) {
            console.warn('Zalo: cannot send — no access token configured (webhook receive-only mode)');
            return;
        }
        const chunks = this.splitMessage(message.content, 2000);
        for (const chunk of chunks) {
            await this.api.sendTextMessage(message.channelId, chunk);
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    /**
     * Process incoming Zalo OA webhook event.
     */
    async handleWebhook(event) {
        var _a;
        if (!this.running || !this.messageHandler)
            return;
        if (event.event_name !== 'user_send_text' || !((_a = event.message) === null || _a === void 0 ? void 0 : _a.text))
            return;
        const incoming = {
            platform: 'zalo',
            channelId: event.sender.id,
            userId: event.user_id_by_app || event.sender.id,
            content: event.message.text,
            timestamp: new Date(parseInt(event.timestamp)).toISOString(),
            metadata: {
                messageId: event.message.msg_id,
                oaId: event.oa_id,
                appId: event.app_id,
            },
        };
        try {
            await this.messageHandler(incoming);
        }
        catch (err) {
            console.error('Zalo handler error:', err instanceof Error ? err.message : err);
            if (this.api) {
                await this.api.sendTextMessage(event.sender.id, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.').catch(() => { });
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
