import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { ZaloApi } from './zalo-api.js';
import type { ZaloWebhookEvent } from './zalo-api.js';

export interface ZaloChannelConfig {
  oaId: string;
  appId: string;
  accessToken?: string;
  secretKey?: string;
}

/**
 * Zalo OA channel adapter for HiTechClaw.
 *
 * Uses the Zalo Official Account Open API v3.
 * Messages arrive via webhook and responses are sent via the OA API.
 * Specially designed for Vietnamese enterprise market.
 */
export class ZaloChannel implements ChannelPlugin {
  readonly id = 'zalo-channel';
  readonly platform = 'zalo' as const;
  readonly name = 'Zalo Channel';
  readonly version = '2.0.0';

  private api?: ZaloApi;
  private config!: ZaloChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const oaId = config.oaId as string;
    const appId = config.appId as string;
    const accessToken = config.accessToken as string | undefined;

    if (!oaId || !appId) {
      throw new Error('ZaloChannel: oaId and appId are required');
    }

    this.config = {
      oaId,
      appId,
      accessToken: accessToken || undefined,
      secretKey: config.secretKey as string | undefined,
    };

    // Only create API client if accessToken is available
    if (accessToken) {
      this.api = new ZaloApi(accessToken);
      try {
        const info = await this.api.getOAInfo();
        const data = info.data as Record<string, unknown> | undefined;
        console.log(`   Zalo:       connected to OA "${data?.name || oaId}"`);
      } catch {
        console.log(`   Zalo:       initialized for OA ${oaId} (could not verify token)`);
      }
    } else {
      console.log(`   Zalo:       webhook mode for OA ${oaId} (App: ${appId}) — no access token, receive-only`);
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Zalo:       ready for incoming webhooks');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('   Zalo:       stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.api) {
      console.warn('Zalo: cannot send — no access token configured (webhook receive-only mode)');
      return;
    }
    const chunks = this.splitMessage(message.content, 2000);
    for (const chunk of chunks) {
      await this.api.sendTextMessage(message.channelId, chunk);
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Process incoming Zalo OA webhook event.
   */
  async handleWebhook(event: ZaloWebhookEvent): Promise<void> {
    if (!this.running || !this.messageHandler) return;

    if (event.event_name !== 'user_send_text' || !event.message?.text) return;

    const incoming: IncomingMessage = {
      platform: 'zalo',
      channelId: event.sender.id,
      userId: event.user_id_by_app || event.sender.id,
      content: event.message.text,
      timestamp: new Date(parseInt(event.timestamp)).toISOString(),
      metadata: {
        messageId: event.message.msg_id,
        oaId: event.oa_id,
        appId: event.app_id,
      },
    };

    try {
      await this.messageHandler(incoming);
    } catch (err) {
      console.error('Zalo handler error:', err instanceof Error ? err.message : err);
      if (this.api) {
        await this.api.sendTextMessage(event.sender.id, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.').catch(() => {});
      }
    }
  }

  getApi(): ZaloApi | undefined {
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
