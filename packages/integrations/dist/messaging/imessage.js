import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
export const imessageIntegration = defineIntegration({
    id: 'imessage',
    name: 'Apple iMessage',
    description: 'Send and read iMessages (macOS only, via AppleScript/sqlite)',
    icon: '💬',
    category: 'messaging',
    auth: { type: 'none' },
    actions: [
        {
            name: 'send_message',
            description: 'Send an iMessage to a contact',
            parameters: z.object({
                to: z.string().describe('Phone number or Apple ID email'),
                message: z.string().describe('Message content'),
                service: z.enum(['iMessage', 'SMS']).default('iMessage'),
            }),
            riskLevel: 'moderate',
            requiresApproval: true,
            execute: async (args, ctx) => {
                // Uses AppleScript: tell application "Messages" ...
                return { success: false, error: 'iMessage send_message not implemented yet (requires macOS)' };
            },
        },
        {
            name: 'read_recent_messages',
            description: 'Read recent iMessages from a contact or all contacts',
            parameters: z.object({
                from: z.string().optional().describe('Filter by sender phone/email'),
                limit: z.number().default(20),
                hoursBack: z.number().default(24).describe('How many hours back to read'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                // Reads from ~/Library/Messages/chat.db (SQLite)
                return { success: false, error: 'iMessage read_recent_messages not implemented yet (requires macOS)' };
            },
        },
        {
            name: 'list_conversations',
            description: 'List recent iMessage conversations',
            parameters: z.object({
                limit: z.number().default(10),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                return { success: false, error: 'iMessage list_conversations not implemented yet (requires macOS)' };
            },
        },
    ],
    healthCheck: async () => {
        return process.platform === 'darwin';
    },
});
//# sourceMappingURL=imessage.js.map