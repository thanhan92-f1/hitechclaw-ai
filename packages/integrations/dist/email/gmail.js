import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
async function gmailRequest(method, path, accessToken, body, params) {
    const url = new URL(`${GMAIL}${path}`);
    if (params)
        for (const [k, v] of Object.entries(params))
            if (v)
                url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail API error ${res.status}: ${err}`);
    }
    if (res.status === 204)
        return {};
    return res.json();
}
function buildMimeMessage(to, subject, body, cc, bcc) {
    const lines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        ...((cc === null || cc === void 0 ? void 0 : cc.length) ? [`Cc: ${cc.join(', ')}`] : []),
        ...((bcc === null || bcc === void 0 ? void 0 : bcc.length) ? [`Bcc: ${bcc.join(', ')}`] : []),
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        body,
    ];
    const raw = lines.join('\r\n');
    return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const gmailIntegration = defineIntegration({
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and manage emails with Gmail',
    icon: '📧',
    category: 'email',
    auth: {
        type: 'oauth2',
        config: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify',
            ],
            clientIdEnv: 'GOOGLE_CLIENT_ID',
            clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
            refreshable: true,
        },
    },
    actions: [
        {
            name: 'send_email',
            description: 'Send an email via Gmail',
            parameters: z.object({
                to: z.string().email().describe('Recipient email address'),
                subject: z.string().describe('Email subject'),
                body: z.string().describe('Email body (HTML or plain text)'),
                cc: z.array(z.string().email()).optional().describe('CC recipients'),
                bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
            }),
            riskLevel: 'moderate',
            requiresApproval: true,
            execute: async (args, ctx) => {
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Gmail access token not configured' };
                try {
                    const raw = buildMimeMessage(args.to, args.subject, args.body, args.cc, args.bcc);
                    const data = await gmailRequest('POST', '/messages/send', accessToken, { raw });
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Gmail send_email failed' };
                }
            },
        },
        {
            name: 'read_emails',
            description: 'Read recent emails from Gmail inbox',
            parameters: z.object({
                query: z.string().optional().describe('Gmail search query (e.g., "from:boss is:unread")'),
                maxResults: z.number().default(10).describe('Maximum number of emails to return'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                var _a;
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Gmail access token not configured' };
                try {
                    const params = { maxResults: String(args.maxResults) };
                    if (args.query)
                        params.q = args.query;
                    const list = await gmailRequest('GET', '/messages', accessToken, undefined, params);
                    const messageIds = (_a = list.messages) !== null && _a !== void 0 ? _a : [];
                    const messages = await Promise.all(messageIds.slice(0, 10).map(async ({ id }) => {
                        const msg = await gmailRequest('GET', `/messages/${id}`, accessToken, undefined, {
                            format: 'metadata',
                            metadataHeaders: 'From',
                        });
                        return msg;
                    }));
                    return { success: true, data: { messages, resultSizeEstimate: list.resultSizeEstimate } };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Gmail read_emails failed' };
                }
            },
        },
        {
            name: 'create_draft',
            description: 'Create a draft email in Gmail',
            parameters: z.object({
                to: z.string().email().describe('Recipient email'),
                subject: z.string().describe('Email subject'),
                body: z.string().describe('Email body'),
            }),
            riskLevel: 'safe',
            execute: async (args, ctx) => {
                const accessToken = ctx.credentials.access_token;
                if (!accessToken)
                    return { success: false, error: 'Gmail access token not configured' };
                try {
                    const raw = buildMimeMessage(args.to, args.subject, args.body);
                    const data = await gmailRequest('POST', '/drafts', accessToken, { message: { raw } });
                    return { success: true, data };
                }
                catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Gmail create_draft failed' };
                }
            },
        },
    ],
    triggers: [
        {
            name: 'new_email',
            description: 'Fires when a new email arrives in the inbox',
            eventSchema: z.object({
                messageId: z.string(),
                from: z.string(),
                subject: z.string(),
                snippet: z.string(),
                receivedAt: z.string(),
            }),
            pollInterval: 30000,
            poll: async (lastPollTime, credentials) => {
                var _a;
                const accessToken = credentials.access_token;
                if (!accessToken)
                    return [];
                try {
                    const since = lastPollTime.toISOString();
                    const params = { maxResults: '10', q: `after:${Math.floor(lastPollTime.getTime() / 1000)}` };
                    const list = await gmailRequest('GET', '/messages', accessToken, undefined, params);
                    const messageIds = (_a = list.messages) !== null && _a !== void 0 ? _a : [];
                    return await Promise.all(messageIds.map(async ({ id }) => {
                        var _a, _b, _c;
                        const msg = await gmailRequest('GET', `/messages/${id}`, accessToken, undefined, {
                            format: 'metadata',
                            metadataHeaders: 'From,Subject,Date',
                        });
                        const headers = (_b = (_a = msg.payload) === null || _a === void 0 ? void 0 : _a.headers) !== null && _b !== void 0 ? _b : [];
                        const getHeader = (name) => { var _a, _b; return (_b = (_a = headers.find(h => h.name === name)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : ''; };
                        return {
                            integrationId: 'gmail',
                            triggerName: 'new_email',
                            data: {
                                messageId: id,
                                from: getHeader('From'),
                                subject: getHeader('Subject'),
                                snippet: (_c = msg.snippet) !== null && _c !== void 0 ? _c : '',
                                receivedAt: getHeader('Date') || since,
                            },
                            timestamp: new Date(),
                        };
                    }));
                }
                catch (_b) {
                    return [];
                }
            },
        },
    ],
});
