/**
 * Slack Web API wrapper — minimal implementation for HiTechClaw channel plugin.
 * Uses plain HTTP calls to avoid heavy SDK dependencies.
 */
export interface SlackMessage {
    type: string;
    channel: string;
    user?: string;
    text: string;
    ts: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
}
export interface SlackEvent {
    type: string;
    event: SlackMessage;
    event_id: string;
    team_id: string;
}
export declare class SlackApi {
    private botToken;
    private baseUrl;
    constructor(botToken: string);
    private call;
    authTest(): Promise<{
        user_id: string;
        user: string;
        bot_id: string;
        team: string;
    }>;
    postMessage(channel: string, text: string, threadTs?: string): Promise<void>;
    conversationsHistory(channel: string, limit?: number): Promise<SlackMessage[]>;
}
//# sourceMappingURL=slack-api.d.ts.map