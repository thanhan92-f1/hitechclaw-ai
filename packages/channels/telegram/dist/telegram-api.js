/**
 * Low-level Telegram Bot API client using native fetch.
 */
const TELEGRAM_API = 'https://api.telegram.org';
export class TelegramApi {
    constructor(botToken) {
        this.botToken = botToken;
        this.baseUrl = `${TELEGRAM_API}/bot${botToken}`;
    }
    async request(method, params, timeoutMs = 30000) {
        const url = `${this.baseUrl}/${method}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: params ? JSON.stringify(params) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });
        const data = (await res.json());
        if (!data.ok) {
            throw new Error(`Telegram API error: ${data.description || 'Unknown error'} (${data.error_code})`);
        }
        return data.result;
    }
    async getMe() {
        return this.request('getMe');
    }
    async getUpdates(offset, timeout = 30) {
        // fetch timeout must be longer than Telegram's long polling timeout
        return this.request('getUpdates', {
            offset,
            timeout,
            allowed_updates: ['message'],
        }, (timeout + 10) * 1000);
    }
    async sendMessage(chatId, text, options) {
        return this.request('sendMessage', {
            chat_id: chatId,
            text,
            parse_mode: options === null || options === void 0 ? void 0 : options.parseMode,
            reply_to_message_id: options === null || options === void 0 ? void 0 : options.replyToMessageId,
            disable_notification: options === null || options === void 0 ? void 0 : options.disableNotification,
        });
    }
    async sendChatAction(chatId, action) {
        return this.request('sendChatAction', {
            chat_id: chatId,
            action,
        });
    }
    async getChat(chatId) {
        return this.request('getChat', {
            chat_id: chatId,
        });
    }
    async sendPhoto(chatId, photoUrl, caption) {
        return this.request('sendPhoto', {
            chat_id: chatId,
            photo: photoUrl,
            caption,
        });
    }
    async sendDocument(chatId, documentUrl, caption) {
        return this.request('sendDocument', {
            chat_id: chatId,
            document: documentUrl,
            caption,
        });
    }
    /** Get file info by file_id — returns file_path for download */
    async getFile(fileId) {
        return this.request('getFile', {
            file_id: fileId,
        });
    }
    /** Download a file and return its raw buffer + content-type */
    async downloadFileAsBuffer(filePath) {
        const url = `${TELEGRAM_API}/file/bot${this.botToken}/${filePath}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok)
            throw new Error(`Failed to download file: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            contentType: res.headers.get('content-type') || 'audio/ogg',
        };
    }
    /** Download a file by file_path and return as base64 data URL */
    async downloadFileAsDataUrl(filePath) {
        const url = `${TELEGRAM_API}/file/bot${this.botToken}/${filePath}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok)
            throw new Error(`Failed to download file: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    }
}
