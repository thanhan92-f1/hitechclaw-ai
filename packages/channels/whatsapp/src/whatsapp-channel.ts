import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { WhatsAppApi } from './whatsapp-api.js';
import type { WhatsAppWebhookPayload } from './whatsapp-api.js';

export interface WhatsAppChannelConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  apiVersion?: string;
}

/**
 * WhatsApp channel adapter for HiTechClaw.
 *
 * Uses the official Meta WhatsApp Business Cloud API.
 * Messages are received via webhook (configured in the gateway)
 * and responses are sent via the Cloud API.
 */
export class WhatsAppChannel implements ChannelPlugin {
  readonly id = 'whatsapp-channel';
  readonly platform = 'whatsapp' as const;
  readonly name = 'WhatsApp Channel';
  readonly version = '2.0.0';

  private api!: WhatsAppApi;
  private config!: WhatsAppChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const phoneNumberId = config.phoneNumberId as string;
    const accessToken = config.accessToken as string;
    const verifyToken = config.verifyToken as string;

    if (!phoneNumberId || !accessToken) {
      throw new Error('WhatsAppChannel: phoneNumberId and accessToken are required');
    }

    this.api = new WhatsAppApi(phoneNumberId, accessToken, config.apiVersion as string);
    this.config = { phoneNumberId, accessToken, verifyToken, apiVersion: config.apiVersion as string };

    console.log(`   WhatsApp:   initialized for phone ID ${phoneNumberId}`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   WhatsApp:   ready for incoming webhooks');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('   WhatsApp:   stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const chunks = this.splitMessage(message.content, 4096);
    for (const chunk of chunks) {
      await this.api.sendTextMessage(message.channelId, chunk);
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Verify webhook challenge from Meta.
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Process incoming WhatsApp webhook payload.
   */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    if (!this.running || !this.messageHandler) return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;
        if (!messages) continue;

        for (const msg of messages) {
          if (msg.type !== 'text' || !msg.text?.body) continue;

          // Mark as read
          this.api.markAsRead(msg.id).catch(() => {});

          const incoming: IncomingMessage = {
            platform: 'whatsapp',
            channelId: msg.from,
            userId: msg.from,
            content: msg.text.body,
            timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
            metadata: {
              messageId: msg.id,
              phoneNumberId: change.value.metadata.phone_number_id,
              displayPhone: change.value.metadata.display_phone_number,
            },
          };

          try {
            await this.messageHandler(incoming);
          } catch (err) {
            console.error('WhatsApp handler error:', err instanceof Error ? err.message : err);
            await this.api.sendTextMessage(msg.from, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.').catch(() => {});
          }
        }
      }
    }
  }

  getApi(): WhatsAppApi {
    return this.api;
  }

  // ─── Private ────────────────────────────────────────────

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
