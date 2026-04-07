/**
 * ChannelManager — manages running channel instances from MongoDB per-tenant config.
 *
 * Replaces hardcoded env-var channel initialization. Channels are now configured
 * per-tenant in the `channel_connections` MongoDB collection, and started/stopped
 * dynamically via this manager.
 */
import type { MongoChannelConnection } from '@hitechclaw/db';
import type { Attachment, ChannelPlugin } from '@hitechclaw/shared';
export type MessageHandler = (platform: string, send: (channelId: string, content: string, replyTo?: string) => Promise<void>) => (incoming: {
    channelId: string;
    userId: string;
    content: string;
    attachments?: Attachment[];
    metadata?: Record<string, unknown>;
}) => Promise<void>;
export declare class ChannelManager {
    private running;
    private makeHandler;
    constructor(makeHandler: MessageHandler);
    /** Create a channel plugin instance based on platform type */
    private createChannelInstance;
    /** Start a single channel from its DB connection record */
    startChannel(conn: MongoChannelConnection): Promise<void>;
    /** Stop a running channel by connection ID */
    stopChannel(connectionId: string): Promise<void>;
    /** Load and start all active channels from MongoDB */
    startAllActive(): Promise<number>;
    /** Stop all running channels */
    stopAll(): Promise<void>;
    /** Restart a channel (stop + reload from DB + start) */
    restartChannel(connectionId: string): Promise<void>;
    /** Check if a channel connection is currently running */
    isRunning(connectionId: string): boolean;
    /** Get running channel count */
    get count(): number;
    /** Get a running channel instance by connection ID */
    getInstance(connectionId: string): ChannelPlugin | undefined;
}
//# sourceMappingURL=channel-manager.d.ts.map