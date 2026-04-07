/**
 * Microsoft Teams Bot Framework API wrapper for HiTechClaw.
 * Uses the Bot Framework REST API (Bot Connector).
 */
export interface TeamsActivity {
    type: string;
    id: string;
    timestamp: string;
    channelId: string;
    from: {
        id: string;
        name?: string;
        aadObjectId?: string;
    };
    conversation: {
        id: string;
        tenantId?: string;
        conversationType?: string;
    };
    recipient: {
        id: string;
        name?: string;
    };
    text?: string;
    serviceUrl: string;
    channelData?: Record<string, unknown>;
    replyToId?: string;
}
export declare class MSTeamsApi {
    private appId;
    private appPassword;
    private tokenCache;
    constructor(appId: string, appPassword: string);
    /**
     * Get OAuth2 access token from Microsoft identity platform.
     */
    getAccessToken(): Promise<string>;
    /**
     * Send a reply to a conversation via the Bot Connector API.
     */
    sendReply(serviceUrl: string, conversationId: string, text: string, replyToId?: string): Promise<void>;
    /**
     * Send typing indicator to a conversation.
     */
    sendTyping(serviceUrl: string, conversationId: string): Promise<void>;
}
//# sourceMappingURL=msteams-api.d.ts.map