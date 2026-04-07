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
export declare class WhatsAppChannel implements ChannelPlugin {
    readonly id = "whatsapp-channel";
    readonly platform: "whatsapp";
    readonly name = "WhatsApp Channel";
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
    /**
     * Verify webhook challenge from Meta.
     */
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    /**
     * Process incoming WhatsApp webhook payload.
     */
    handleWebhook(payload: WhatsAppWebhookPayload): Promise<void>;
    getApi(): WhatsAppApi;
    private splitMessage;
}
//# sourceMappingURL=whatsapp-channel.d.ts.map