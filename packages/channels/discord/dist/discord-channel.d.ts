import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
export interface DiscordChannelConfig {
    botToken: string;
    /** Comma-separated list of guild IDs to listen to (empty = all guilds) */
    guildIds?: string[];
}
/**
 * Discord channel adapter for HiTechClaw.
 *
 * Uses Discord Gateway WebSocket (v10) for receiving messages and
 * the REST API for sending messages. Supports slash-less text commands.
 */
export declare class DiscordChannel implements ChannelPlugin {
    readonly id = "discord-channel";
    readonly platform: "discord";
    readonly name = "Discord Channel";
    readonly version = "2.0.0";
    private config;
    private messageHandler?;
    private running;
    private ws?;
    private heartbeatInterval?;
    private sessionId?;
    private lastSequence;
    private botUserId?;
    private reconnectTimer?;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    private connectGateway;
    private handleGatewayMessage;
    private handleDispatch;
    private handleMessageCreate;
    private identify;
    private startHeartbeat;
    private sendGateway;
    private splitMessage;
}
//# sourceMappingURL=discord-channel.d.ts.map