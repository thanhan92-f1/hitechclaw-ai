/**
 * Low-level Telegram Bot API client using native fetch.
 */

const TELEGRAM_API = 'https://api.telegram.org';

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

export class TelegramApi {
  private readonly baseUrl: string;

  constructor(private readonly botToken: string) {
    this.baseUrl = `${TELEGRAM_API}/bot${botToken}`;
  }

  private async request<T>(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const data = (await res.json()) as TelegramApiResponse<T>;
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'} (${data.error_code})`);
    }
    return data.result!;
  }

  async getMe(): Promise<TelegramUser> {
    return this.request<TelegramUser>('getMe');
  }

  async getUpdates(offset?: number, timeout = 30): Promise<TelegramUpdate[]> {
    // fetch timeout must be longer than Telegram's long polling timeout
    return this.request<TelegramUpdate[]>('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message'],
    }, (timeout + 10) * 1000);
  }

  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    replyToMessageId?: number;
    disableNotification?: boolean;
  }): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode,
      reply_to_message_id: options?.replyToMessageId,
      disable_notification: options?.disableNotification,
    });
  }

  async sendChatAction(chatId: number | string, action: 'typing' | 'upload_photo' | 'upload_document'): Promise<boolean> {
    return this.request<boolean>('sendChatAction', {
      chat_id: chatId,
      action,
    });
  }

  async getChat(chatId: number | string): Promise<TelegramChat> {
    return this.request<TelegramChat>('getChat', {
      chat_id: chatId,
    });
  }

  async sendPhoto(chatId: number | string, photoUrl: string, caption?: string): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
    });
  }

  async sendDocument(chatId: number | string, documentUrl: string, caption?: string): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendDocument', {
      chat_id: chatId,
      document: documentUrl,
      caption,
    });
  }

  /** Get file info by file_id — returns file_path for download */
  async getFile(fileId: string): Promise<{ file_id: string; file_unique_id: string; file_size?: number; file_path?: string }> {
    return this.request<{ file_id: string; file_unique_id: string; file_size?: number; file_path?: string }>('getFile', {
      file_id: fileId,
    });
  }

  /** Download a file and return its raw buffer + content-type */
  async downloadFileAsBuffer(filePath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const url = `${TELEGRAM_API}/file/bot${this.botToken}/${filePath}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'audio/ogg',
    };
  }

  /** Download a file by file_path and return as base64 data URL */
  async downloadFileAsDataUrl(filePath: string): Promise<string> {
    const url = `${TELEGRAM_API}/file/bot${this.botToken}/${filePath}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  }
}
