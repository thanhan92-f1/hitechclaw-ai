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
export declare class FacebookChannel implements ChannelPlugin {
    readonly id = "facebook-channel";
    readonly platform: "facebook";
    readonly name = "Facebook Messenger Channel";
    readonly version = "2.0.0";
    private api;
    private config;
    private messageHandler?;
    private running;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    handleWebhook(event: FacebookWebhookEvent): Promise<void>;
    getApi(): FacebookApi;
    private splitMessage;
}
//# sourceMappingURL=facebook-channel.d.ts.map