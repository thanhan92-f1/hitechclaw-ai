import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import { TelegramApi } from './telegram-api.js';
export interface TelegramChannelConfig {
    botToken: string;
    /** Bot username (without @), auto-detected from getMe */
    botUsername?: string;
    /** Polling interval in ms when no updates (default: 1000) */
    pollInterval?: number;
}
export declare class TelegramChannel implements ChannelPlugin {
    readonly id = "telegram-channel";
    readonly platform: "telegram";
    readonly name = "Telegram Channel";
    readonly version = "2.0.0";
    private api;
    private config;
    private messageHandler?;
    private running;
    private offset;
    private pollTimer?;
    initialize(config: Record<string, unknown>): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutgoingMessage): Promise<void>;
    onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
    /** Get the underlying API for direct calls */
    getApi(): TelegramApi;
    private poll;
    private handleUpdates;
    /** Check if the message is directed at the bot (mention, reply, or command) */
    private isBotAddressed;
    /** Remove @bot_username from message text */
    private stripBotMention;
    /**
     * Transcribe an audio buffer to text.
     * Uses OpenAI Whisper first (if OPENAI_API_KEY is set), then falls back to Ollama whisper.
     */
    private transcribeAudio;
    private splitMessage;
}
//# sourceMappingURL=telegram-channel.d.ts.map