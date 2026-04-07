#!/usr/bin/env node
// ============================================================
// @hitechclaw/chat-sdk MCP Server — Standalone entry point
// ============================================================
//
// Run:  HITECHCLAW_BASE_URL=https://... HITECHCLAW_TOKEN=... npx @hitechclaw/chat-sdk mcp
//       node dist/mcp/bin.js
//
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HiTechClawClient } from '../client.js';
import { createMcpServer } from './server.js';
const baseUrl = process.env['HITECHCLAW_BASE_URL'];
const token = process.env['HITECHCLAW_TOKEN'];
if (!baseUrl) {
    console.error('Error: HITECHCLAW_BASE_URL environment variable is required');
    console.error('Example: HITECHCLAW_BASE_URL=https://api.hitechclaw.io HITECHCLAW_TOKEN=... npx @hitechclaw/chat-sdk mcp');
    process.exit(1);
}
const client = new HiTechClawClient({
    baseUrl,
    token,
});
const server = createMcpServer(client);
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=bin.js.map