/**
 * Zalo Official Account (OA) API wrapper for HiTechClaw.
 * Uses the Zalo OA Open API v3.
 * Docs: https://developers.zalo.me/docs/official-account/
 */
export interface ZaloWebhookEvent {
    app_id: string;
    user_id_by_app: string;
    oa_id: string;
    timestamp: string;
    event_name: string;
    message?: {
        msg_id: string;
        text?: string;
        attachments?: Array<{
            type: string;
            payload: {
                url: string;
            };
        }>;
    };
    sender: {
        id: string;
    };
    recipient: {
        id: string;
    };
}
export declare class ZaloApi {
    private accessToken;
    private baseUrl;
    constructor(accessToken: string);
    sendTextMessage(userId: string, text: string): Promise<void>;
    getOAInfo(): Promise<Record<string, unknown>>;
    sendImage(userId: string, imageUrl: string): Promise<void>;
}
//# sourceMappingURL=zalo-api.d.ts.map