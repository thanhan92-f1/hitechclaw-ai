/**
 * WhatsApp Cloud API wrapper for HiTechClaw.
 * Uses the official Meta WhatsApp Business Cloud API.
 */

export interface WhatsAppIncoming {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction';
  text?: { body: string };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        messages?: WhatsAppIncoming[];
        statuses?: Array<{ id: string; status: string; timestamp: string }>;
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppApi {
  private baseUrl: string;

  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private apiVersion = 'v18.0',
  ) {
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
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

  async markAsRead(messageId: string): Promise<void> {
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
    }).catch(() => {});
  }

  async getBusinessProfile(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return res.json() as Promise<Record<string, unknown>>;
  }
}
