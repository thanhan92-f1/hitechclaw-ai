/**
 * Zalo Official Account (OA) API wrapper for HiTechClaw.
 * Uses the Zalo OA Open API v3.
 * Docs: https://developers.zalo.me/docs/official-account/
 */

export interface ZaloWebhookEvent {
  app_id: string;
  user_id_by_app: string;
  oa_id: string;
  timestamp: string;
  event_name: string;
  message?: {
    msg_id: string;
    text?: string;
    attachments?: Array<{ type: string; payload: { url: string } }>;
  };
  sender: { id: string };
  recipient: { id: string };
}

export class ZaloApi {
  private baseUrl = 'https://openapi.zalo.me/v3.0/oa';

  constructor(private accessToken: string) {}

  async sendTextMessage(userId: string, text: string): Promise<void> {
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
    const data = await res.json() as Record<string, unknown>;
    if (data.error && (data.error as number) !== 0) {
      throw new Error(`Zalo API error: ${data.message}`);
    }
  }

  async getOAInfo(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/getoa`, {
      headers: { access_token: this.accessToken },
    });
    return res.json() as Promise<Record<string, unknown>>;
  }

  async sendImage(userId: string, imageUrl: string): Promise<void> {
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
