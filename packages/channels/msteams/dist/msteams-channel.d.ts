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
export declare class MSTeamsChannel implements ChannelPlugin {
    readonly id = "msteams-channel";
    readonly platform: "msteams";
    readonly name = "Microsoft Teams Channel";
    readonly version = "2.0.0";
    private api;
    private config;
    private messageHandler?;
    private running;
    /** Store serviceUrl per conversation for sending replies */
    private serviceUrls;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    /**
     * Process incoming Bot Framework activity.
     * Called by the gateway webhook handler.
     */
    handleActivity(activity: TeamsActivity): Promise<void>;
    getApi(): MSTeamsApi;
    private splitMessage;
}
//# sourceMappingURL=msteams-channel.d.ts.map