import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { MSTeamsApi } from './msteams-api.js';
import type { TeamsActivity } from './msteams-api.js';

export interface MSTeamsChannelConfig {
  appId: string;
  appPassword: string;
  tenantId?: string;
}

/**
 * Microsoft Teams channel adapter for HiTechClaw.
 *
 * Uses the Bot Framework REST API via Bot Connector.
 * Messages arrive via webhook and responses are sent via the Bot Connector API.
 */
export class MSTeamsChannel implements ChannelPlugin {
  readonly id = 'msteams-channel';
  readonly platform = 'msteams' as const;
  readonly name = 'Microsoft Teams Channel';
  readonly version = '2.0.0';

  private api!: MSTeamsApi;
  private config!: MSTeamsChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;
  /** Store serviceUrl per conversation for sending replies */
  private serviceUrls: Map<string, string> = new Map();

  async initialize(config: Record<string, unknown>): Promise<void> {
    const appId = config.appId as string;
    const appPassword = config.appPassword as string;

    if (!appId || !appPassword) {
      throw new Error('MSTeamsChannel: appId and appPassword are required');
    }

    this.api = new MSTeamsApi(appId, appPassword);
    this.config = {
      appId,
      appPassword,
      tenantId: config.tenantId as string | undefined,
    };

    // Verify credentials by getting a token
    await this.api.getAccessToken();
    console.log(`   Teams:      initialized with app ID ${appId}`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Teams:      ready for incoming activities');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.serviceUrls.clear();
    console.log('   Teams:      stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const serviceUrl = this.serviceUrls.get(message.channelId);
    if (!serviceUrl) {
      throw new Error(`No serviceUrl found for conversation ${message.channelId}`);
    }

    const chunks = this.splitMessage(message.content, 4000);
    for (const chunk of chunks) {
      await this.api.sendReply(serviceUrl, message.channelId, chunk, message.replyTo);
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Process incoming Bot Framework activity.
   * Called by the gateway webhook handler.
   */
  async handleActivity(activity: TeamsActivity): Promise<void> {
    if (!this.running || !this.messageHandler) return;

    // Store serviceUrl for replies
    this.serviceUrls.set(activity.conversation.id, activity.serviceUrl);

    if (activity.type !== 'message' || !activity.text) return;

    // Show typing indicator
    this.api.sendTyping(activity.serviceUrl, activity.conversation.id).catch(() => {});

    // Strip @mention of the bot from the text
    let text = activity.text;
    const mentionPattern = /<at>.*?<\/at>\s*/gi;
    text = text.replace(mentionPattern, '').trim();
    if (!text) return;

    const incoming: IncomingMessage = {
      platform: 'msteams',
      channelId: activity.conversation.id,
      userId: activity.from.id,
      content: text,
      timestamp: activity.timestamp || new Date().toISOString(),
      replyTo: activity.replyToId,
      metadata: {
        activityId: activity.id,
        fromName: activity.from.name,
        aadObjectId: activity.from.aadObjectId,
        tenantId: activity.conversation.tenantId,
        conversationType: activity.conversation.conversationType,
        serviceUrl: activity.serviceUrl,
      },
    };

    try {
      await this.messageHandler(incoming);
    } catch (err) {
      console.error('Teams handler error:', err instanceof Error ? err.message : err);
      await this.api.sendReply(
        activity.serviceUrl,
        activity.conversation.id,
        '❌ Sorry, an error occurred processing your message.',
        activity.id,
      ).catch(() => {});
    }
  }

  getApi(): MSTeamsApi {
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
