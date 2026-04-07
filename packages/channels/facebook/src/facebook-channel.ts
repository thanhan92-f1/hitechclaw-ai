import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import type { FacebookWebhookEvent } from './facebook-api.js';
import { FacebookApi } from './facebook-api.js';

export interface FacebookChannelConfig {
  pageAccessToken: string;
  verifyToken: string;
  appSecret?: string;
}

/**
 * Facebook Messenger channel adapter for HiTechClaw.
 * Receives messages from webhook events and replies via Send API.
 */
export class FacebookChannel implements ChannelPlugin {
  readonly id = 'facebook-channel';
  readonly platform = 'facebook' as const;
  readonly name = 'Facebook Messenger Channel';
  readonly version = '2.0.0';

  private api!: FacebookApi;
  private config!: FacebookChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const pageAccessToken = config.pageAccessToken as string;
    const verifyToken = config.verifyToken as string;

    if (!pageAccessToken || !verifyToken) {
      throw new Error('FacebookChannel: pageAccessToken and verifyToken are required');
    }

    this.api = new FacebookApi(pageAccessToken);
    this.config = {
      pageAccessToken,
      verifyToken,
      appSecret: config.appSecret as string | undefined,
    };

    try {
      const data = await this.api.getPageInfo();
      console.log(`   Facebook:   connected to page "${String(data.name || 'unknown')}"`);
    } catch {
      console.log('   Facebook:   initialized (could not verify token with page info)');
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Facebook:   ready for incoming webhooks');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('   Facebook:   stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const chunks = this.splitMessage(message.content, 2000);
    for (const chunk of chunks) {
      await this.api.sendTextMessage(message.channelId, chunk);
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }

  async handleWebhook(event: FacebookWebhookEvent): Promise<void> {
    if (!this.running || !this.messageHandler) return;
    if (event.object !== 'page') return;

    for (const entry of event.entry) {
      for (const messagingEvent of entry.messaging) {
        const senderId = messagingEvent.sender?.id;
        const recipientId = messagingEvent.recipient?.id;
        if (!senderId || !recipientId) continue;

        const text = messagingEvent.message?.text || messagingEvent.postback?.payload;
        if (!text) continue;

        const incoming: IncomingMessage = {
          platform: 'facebook',
          channelId: senderId,
          userId: senderId,
          content: text,
          timestamp: new Date(messagingEvent.timestamp).toISOString(),
          metadata: {
            recipientId,
            messageId: messagingEvent.message?.mid,
            postbackTitle: messagingEvent.postback?.title,
          },
        };

        try {
          await this.messageHandler(incoming);
        } catch (err) {
          console.error('Facebook handler error:', err instanceof Error ? err.message : err);
          await this.api.sendTextMessage(senderId, 'Xin loi, co loi xay ra khi xu ly tin nhan.').catch(() => {});
        }
      }
    }
  }

  getApi(): FacebookApi {
    return this.api;
  }

  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitIdx = remaining.lastIndexOf('\n', maxLen);
      if (splitIdx <= 0) splitIdx = maxLen;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).replace(/^\n/, '');
    }

    return chunks;
  }
}
