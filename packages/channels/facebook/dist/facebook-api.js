/**
 * Facebook Messenger Send API wrapper for HiTechClaw.
 * Uses Meta Graph API v18.0 endpoints.
 */
export class FacebookApi {
    pageAccessToken;
    baseUrl = 'https://graph.facebook.com/v18.0';
    constructor(pageAccessToken) {
        this.pageAccessToken = pageAccessToken;
    }
    async sendTextMessage(recipientId, text) {
        const res = await fetch(`${this.baseUrl}/me/messages?access_token=${encodeURIComponent(this.pageAccessToken)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text },
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Facebook API error: ${JSON.stringify(err)}`);
        }
    }
    async getPageInfo() {
        const res = await fetch(`${this.baseUrl}/me?fields=id,name&access_token=${encodeURIComponent(this.pageAccessToken)}`);
        if (!res.ok) {
            throw new Error('Facebook API error: unable to fetch page info');
        }
        return res.json();
    }
}
//# sourceMappingURL=facebook-api.js.map