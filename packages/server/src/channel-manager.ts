/**
 * ChannelManager — manages running channel instances from MongoDB per-tenant config.
 *
 * Replaces hardcoded env-var channel initialization. Channels are now configured
 * per-tenant in the `channel_connections` MongoDB collection, and started/stopped
 * dynamically via this manager.
 */

import { DiscordChannel } from '@hitechclaw/channel-discord';
import { FacebookChannel } from '@hitechclaw/channel-facebook';
import { MSTeamsChannel } from '@hitechclaw/channel-msteams';
import { SlackChannel } from '@hitechclaw/channel-slack';
import { TelegramChannel } from '@hitechclaw/channel-telegram';
import { WhatsAppChannel } from '@hitechclaw/channel-whatsapp';
import { ZaloChannel } from '@hitechclaw/channel-zalo';
import type { MongoChannelConnection } from '@hitechclaw/db';
import { channelConnectionsCollection } from '@hitechclaw/db';
import type { Attachment, ChannelPlugin, ChatPlatform } from '@hitechclaw/shared';

export type MessageHandler = (
  platform: string,
  send: (channelId: string, content: string, replyTo?: string) => Promise<void>,
) => (incoming: { channelId: string; userId: string; content: string; attachments?: Attachment[]; metadata?: Record<string, unknown> }) => Promise<void>;

interface RunningChannel {
  connectionId: string;
  tenantId: string;
  platform: string;
  instance: ChannelPlugin;
}

export class ChannelManager {
  private running = new Map<string, RunningChannel>();
  private makeHandler: MessageHandler;

  constructor(makeHandler: MessageHandler) {
    this.makeHandler = makeHandler;
  }

  /** Create a channel plugin instance based on platform type */
  private createChannelInstance(platform: string): ChannelPlugin {
    switch (platform) {
      case 'telegram': return new TelegramChannel();
      case 'slack': return new SlackChannel();
      case 'whatsapp': return new WhatsAppChannel();
      case 'facebook': return new FacebookChannel();
      case 'zalo': return new ZaloChannel();
      case 'discord': return new DiscordChannel();
      case 'msteams': return new MSTeamsChannel();
      default: throw new Error(`Unsupported channel platform: ${platform}`);
    }
  }

  /** Start a single channel from its DB connection record */
  async startChannel(conn: MongoChannelConnection): Promise<void> {
    if (this.running.has(conn._id)) {
      console.log(`   Channel:   ${conn.channelType}/${conn.name} already running, skipping`);
      return;
    }

    const instance = this.createChannelInstance(conn.channelType);
    await instance.initialize(conn.config);

    const handler = this.makeHandler(conn.channelType, async (channelId, content, replyTo) => {
      await instance.send({ platform: conn.channelType as ChatPlatform, channelId, content, replyTo });
    });
    instance.onMessage(handler);
    await instance.start();

    this.running.set(conn._id, {
      connectionId: conn._id,
      tenantId: conn.tenantId,
      platform: conn.channelType,
      instance,
    });

    console.log(`   Channel:   ✅ ${conn.channelType}/${conn.name} started (tenant: ${conn.tenantId})`);
  }

  /** Stop a running channel by connection ID */
  async stopChannel(connectionId: string): Promise<void> {
    const running = this.running.get(connectionId);
    if (!running) return;

    try {
      await running.instance.stop();
    } catch (err) {
      console.warn(`   Channel:   ⚠️ Error stopping ${running.platform}: ${err instanceof Error ? err.message : err}`);
    }
    this.running.delete(connectionId);
    console.log(`   Channel:   🛑 ${running.platform} stopped (${connectionId})`);
  }

  /** Load and start all active channels from MongoDB */
  async startAllActive(): Promise<number> {
    const channels = channelConnectionsCollection();
    const activeConnections = await channels.find({ status: 'active' }).toArray();

    let started = 0;
    for (const conn of activeConnections) {
      try {
        await this.startChannel(conn);
        started++;
      } catch (err) {
        console.warn(`   Channel:   ⚠️ ${conn.channelType}/${conn.name} skipped: ${err instanceof Error ? err.message : err}`);
        // Mark as error in DB
        await channels.updateOne({ _id: conn._id }, { $set: { status: 'error', updatedAt: new Date() } }).catch(() => {});
      }
    }

    return started;
  }

  /** Stop all running channels */
  async stopAll(): Promise<void> {
    const ids = [...this.running.keys()];
    for (const id of ids) {
      await this.stopChannel(id);
    }
  }

  /** Restart a channel (stop + reload from DB + start) */
  async restartChannel(connectionId: string): Promise<void> {
    await this.stopChannel(connectionId);
    const conn = await channelConnectionsCollection().findOne({ _id: connectionId });
    if (conn && conn.status === 'active') {
      await this.startChannel(conn);
    }
  }

  /** Check if a channel connection is currently running */
  isRunning(connectionId: string): boolean {
    return this.running.has(connectionId);
  }

  /** Get running channel count */
  get count(): number {
    return this.running.size;
  }

  /** Get a running channel instance by connection ID */
  getInstance(connectionId: string): ChannelPlugin | undefined {
    return this.running.get(connectionId)?.instance;
  }
}


