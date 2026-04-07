import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const TELEGRAM_API = 'https://api.telegram.org';
async function telegramRequest(botToken, method, params) {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!data.ok)
        throw new Error(data.description || 'Telegram API error');
    return data.result;
}
export const telegramApiIntegration = defineIntegration({
    id: 'telegram-api',
    name: 'Telegram API',
    description: 'Send messages, manage groups and channels via Telegram Bot API',
    icon: '✈️',
    category: 'messaging',
    auth: {
        type: 'api-key',
        fields: [
            {
                key: 'botToken',
                label: 'Bot Token',
                type: 'secret',
                required: true,
                envVar: 'TELEGRAM_BOT_TOKEN',
                placeholder: '123456:ABC-DEF...',
            },
        ],
    },
    actions: [
        {
            name: 'send_message',
            description: 'Send a text message to a Telegram chat',
            parameters: z.object({
                chatId: z.string().describe('Chat ID or @username'),
                text: z.string().describe('Message text (supports Markdown)'),
                parseMode: z.enum(['Markdown', 'MarkdownV2', 'HTML']).default('MarkdownV2'),
                disableNotification: z.boolean().optional(),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const { chatId, text, parseMode, disableNotification } = args;
                try {
                    const result = await telegramRequest(ctx.credentials.botToken, 'sendMessage', {
                        chat_id: chatId,
                        text,
                        parse_mode: parseMode,
                        disable_notification: disableNotification,
                    });
                    return { success: true, data: result };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Send message failed' };
                }
            },
        },
        {
            name: 'send_photo',
            description: 'Send a photo to a Telegram chat',
            parameters: z.object({
                chatId: z.string(),
                photoUrl: z.string().url().describe('Photo URL'),
                caption: z.string().optional(),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const { chatId, photoUrl, caption } = args;
                try {
                    const result = await telegramRequest(ctx.credentials.botToken, 'sendPhoto', {
                        chat_id: chatId,
                        photo: photoUrl,
                        caption,
                    });
                    return { success: true, data: result };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Send photo failed' };
                }
            },
        },
        {
            name: 'send_document',
            description: 'Send a document/file to a Telegram chat',
            parameters: z.object({
                chatId: z.string(),
                documentUrl: z.string().url().describe('Document URL'),
                caption: z.string().optional(),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const { chatId, documentUrl, caption } = args;
                try {
                    const result = await telegramRequest(ctx.credentials.botToken, 'sendDocument', {
                        chat_id: chatId,
                        document: documentUrl,
                        caption,
                    });
                    return { success: true, data: result };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Send document failed' };
                }
            },
        },
        {
            name: 'get_chat_info',
            description: 'Get information about a Telegram chat',
            parameters: z.object({
                chatId: z.string().describe('Chat ID or @username'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const { chatId } = args;
                try {
                    const result = await telegramRequest(ctx.credentials.botToken, 'getChat', {
                        chat_id: chatId,
                    });
                    return { success: true, data: result };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Get chat info failed' };
                }
            },
        },
    ],
    triggers: [
        {
            name: 'new_message',
            description: 'Fires when a new message is received in bot chat',
            eventSchema: z.object({
                messageId: z.number(),
                chatId: z.number(),
                from: z.object({
                    id: z.number(),
                    username: z.string().optional(),
                    firstName: z.string(),
                }),
                text: z.string(),
                date: z.number(),
            }),
        },
    ],
});
