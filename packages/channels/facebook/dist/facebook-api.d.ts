/**
 * Facebook Messenger Send API wrapper for HiTechClaw.
 * Uses Meta Graph API v18.0 endpoints.
 */
export interface FacebookWebhookEvent {
    object: 'page';
    entry: Array<{
        id: string;
        time: number;
        messaging: Array<{
            sender: {
                id: string;
            };
            recipient: {
                id: string;
            };
            timestamp: number;
            message?: {
                mid: string;
                text?: string;
            };
            postback?: {
                title?: string;
                payload?: string;
            };
        }>;
    }>;
}
export declare class FacebookApi {
    private pageAccessToken;
    private baseUrl;
    constructor(pageAccessToken: string);
    sendTextMessage(recipientId: string, text: string): Promise<void>;
    getPageInfo(): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=facebook-api.d.ts.map