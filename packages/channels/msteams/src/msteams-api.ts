/**
 * Microsoft Teams Bot Framework API wrapper for HiTechClaw.
 * Uses the Bot Framework REST API (Bot Connector).
 */

export interface TeamsActivity {
  type: string;
  id: string;
  timestamp: string;
  channelId: string;
  from: { id: string; name?: string; aadObjectId?: string };
  conversation: { id: string; tenantId?: string; conversationType?: string };
  recipient: { id: string; name?: string };
  text?: string;
  serviceUrl: string;
  channelData?: Record<string, unknown>;
  replyToId?: string;
}

export class MSTeamsApi {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private appId: string,
    private appPassword: string,
  ) {}

  /**
   * Get OAuth2 access token from Microsoft identity platform.
   */
  async getAccessToken(): Promise<string> {
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

    if (!res.ok) throw new Error('Failed to get Teams access token');
    const data = await res.json() as { access_token: string; expires_in: number };

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5min buffer
    };

    return data.access_token;
  }

  /**
   * Send a reply to a conversation via the Bot Connector API.
   */
  async sendReply(serviceUrl: string, conversationId: string, text: string, replyToId?: string): Promise<void> {
    const token = await this.getAccessToken();

    const activity = {
      type: 'message',
      text,
      ...(replyToId ? { replyToId } : {}),
    };

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
  async sendTyping(serviceUrl: string, conversationId: string): Promise<void> {
    const token = await this.getAccessToken();
    await fetch(`${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'typing' }),
    }).catch(() => {});
  }
}
