import { MSTeamsApi } from './msteams-api.js';
/**
 * Microsoft Teams channel adapter for HiTechClaw.
 *
 * Uses the Bot Framework REST API via Bot Connector.
 * Messages arrive via webhook and responses are sent via the Bot Connector API.
 */
export class MSTeamsChannel {
    id = 'msteams-channel';
    platform = 'msteams';
    name = 'Microsoft Teams Channel';
    version = '2.0.0';
    api;
    config;
    messageHandler;
    running = false;
    /** Store serviceUrl per conversation for sending replies */
    serviceUrls = new Map();
    async initialize(config) {
        const appId = config.appId;
        const appPassword = config.appPassword;
        if (!appId || !appPassword) {
            throw new Error('MSTeamsChannel: appId and appPassword are required');
        }
        this.api = new MSTeamsApi(appId, appPassword);
        this.config = {
            appId,
            appPassword,
            tenantId: config.tenantId,
        };
        // Verify credentials by getting a token
        await this.api.getAccessToken();
        console.log(`   Teams:      initialized with app ID ${appId}`);
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        console.log('   Teams:      ready for incoming activities');
    }
    async stop() {
        this.running = false;
        this.serviceUrls.clear();
        console.log('   Teams:      stopped');
    }
    async send(message) {
        const serviceUrl = this.serviceUrls.get(message.channelId);
        if (!serviceUrl) {
            throw new Error(`No serviceUrl found for conversation ${message.channelId}`);
        }
        const chunks = this.splitMessage(message.content, 4000);
        for (const chunk of chunks) {
            await this.api.sendReply(serviceUrl, message.channelId, chunk, message.replyTo);
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    /**
     * Process incoming Bot Framework activity.
     * Called by the gateway webhook handler.
     */
    async handleActivity(activity) {
        if (!this.running || !this.messageHandler)
            return;
        // Store serviceUrl for replies
        this.serviceUrls.set(activity.conversation.id, activity.serviceUrl);
        if (activity.type !== 'message' || !activity.text)
            return;
        // Show typing indicator
        this.api.sendTyping(activity.serviceUrl, activity.conversation.id).catch(() => { });
        // Strip @mention of the bot from the text
        let text = activity.text;
        const mentionPattern = /<at>.*?<\/at>\s*/gi;
        text = text.replace(mentionPattern, '').trim();
        if (!text)
            return;
        const incoming = {
            platform: 'msteams',
            channelId: activity.conversation.id,
            userId: activity.from.id,
            content: text,
            timestamp: activity.timestamp || new Date().toISOString(),
            replyTo: activity.replyToId,
            metadata: {
                activityId: activity.id,
                fromName: activity.from.name,
                aadObjectId: activity.from.aadObjectId,
                tenantId: activity.conversation.tenantId,
                conversationType: activity.conversation.conversationType,
                serviceUrl: activity.serviceUrl,
            },
        };
        try {
            await this.messageHandler(incoming);
        }
        catch (err) {
            console.error('Teams handler error:', err instanceof Error ? err.message : err);
            await this.api.sendReply(activity.serviceUrl, activity.conversation.id, '❌ Sorry, an error occurred processing your message.', activity.id).catch(() => { });
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
//# sourceMappingURL=msteams-channel.js.map