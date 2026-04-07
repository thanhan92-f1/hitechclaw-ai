import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { SlackApi } from './slack-api.js';
import type { SlackMessage } from './slack-api.js';

export interface SlackChannelConfig {
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  /** Bot user ID, auto-detected from auth.test */
  botUserId?: string;
  /** Polling interval in ms (default: 2000) — used for RTM-style polling */
  pollInterval?: number;
}

/**
 * Slack channel adapter for HiTechClaw.
 *
 * Uses the Slack Web API with polling for incoming messages.
 * For production use, consider switching to Socket Mode or Events API
 * which require a public webhook endpoint.
 */
export class SlackChannel implements ChannelPlugin {
  readonly id = 'slack-channel';
  readonly platform = 'slack' as const;
  readonly name = 'Slack Channel';
  readonly version = '2.0.0';

  private api!: SlackApi;
  private config!: SlackChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private lastTimestamps: Map<string, string> = new Map();

  async initialize(config: Record<string, unknown>): Promise<void> {
    const botToken = config.botToken as string;
    if (!botToken) {
      throw new Error('SlackChannel: botToken is required');
    }

    this.api = new SlackApi(botToken);

    const auth = await this.api.authTest();
    this.config = {
      botToken,
      appToken: config.appToken as string | undefined,
      signingSecret: config.signingSecret as string | undefined,
      botUserId: auth.user_id,
      pollInterval: (config.pollInterval as number) || 2000,
    };
    console.log(`   Slack:      connected as @${auth.user} (team: ${auth.team})`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Slack:      ready for incoming messages');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    console.log('   Slack:      stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const threadTs = message.replyTo;
    const chunks = this.splitMessage(message.content, 4000);
    for (const chunk of chunks) {
      await this.api.postMessage(message.channelId, chunk, threadTs);
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Process an incoming Slack event (called by the gateway webhook handler).
   */
  async handleEvent(event: { type: string; event: SlackMessage }): Promise<void> {
    const msg = event.event;
    if (!msg || msg.type !== 'message' || msg.subtype || msg.bot_id) return;
    if (msg.user === this.config.botUserId) return;

    const incoming: IncomingMessage = {
      platform: 'slack',
      channelId: msg.channel,
      userId: msg.user || 'unknown',
      content: this.stripBotMention(msg.text),
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      replyTo: msg.thread_ts,
      metadata: {
        messageTs: msg.ts,
        threadTs: msg.thread_ts,
      },
    };

    if (this.messageHandler) {
      try {
        await this.messageHandler(incoming);
      } catch (err) {
        console.error('Slack message handler error:', err instanceof Error ? err.message : err);
        await this.api.postMessage(msg.channel, '❌ Sorry, an error occurred processing your message.', msg.thread_ts || msg.ts).catch(() => {});
      }
    }
  }

  getApi(): SlackApi {
    return this.api;
  }

  // ─── Private ────────────────────────────────────────────

  private stripBotMention(text: string): string {
    if (!this.config.botUserId) return text;
    return text.replace(new RegExp(`<@${this.config.botUserId}>`, 'g'), '').trim();
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
