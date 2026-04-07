/**
 * WhatsApp Cloud API wrapper for HiTechClaw.
 * Uses the official Meta WhatsApp Business Cloud API.
 */
export interface WhatsAppIncoming {
    from: string;
    id: string;
    timestamp: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction';
    text?: {
        body: string;
    };
}
export interface WhatsAppWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: string;
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                messages?: WhatsAppIncoming[];
                statuses?: Array<{
                    id: string;
                    status: string;
                    timestamp: string;
                }>;
            };
            field: string;
        }>;
    }>;
}
export declare class WhatsAppApi {
    private phoneNumberId;
    private accessToken;
    private apiVersion;
    private baseUrl;
    constructor(phoneNumberId: string, accessToken: string, apiVersion?: string);
    sendTextMessage(to: string, text: string): Promise<void>;
    markAsRead(messageId: string): Promise<void>;
    getBusinessProfile(): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=whatsapp-api.d.ts.map