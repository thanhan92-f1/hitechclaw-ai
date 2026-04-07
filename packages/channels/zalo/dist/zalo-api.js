/**
 * Zalo Official Account (OA) API wrapper for HiTechClaw.
 * Uses the Zalo OA Open API v3.
 * Docs: https://developers.zalo.me/docs/official-account/
 */
export class ZaloApi {
    accessToken;
    baseUrl = 'https://openapi.zalo.me/v3.0/oa';
    constructor(accessToken) {
        this.accessToken = accessToken;
    }
    async sendTextMessage(userId, text) {
        const res = await fetch(`${this.baseUrl}/message/cs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                access_token: this.accessToken,
            },
            body: JSON.stringify({
                recipient: { user_id: userId },
                message: { text },
            }),
        });
        const data = await res.json();
        if (data.error && data.error !== 0) {
            throw new Error(`Zalo API error: ${data.message}`);
        }
    }
    async getOAInfo() {
        const res = await fetch(`${this.baseUrl}/getoa`, {
            headers: { access_token: this.accessToken },
        });
        return res.json();
    }
    async sendImage(userId, imageUrl) {
        await fetch(`${this.baseUrl}/message/cs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                access_token: this.accessToken,
            },
            body: JSON.stringify({
                recipient: { user_id: userId },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'media',
                            elements: [{ media_type: 'image', url: imageUrl }],
                        },
                    },
                },
            }),
        });
    }
}
//# sourceMappingURL=zalo-api.js.map