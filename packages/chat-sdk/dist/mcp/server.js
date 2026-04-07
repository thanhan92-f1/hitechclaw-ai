// ============================================================
// @hitechclaw/chat-sdk/mcp — MCP Server for HiTechClaw Chat SDK
// ============================================================
//
// Exposes HiTechClaw Chat SDK as MCP tools so any AI agent (Claude,
// Copilot, etc.) can interact with HiTechClaw programmatically.
//
// Usage:
//   HITECHCLAW_BASE_URL=https://api.hitechclaw.io HITECHCLAW_TOKEN=... npx @hitechclaw/chat-sdk mcp
//
//   Or in MCP config:
//   { "command": "npx", "args": ["@hitechclaw/chat-sdk", "mcp"], "env": { ... } }
//
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
export function createMcpServer(client) {
    const server = new McpServer({
        name: 'hitechclaw-chat-sdk',
        version: '1.0.0',
    });
    // ─── Tool: chat ─────────────────────────────────────────
    server.tool('hitechclaw_chat', 'Send a message to HiTechClaw AI agent and get a response. Supports domain specialization and web search.', {
        message: z.string().describe('The message to send to the AI agent'),
        sessionId: z.string().optional().describe('Session ID for conversation continuity. Omit to auto-generate.'),
        domainId: z.string().optional().describe('Domain specialization (e.g., "healthcare", "developer", "finance")'),
        webSearch: z.boolean().optional().describe('Enable web search for real-time information'),
    }, async ({ message, sessionId, domainId, webSearch }) => {
        const res = await client.chat(message, { sessionId, domainId, webSearch });
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        sessionId: res.sessionId,
                        response: res.content,
                        usage: res.usage,
                    }, null, 2),
                },
            ],
        };
    });
    // ─── Tool: chat_stream ──────────────────────────────────
    server.tool('hitechclaw_chat_stream', 'Send a message with streaming response. Returns the complete response after streaming finishes.', {
        message: z.string().describe('The message to send'),
        sessionId: z.string().optional().describe('Session ID'),
        domainId: z.string().optional().describe('Domain specialization'),
        webSearch: z.boolean().optional().describe('Enable web search'),
    }, async ({ message, sessionId, domainId, webSearch }) => {
        const events = [];
        const handle = client.chatStream(message, {
            onMeta: (key, data) => events.push({ type: 'meta', key, data }),
            onError: (error) => events.push({ type: 'error', error }),
        }, { sessionId, domainId, webSearch });
        const fullText = await handle.done;
        const allEvents = await handle.events;
        const finishEvent = allEvents.find(e => e.type === 'finish');
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        response: fullText,
                        usage: finishEvent?.type === 'finish' ? finishEvent.usage : undefined,
                        toolCalls: allEvents
                            .filter(e => e.type === 'tool-call-start')
                            .map(e => e.type === 'tool-call-start' ? e.toolName : ''),
                        meta: Object.fromEntries(allEvents
                            .filter((e) => e.type === 'meta')
                            .map(e => [e.key, e.data])),
                    }, null, 2),
                },
            ],
        };
    });
    // ─── Tool: list_sessions ────────────────────────────────
    server.tool('hitechclaw_list_sessions', 'List all chat sessions for the authenticated user.', {}, async () => {
        const res = await client.listSessions();
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(res, null, 2),
                }],
        };
    });
    // ─── Tool: get_messages ─────────────────────────────────
    server.tool('hitechclaw_get_messages', 'Get all messages in a specific chat session.', {
        sessionId: z.string().describe('The session ID to retrieve messages for'),
    }, async ({ sessionId }) => {
        const res = await client.getMessages(sessionId);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(res.messages, null, 2),
                }],
        };
    });
    // ─── Tool: delete_session ───────────────────────────────
    server.tool('hitechclaw_delete_session', 'Delete a chat session and all its messages.', {
        sessionId: z.string().describe('The session ID to delete'),
    }, async ({ sessionId }) => {
        await client.deleteSession(sessionId);
        return {
            content: [{
                    type: 'text',
                    text: `Session ${sessionId} deleted successfully.`,
                }],
        };
    });
    // ─── Tool: feedback ─────────────────────────────────────
    server.tool('hitechclaw_feedback', 'Submit a correction/feedback for an AI response to improve future answers (self-learning).', {
        originalQuestion: z.string().describe('The original user question'),
        aiAnswer: z.string().describe('The AI answer to give feedback on'),
        feedback: z.enum(['positive', 'negative']).describe('Whether the answer was good or bad'),
        correction: z.string().optional().describe('The correct answer (for negative feedback)'),
    }, async ({ originalQuestion, aiAnswer, feedback, correction }) => {
        await client.feedback({ originalQuestion, aiAnswer, feedback: feedback, correction });
        return {
            content: [{
                    type: 'text',
                    text: 'Feedback submitted successfully. The AI will learn from this correction.',
                }],
        };
    });
    // ─── Tool: login ────────────────────────────────────────
    server.tool('hitechclaw_login', 'Authenticate with HiTechClaw server and get an access token.', {
        email: z.string().email().describe('User email'),
        password: z.string().describe('User password'),
    }, async ({ email, password }) => {
        const res = await client.login({ email, password });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        message: 'Login successful',
                        user: res.user,
                        note: 'Token has been stored in the client. You can now use other tools.',
                    }, null, 2),
                }],
        };
    });
    // ─── Resource: SDK Documentation ────────────────────────
    server.resource('sdk-docs', 'hitechclaw://docs/chat-sdk', async () => ({
        contents: [{
                uri: 'hitechclaw://docs/chat-sdk',
                mimeType: 'text/markdown',
                text: SDK_DOCS,
            }],
    }));
    return server;
}
const SDK_DOCS = `# @hitechclaw/chat-sdk — API Reference

## Available MCP Tools

### hitechclaw_chat
Send a message and get a complete response.
- \`message\` (required): The user message
- \`sessionId\` (optional): For conversation continuity
- \`domainId\` (optional): Domain specialization (healthcare, developer, finance, etc.)
- \`webSearch\` (optional): Enable real-time web search

### hitechclaw_chat_stream
Send a message with streaming. Returns complete response after stream finishes.
Same parameters as hitechclaw_chat.

### hitechclaw_list_sessions
List all chat sessions. No parameters.

### hitechclaw_get_messages
Get messages in a session.
- \`sessionId\` (required): Session ID

### hitechclaw_delete_session
Delete a session.
- \`sessionId\` (required): Session ID

### hitechclaw_feedback
Submit correction feedback for AI self-learning.
- \`messageId\`, \`correction\`, \`sessionId\` (all required)

### hitechclaw_login
Authenticate with credentials.
- \`email\`, \`password\` (required)

## Domains
Available domains: general, developer, healthcare, finance, legal, education,
marketing, hr, customer-service, devops, data-analyst, creative

## Chat Protocol
- SSE streaming with event types: text-delta, tool-call-start/args/end, tool-result, meta, finish, error
- Sessions persist conversation history
- RAG context automatically included when relevant knowledge base entries exist
`;
export { createMcpServer as default };
//# sourceMappingURL=server.js.map