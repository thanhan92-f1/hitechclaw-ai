/**
 * WhatsApp Cloud API wrapper for HiTechClaw.
 * Uses the official Meta WhatsApp Business Cloud API.
 */
export class WhatsAppApi {
    constructor(phoneNumberId, accessToken, apiVersion = 'v18.0') {
        this.phoneNumberId = phoneNumberId;
        this.accessToken = accessToken;
        this.apiVersion = apiVersion;
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }
    async sendTextMessage(to, text) {
        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`WhatsApp API error: ${JSON.stringify(err)}`);
        }
    }
    async markAsRead(messageId) {
        await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            }),
        }).catch(() => { });
    }
    async getBusinessProfile() {
        const res = await fetch(`${this.baseUrl}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites`, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        return res.json();
    }
}
