// ============================================================
// MCP Client Manager — Real MCP server connections via stdio, SSE, HTTP
// Spawns child processes or connects to remote servers, lists tools, and executes tool calls
// ============================================================

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ToolDefinition, ToolParameter } from '@hitechclaw/shared';
import type { ToolRegistry } from '@hitechclaw/core';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  lastPing?: string;
  description?: string;
  error?: string;
}

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
}

// JSON Schema type → ToolParameter type mapping
function jsonSchemaTypeToParam(type: unknown): ToolParameter['type'] {
  const t = String(type);
  if (t === 'integer' || t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'array') return 'array';
  if (t === 'object') return 'object';
  return 'string';
}

// Convert JSON Schema properties to ToolParameter[]
function schemaToParams(inputSchema: Record<string, unknown>): ToolParameter[] {
  const props = (inputSchema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = (inputSchema.required || []) as string[];
  const params: ToolParameter[] = [];

  for (const [name, schema] of Object.entries(props)) {
    params.push({
      name,
      type: jsonSchemaTypeToParam(schema.type),
      description: (schema.description as string) || '',
      required: required.includes(name),
      ...(schema.enum ? { enum: schema.enum as string[] } : {}),
      ...(schema.default !== undefined ? { default: schema.default } : {}),
    });
  }

  return params;
}

export class MCPClientManager {
  private connections = new Map<string, MCPConnection>();
  private toolRegistry: ToolRegistry | null = null;

  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry;
  }

  /**
   * Connect to an MCP server via stdio, SSE, or HTTP, list its tools, and register them.
   */
  async connect(server: MCPServerConfig): Promise<{ tools: string[] }> {
    // Disconnect existing connection if any
    if (this.connections.has(server.id)) {
      await this.disconnect(server.id);
    }

    let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;

    if (server.type === 'stdio') {
      if (!server.command) {
        throw new Error(`stdio MCP server "${server.id}" requires a command`);
      }
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args || [],
        stderr: 'pipe',
      });
    } else if (server.type === 'sse') {
      if (!server.url) {
        throw new Error(`SSE MCP server "${server.id}" requires a url`);
      }
      transport = new SSEClientTransport(
        new URL(server.url),
        { requestInit: server.headers ? { headers: server.headers } : undefined },
      );
    } else if (server.type === 'http') {
      if (!server.url) {
        throw new Error(`HTTP MCP server "${server.id}" requires a url`);
      }
      transport = new StreamableHTTPClientTransport(
        new URL(server.url),
        { requestInit: server.headers ? { headers: server.headers } : undefined },
      );
    } else {
      throw new Error(`Unsupported MCP transport type: "${server.type}"`);
    }

    const client = new Client({
      name: 'HiTechClaw',
      version: '2.1.0',
    });

    await client.connect(transport);

    // List available tools from the MCP server
    const toolsResponse = await client.listTools();
    const tools = (toolsResponse.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: (t.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>,
    }));

    this.connections.set(server.id, { client, transport, tools });

    // Register tools with the agent's ToolRegistry
    if (this.toolRegistry) {
      for (const tool of tools) {
        const toolName = `mcp_${server.id}_${tool.name}`;

        // Skip if already registered (from a previous connection)
        if (this.toolRegistry.has(toolName)) {
          this.toolRegistry.unregister(toolName);
        }

        const definition: ToolDefinition = {
          name: toolName,
          description: `[MCP/${server.name}] ${tool.description}`,
          category: `mcp-${server.id}`,
          parameters: schemaToParams(tool.inputSchema),
        };

        // Create handler that calls the MCP server
        const serverId = server.id;
        const originalToolName = tool.name;
        const manager = this;

        this.toolRegistry.register(definition, async (args) => {
          return manager.callTool(serverId, originalToolName, args);
        });
      }
    }

    return { tools: tools.map((t) => t.name) };
  }

  /**
   * Call a tool on a connected MCP server.
   */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error(`MCP server "${serverId}" is not connected`);
    }

    const result = await conn.client.callTool({ name: toolName, arguments: args });

    // Extract text content from MCP result
    if (result.content && Array.isArray(result.content)) {
      const texts = result.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text: string }) => c.text);
      return texts.length === 1 ? texts[0] : texts.join('\n');
    }

    return result;
  }

  /**
   * Disconnect from an MCP server and unregister its tools.
   */
  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    // Unregister tools from the ToolRegistry
    if (this.toolRegistry) {
      for (const tool of conn.tools) {
        const toolName = `mcp_${serverId}_${tool.name}`;
        this.toolRegistry.unregister(toolName);
      }
    }

    try {
      await conn.client.close();
    } catch {
      // Ignore close errors
    }

    this.connections.delete(serverId);
  }

  /**
   * Check if a server is connected.
   */
  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  /**
   * Get tools for a connected server.
   */
  getServerTools(serverId: string): Array<{ name: string; description: string }> {
    const conn = this.connections.get(serverId);
    if (!conn) return [];
    return conn.tools.map((t) => ({ name: t.name, description: t.description }));
  }

  /**
   * Disconnect all servers.
   */
  async disconnectAll(): Promise<void> {
    for (const serverId of this.connections.keys()) {
      await this.disconnect(serverId);
    }
  }
}
