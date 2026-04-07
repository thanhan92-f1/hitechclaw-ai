import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const SLACK_API = 'https://slack.com/api';
async function slackPost(method, token, body) {
    const res = await fetch(`${SLACK_API}/${method}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
        throw new Error(`Slack HTTP error ${res.status}`);
    const data = await res.json();
    if (!data.ok)
        throw new Error(data.error ?? 'Slack API error');
    return data;
}
export const slackApiIntegration = defineIntegration({
    id: 'slack-api',
    name: 'Slack',
    description: 'Send messages, manage channels, and interact with Slack workspaces',
    icon: '💼',
    category: 'messaging',
    auth: {
        type: 'oauth2',
        config: {
            authorizationUrl: 'https://slack.com/oauth/v2/authorize',
            tokenUrl: 'https://slack.com/api/oauth.v2.access',
            scopes: [
                'chat:write',
                'channels:read',
                'channels:history',
                'users:read',
                'files:write',
            ],
            clientIdEnv: 'SLACK_CLIENT_ID',
            clientSecretEnv: 'SLACK_CLIENT_SECRET',
            refreshable: true,
        },
    },
    actions: [
        {
            name: 'send_message',
            description: 'Send a message to a Slack channel',
            parameters: z.object({
                channel: z.string().describe('Channel ID or name (e.g., #general)'),
                text: z.string().describe('Message text'),
                threadTs: z.string().optional().describe('Thread timestamp for replies'),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const token = ctx.credentials.access_token ?? ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Slack token not configured' };
                try {
                    const body = { channel: args.channel, text: args.text };
                    if (args.threadTs)
                        body.thread_ts = args.threadTs;
                    const data = await slackPost('chat.postMessage', token, body);
                    return { success: true, data: { ts: data.ts, channel: data.channel } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Slack send_message failed' };
                }
            },
        },
        {
            name: 'list_channels',
            description: 'List channels in the Slack workspace',
            parameters: z.object({
                limit: z.number().default(20),
                types: z.string().default('public_channel').describe('Channel types to include'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.access_token ?? ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Slack token not configured' };
                try {
                    const data = await slackPost('conversations.list', token, { limit: args.limit, types: args.types });
                    return { success: true, data: { channels: data.channels } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Slack list_channels failed' };
                }
            },
        },
        {
            name: 'read_messages',
            description: 'Read recent messages from a Slack channel',
            parameters: z.object({
                channel: z.string().describe('Channel ID'),
                limit: z.number().default(20),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const token = ctx.credentials.access_token ?? ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Slack token not configured' };
                try {
                    const data = await slackPost('conversations.history', token, { channel: args.channel, limit: args.limit });
                    return { success: true, data: { messages: data.messages } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Slack read_messages failed' };
                }
            },
        },
        {
            name: 'upload_file',
            description: 'Upload a file to a Slack channel',
            parameters: z.object({
                channels: z.string().describe('Channel ID to share file in'),
                filename: z.string(),
                content: z.string().describe('File content as text'),
                title: z.string().optional(),
            }),
            riskLevel: 'moderate',
            execute: async (args, ctx) => {
                const token = ctx.credentials.access_token ?? ctx.credentials.token;
                if (!token)
                    return { success: false, error: 'Slack token not configured' };
                try {
                    const body = {
                        channels: args.channels,
                        filename: args.filename,
                        content: args.content,
                    };
                    if (args.title)
                        body.title = args.title;
                    const data = await slackPost('files.upload', token, body);
                    return { success: true, data: { file: data.file } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Slack upload_file failed' };
                }
            },
        },
    ],
    triggers: [
        {
            name: 'new_message',
            description: 'Fires when a new message is posted in a channel',
            eventSchema: z.object({
                channel: z.string(),
                user: z.string(),
                text: z.string(),
                ts: z.string(),
                threadTs: z.string().optional(),
            }),
        },
    ],
});
//# sourceMappingURL=slack-api.js.map