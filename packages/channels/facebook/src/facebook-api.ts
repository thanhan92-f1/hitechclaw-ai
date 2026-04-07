/**
 * Facebook Messenger Send API wrapper for HiTechClaw.
 * Uses Meta Graph API v18.0 endpoints.
 */

export interface FacebookWebhookEvent {
  object: 'page';
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
      };
      postback?: {
        title?: string;
        payload?: string;
      };
    }>;
  }>;
}

export class FacebookApi {
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(private pageAccessToken: string) {}

  async sendTextMessage(recipientId: string, text: string): Promise<void> {
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

  async getPageInfo(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/me?fields=id,name&access_token=${encodeURIComponent(this.pageAccessToken)}`);
    if (!res.ok) {
      throw new Error('Facebook API error: unable to fetch page info');
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
}
