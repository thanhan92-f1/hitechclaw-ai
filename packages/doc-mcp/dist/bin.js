#!/usr/bin/env node
// ============================================================
// @hitechclaw/doc-mcp — Standalone MCP Server Entry Point
// ============================================================
//
// Run:  npx @hitechclaw/doc-mcp
//       DOCS_ROOT=/path/to/docs node dist/bin.js
//
// Environment:
//   DOCS_ROOT — Path to the dev-docs directory (default: ./data/dev-docs)
//
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolve } from 'node:path';
import { createDocMcpServer } from './server.js';
const docsRoot = resolve(process.env['DOCS_ROOT'] || './data/dev-docs');
const server = createDocMcpServer({ docsRoot });
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=bin.js.map