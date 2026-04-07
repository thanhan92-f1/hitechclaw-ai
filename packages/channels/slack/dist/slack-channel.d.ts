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
export declare class SlackChannel implements ChannelPlugin {
    readonly id = "slack-channel";
    readonly platform: "slack";
    readonly name = "Slack Channel";
    readonly version = "2.0.0";
    private api;
    private config;
    private messageHandler?;
    private running;
    private pollTimer?;
    private lastTimestamps;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    /**
     * Process an incoming Slack event (called by the gateway webhook handler).
     */
    handleEvent(event: {
        type: string;
        event: SlackMessage;
    }): Promise<void>;
    getApi(): SlackApi;
    private stripBotMention;
    private splitMessage;
}
//# sourceMappingURL=slack-channel.d.ts.map