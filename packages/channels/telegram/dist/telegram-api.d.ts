/**
 * Low-level Telegram Bot API client using native fetch.
 */
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
}
export interface TelegramMessageEntity {
    type: 'mention' | 'hashtag' | 'bot_command' | 'url' | 'text_mention' | string;
    offset: number;
    length: number;
    user?: TelegramUser;
}
export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    entities?: TelegramMessageEntity[];
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
    voice?: TelegramVoice;
    audio?: TelegramVoice;
    caption?: string;
    caption_entities?: TelegramMessageEntity[];
    reply_to_message?: TelegramMessage;
}
export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}
export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}
export interface TelegramPhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
}
export interface TelegramDocument {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
}
export interface TelegramVoice {
    file_id: string;
    file_unique_id: string;
    /** Duration in seconds */
    duration: number;
    mime_type?: string;
    file_size?: number;
}
export interface TelegramApiResponse<T> {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
}
export declare class TelegramApi {
    private readonly botToken;
    private readonly baseUrl;
    constructor(botToken: string);
    private request;
    getMe(): Promise<TelegramUser>;
    getUpdates(offset?: number, timeout?: number): Promise<TelegramUpdate[]>;
    sendMessage(chatId: number | string, text: string, options?: {
        parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
        replyToMessageId?: number;
        disableNotification?: boolean;
    }): Promise<TelegramMessage>;
    sendChatAction(chatId: number | string, action: 'typing' | 'upload_photo' | 'upload_document'): Promise<boolean>;
    getChat(chatId: number | string): Promise<TelegramChat>;
    sendPhoto(chatId: number | string, photoUrl: string, caption?: string): Promise<TelegramMessage>;
    sendDocument(chatId: number | string, documentUrl: string, caption?: string): Promise<TelegramMessage>;
    /** Get file info by file_id — returns file_path for download */
    getFile(fileId: string): Promise<{
        file_id: string;
        file_unique_id: string;
        file_size?: number;
        file_path?: string;
    }>;
    /** Download a file and return its raw buffer + content-type */
    downloadFileAsBuffer(filePath: string): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    /** Download a file by file_path and return as base64 data URL */
    downloadFileAsDataUrl(filePath: string): Promise<string>;
}
//# sourceMappingURL=telegram-api.d.ts.map