import type { Attachment, ChannelPlugin, IncomingMessage, OutgoingMessage } from '@hitechclaw/shared';
import type { TelegramMessage, TelegramUpdate, TelegramVoice } from './telegram-api.js';
import { TelegramApi } from './telegram-api.js';

export interface TelegramChannelConfig {
  botToken: string;
  /** Bot username (without @), auto-detected from getMe */
  botUsername?: string;
  /** Polling interval in ms when no updates (default: 1000) */
  pollInterval?: number;
}

export class TelegramChannel implements ChannelPlugin {
  readonly id = 'telegram-channel';
  readonly platform = 'telegram' as const;
  readonly name = 'Telegram Channel';
  readonly version = '2.0.0';

  private api!: TelegramApi;
  private config!: TelegramChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;
  private offset = 0;
  private pollTimer?: ReturnType<typeof setTimeout>;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const botToken = config.botToken as string;
    if (!botToken) {
      throw new Error('TelegramChannel: botToken is required');
    }

    this.api = new TelegramApi(botToken);

    // Verify bot token & get bot username
    const me = await this.api.getMe();
    this.config = {
      botToken,
      botUsername: me.username,
      pollInterval: (config.pollInterval as number) || 1000,
    };
    console.log(`   Telegram:  connected as @${me.username} (${me.first_name})`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Telegram:  polling started');
    this.poll();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    console.log('   Telegram:  polling stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const chatId = message.channelId;
    const replyToId = message.replyTo ? parseInt(message.replyTo, 10) : undefined;

    // Split long messages (Telegram limit: 4096 chars)
    const chunks = this.splitMessage(message.content, 4096);
    for (const chunk of chunks) {
      await this.api.sendMessage(chatId, chunk, {
        replyToMessageId: replyToId,
      });
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /** Get the underlying API for direct calls */
  getApi(): TelegramApi {
    return this.api;
  }

  // ─── Private ────────────────────────────────────────────

  private poll(): void {
    if (!this.running) return;

    this.api.getUpdates(this.offset, 30)
      .then((updates) => this.handleUpdates(updates))
      .catch((err) => {
        console.error('Telegram polling error:', err instanceof Error ? err.message : err);
      })
      .finally(() => {
        if (this.running) {
          this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval || 1000);
        }
      });
  }

  private async handleUpdates(updates: TelegramUpdate[]): Promise<void> {
    for (const update of updates) {
      this.offset = update.update_id + 1;

      const msg = update.message;
      if (!msg || msg.from?.is_bot) continue;

      // Must have text, photo, image doc, or voice/audio
      const hasText = !!msg.text;
      const hasPhoto = !!msg.photo?.length;
      const hasImageDoc = !!msg.document && msg.document.mime_type?.startsWith('image/');
      const hasVoice = !!(msg.voice || msg.audio);
      if (!hasText && !hasPhoto && !hasImageDoc && !hasVoice) continue;

      // In groups: only respond when mentioned or replied to the bot
      if (msg.chat.type !== 'private' && !this.isBotAddressed(msg)) continue;

      // Use caption for photo messages, text otherwise
      const rawText = msg.text || msg.caption || '';
      const cleanText = this.stripBotMention(rawText);

      // Text-only messages need non-empty content
      if (!hasPhoto && !hasImageDoc && !hasVoice && !cleanText.trim()) continue;

      // Transcribe voice/audio messages → treat as text
      let voiceTranscript = '';
      let voiceDuration = 0;
      if (hasVoice) {
        const voiceInfo = (msg.voice || msg.audio) as TelegramVoice;
        voiceDuration = voiceInfo.duration;
        try {
          this.api.sendChatAction(msg.chat.id, 'typing').catch(() => {});
          const file = await this.api.getFile(voiceInfo.file_id);
          if (file.file_path) {
            const { buffer, contentType } = await this.api.downloadFileAsBuffer(file.file_path);
            voiceTranscript = await this.transcribeAudio(buffer, contentType);
          }
        } catch (err) {
          console.warn('Telegram: voice transcription failed:', err instanceof Error ? err.message : err);
          // Fall through — we'll reply with an error prompt naturally
        }
        // If transcription failed, let it pass through as empty → agent will see it
        if (!voiceTranscript && !cleanText.trim()) {
          await this.api.sendMessage(msg.chat.id, '🎙️ Xin lỗi, không thể chuyển đổi giọng nói. Vui lòng nhắn tin.', {
            replyToMessageId: msg.message_id,
          }).catch(() => {});
          continue;
        }
      }

      // Download photo/image attachments
      const attachments: Attachment[] = [];
      if (hasPhoto) {
        try {
          // Pick largest photo (last in array)
          const largest = msg.photo![msg.photo!.length - 1];
          const file = await this.api.getFile(largest.file_id);
          if (file.file_path) {
            const dataUrl = await this.api.downloadFileAsDataUrl(file.file_path);
            attachments.push({
              type: 'image',
              url: dataUrl,
              name: file.file_path.split('/').pop() || 'photo.jpg',
              mimeType: 'image/jpeg',
              size: largest.file_size || 0,
            });
          }
        } catch (err) {
          console.warn('Telegram: failed to download photo:', err instanceof Error ? err.message : err);
        }
      }
      if (hasImageDoc && msg.document) {
        try {
          const file = await this.api.getFile(msg.document.file_id);
          if (file.file_path) {
            const dataUrl = await this.api.downloadFileAsDataUrl(file.file_path);
            attachments.push({
              type: 'image',
              url: dataUrl,
              name: msg.document.file_name || 'document.jpg',
              mimeType: msg.document.mime_type || 'image/jpeg',
              size: msg.document.file_size || 0,
            });
          }
        } catch (err) {
          console.warn('Telegram: failed to download document image:', err instanceof Error ? err.message : err);
        }
      }

      // Convert to IncomingMessage
      const finalContent = hasVoice && voiceTranscript
        ? (cleanText ? `${cleanText} [Voice: ${voiceTranscript}]` : voiceTranscript)
        : cleanText || (attachments.length ? '[Image]' : '');

      const incoming: IncomingMessage = {
        platform: 'telegram',
        channelId: String(msg.chat.id),
        userId: String(msg.from?.id || 0),
        content: finalContent,
        attachments: attachments.length ? attachments : undefined,
        timestamp: new Date(msg.date * 1000).toISOString(),
        replyTo: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
        metadata: {
          messageId: msg.message_id,
          chatType: msg.chat.type,
          chatTitle: msg.chat.title,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          lastName: msg.from?.last_name,
          ...(hasVoice ? { voiceTranscription: true, voiceDuration } : {}),
        },
      };

      // Show typing indicator
      this.api.sendChatAction(msg.chat.id, 'typing').catch(() => {});

      // Process message
      if (this.messageHandler) {
        try {
          await this.messageHandler(incoming);
        } catch (err) {
          console.error('Telegram message handler error:', err instanceof Error ? err.message : err);
          // Send error feedback to user
          await this.api.sendMessage(msg.chat.id, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.', {
            replyToMessageId: msg.message_id,
          }).catch(() => {});
        }
      }
    }
  }

  /** Check if the message is directed at the bot (mention, reply, or command) */
  private isBotAddressed(msg: TelegramMessage): boolean {
    // Reply to a bot message
    if (msg.reply_to_message?.from?.is_bot && msg.reply_to_message.from.username === this.config.botUsername) {
      return true;
    }
    // @mention the bot (in text or caption)
    const allEntities = [...(msg.entities || []), ...(msg.caption_entities || [])];
    const fullText = msg.text || msg.caption || '';
    if (allEntities.some((e) =>
      e.type === 'mention' && fullText.substring(e.offset, e.offset + e.length).toLowerCase() === `@${this.config.botUsername?.toLowerCase()}`
    )) {
      return true;
    }
    // Bot command (e.g. /ask@xdev_hitechclaw_ai_bot)
    if (allEntities.some((e) => e.type === 'bot_command')) {
      return true;
    }
    return false;
  }

  /** Remove @bot_username from message text */
  private stripBotMention(text: string): string {
    if (!this.config.botUsername) return text;
    return text.replace(new RegExp(`@${this.config.botUsername}`, 'gi'), '').trim();
  }

  /**
   * Transcribe an audio buffer to text.
   * Uses OpenAI Whisper first (if OPENAI_API_KEY is set), then falls back to Ollama whisper.
   */
  private async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'ogg';
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: mimeType });
    const file = new File([blob], `voice.${ext}`, { type: mimeType });

    // Try OpenAI Whisper
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json() as { text: string };
        return data.text.trim();
      }
    }

    // Fallback: Groq Whisper API (free tier, fast)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json() as { text: string };
        return data.text.trim();
      }
    }

    // No transcription provider available — return placeholder so message still processes
    throw new Error('No voice transcription provider available. Set OPENAI_API_KEY or GROQ_API_KEY in .env');
  }

  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Try to split at newline
      let splitIdx = remaining.lastIndexOf('\n', maxLen);
      if (splitIdx <= 0) splitIdx = maxLen;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).replace(/^\n/, '');
    }
    return chunks;
  }
}
