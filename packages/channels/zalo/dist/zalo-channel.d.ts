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
export declare class ZaloChannel implements ChannelPlugin {
    readonly id = "zalo-channel";
    readonly platform: "zalo";
    readonly name = "Zalo Channel";
    readonly version = "2.0.0";
    private api?;
    private config;
    private messageHandler?;
    private running;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    /**
     * Process incoming Zalo OA webhook event.
     */
    handleWebhook(event: ZaloWebhookEvent): Promise<void>;
    getApi(): ZaloApi | undefined;
    private splitMessage;
}
//# sourceMappingURL=zalo-channel.d.ts.map