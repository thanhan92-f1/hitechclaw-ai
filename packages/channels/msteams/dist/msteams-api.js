/**
 * Microsoft Teams Bot Framework API wrapper for HiTechClaw.
 * Uses the Bot Framework REST API (Bot Connector).
 */
export class MSTeamsApi {
    constructor(appId, appPassword) {
        this.appId = appId;
        this.appPassword = appPassword;
        this.tokenCache = null;
    }
    /**
     * Get OAuth2 access token from Microsoft identity platform.
     */
    async getAccessToken() {
        if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
            return this.tokenCache.token;
        }
        const res = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.appId,
                client_secret: this.appPassword,
                scope: 'https://api.botframework.com/.default',
            }),
        });
        if (!res.ok)
            throw new Error('Failed to get Teams access token');
        const data = await res.json();
        this.tokenCache = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5min buffer
        };
        return data.access_token;
    }
    /**
     * Send a reply to a conversation via the Bot Connector API.
     */
    async sendReply(serviceUrl, conversationId, text, replyToId) {
        const token = await this.getAccessToken();
        const activity = Object.assign({ type: 'message', text }, (replyToId ? { replyToId } : {}));
        const url = `${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(activity),
        });
        if (!res.ok) {
            const err = await res.text().catch(() => 'Unknown error');
            throw new Error(`Teams API error: ${err}`);
        }
    }
    /**
     * Send typing indicator to a conversation.
     */
    async sendTyping(serviceUrl, conversationId) {
        const token = await this.getAccessToken();
        await fetch(`${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'typing' }),
        }).catch(() => { });
    }
}
