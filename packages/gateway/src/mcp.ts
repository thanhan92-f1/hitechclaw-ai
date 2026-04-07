import { Hono } from 'hono';
import type { DomainPack } from '@hitechclaw/domains';
import type { Agent } from '@hitechclaw/core';
import { MCPClientManager, type MCPServerConfig } from './mcp-client.js';

// ─── MCP Server Registry ────────────────────────────────────
// Manages real connections to external MCP servers (chrome-devtools, github, etc.)
// Spawns child processes, registers tools with the Agent's ToolRegistry

// Singleton MCP client manager
const mcpManager = new MCPClientManager();

// In-memory MCP server registry
const mcpServers: MCPServerConfig[] = [
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
    enabled: false,
    status: 'disconnected',
    toolCount: 0,
    description: 'Control Chrome browser: navigate, click, screenshot, evaluate JS, network inspection',
  },
  {
    id: 'github',
    name: 'GitHub',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    enabled: false,
    status: 'disconnected',
    toolCount: 0,
    description: 'GitHub integration: repos, issues, PRs, code search, branch management',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-postgres', 'postgresql://localhost:5432/hitechclaw'],
    enabled: false,
    status: 'disconnected',
    toolCount: 0,
    description: 'Query PostgreSQL databases, inspect schemas, run migrations',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    enabled: false,
    status: 'disconnected',
    toolCount: 0,
    description: 'Read/write files, list directories, search for files',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-brave-search'],
    enabled: false,
    status: 'disconnected',
    toolCount: 0,
    description: 'Anthropic MCP adapter: web search via Brave Search API',
  },
];

// Custom user-added MCP servers
const customMcpServers: MCPServerConfig[] = [];

function getAllServers(): MCPServerConfig[] {
  return [...mcpServers, ...customMcpServers];
}

export function createMCPRoutes(domainPacks?: DomainPack[], agent?: Agent) {
  // Wire up the ToolRegistry so MCP tools become available to the agent
  if (agent) {
    mcpManager.setToolRegistry(agent.tools);
  }

  const app = new Hono();

  // ─── MCP Server Management ──────────────────────────────

  // GET /mcp/servers — List all registered MCP servers
  app.get('/servers', (c) => {
    return c.json({
      servers: getAllServers(),
      total: getAllServers().length,
      connected: getAllServers().filter((s) => s.status === 'connected').length,
    });
  });

  // GET /mcp/servers/:id — Get a single MCP server config
  app.get('/servers/:id', (c) => {
    const id = c.req.param('id');
    const server = getAllServers().find((s) => s.id === id);
    if (!server) return c.json({ error: 'MCP server not found' }, 404);
    return c.json(server);
  });

  // POST /mcp/servers — Register a new custom MCP server
  app.post('/servers', async (c) => {
    const body = await c.req.json<{
      name: string;
      type: 'stdio' | 'sse' | 'http';
      command?: string;
      args?: string[];
      url?: string;
      headers?: Record<string, string>;
      description?: string;
    }>();

    if (!body.name || !body.type) {
      return c.json({ error: 'name and type are required' }, 400);
    }

    const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (getAllServers().find((s) => s.id === id)) {
      return c.json({ error: 'Server with this ID already exists' }, 409);
    }

    const server: MCPServerConfig = {
      id,
      name: body.name,
      type: body.type,
      command: body.command,
      args: body.args,
      url: body.url,
      headers: body.headers,
      enabled: false,
      status: 'disconnected',
      toolCount: 0,
      description: body.description || '',
    };
    customMcpServers.push(server);
    return c.json({ ok: true, server }, 201);
  });

  // PUT /mcp/servers/:id/toggle — Enable/disable an MCP server (real connection)
  app.put('/servers/:id/toggle', async (c) => {
    const id = c.req.param('id');
    const server = getAllServers().find((s) => s.id === id);
    if (!server) return c.json({ error: 'MCP server not found' }, 404);

    if (server.enabled) {
      // Disconnect
      await mcpManager.disconnect(server.id);
      server.enabled = false;
      server.status = 'disconnected';
      server.toolCount = 0;
      server.lastPing = undefined;
      server.error = undefined;
      console.log(`🔌 MCP server "${server.name}" disconnected`);
      return c.json({ ok: true, server });
    }

    // Connect — spawn real MCP subprocess
    try {
      const result = await mcpManager.connect(server);
      server.enabled = true;
      server.status = 'connected';
      server.toolCount = result.tools.length;
      server.lastPing = new Date().toISOString();
      server.error = undefined;
      console.log(`✅ MCP server "${server.name}" connected with ${result.tools.length} tools: ${result.tools.join(', ')}`);
      return c.json({ ok: true, server, tools: result.tools });
    } catch (err: any) {
      server.enabled = false;
      server.status = 'error';
      server.error = err.message || 'Connection failed';
      console.error(`❌ MCP server "${server.name}" connection failed:`, err.message);
      return c.json({ ok: false, error: err.message, server }, 500);
    }
  });

  // DELETE /mcp/servers/:id — Remove a custom MCP server
  app.delete('/servers/:id', async (c) => {
    const id = c.req.param('id');
    // Can only delete custom servers
    if (mcpServers.find((s) => s.id === id)) {
      return c.json({ error: 'Cannot delete built-in MCP server' }, 400);
    }
    const idx = customMcpServers.findIndex((s) => s.id === id);
    if (idx === -1) return c.json({ error: 'MCP server not found' }, 404);
    // Disconnect if connected
    await mcpManager.disconnect(id);
    customMcpServers.splice(idx, 1);
    return c.json({ ok: true });
  });

  // GET /mcp/servers/:id/tools — List tools from a connected MCP server
  app.get('/servers/:id/tools', (c) => {
    const id = c.req.param('id');
    const server = getAllServers().find((s) => s.id === id);
    if (!server) return c.json({ error: 'MCP server not found' }, 404);
    if (!mcpManager.isConnected(id)) {
      return c.json({ error: 'Server is not connected' }, 400);
    }
    const tools = mcpManager.getServerTools(id);
    return c.json({ tools, total: tools.length });
  });

  // ─── MCP HiTechClaw Tool Exposure ────────────────────────────
  // Expose HiTechClaw domain tools as MCP-compatible format

  // GET /mcp/tools — List all available tools in MCP format
  app.get('/tools', (c) => {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      domain: string;
      skill: string;
    }> = [];

    if (domainPacks) {
      for (const domain of domainPacks) {
        for (const skill of domain.skills) {
          for (const tool of skill.tools) {
            tools.push({
              name: `${domain.id}__${skill.id}__${tool.name}`,
              description: `[${domain.name}/${skill.name}] ${tool.description}`,
              inputSchema: tool.parameters || { type: 'object', properties: {} },
              domain: domain.id,
              skill: skill.id,
            });
          }
        }
      }
    }

    return c.json({ tools, total: tools.length });
  });

  // POST /mcp/tools/call — Call a tool in MCP format
  app.post('/tools/call', async (c) => {
    const body = await c.req.json<{ name: string; arguments?: Record<string, unknown> }>();
    if (!body.name) return c.json({ error: 'Tool name is required' }, 400);

    // Parse tool name: domain__skill__toolName
    const parts = body.name.split('__');
    if (parts.length !== 3) {
      return c.json({ error: 'Invalid tool name format. Expected: domain__skill__toolName' }, 400);
    }
    const [domainId, skillId, toolName] = parts;

    if (!domainPacks) return c.json({ error: 'No domain packs loaded' }, 500);

    const domain = domainPacks.find((d) => d.id === domainId);
    if (!domain) return c.json({ error: `Domain '${domainId}' not found` }, 404);

    const skill = domain.skills.find((s) => s.id === skillId);
    if (!skill) return c.json({ error: `Skill '${skillId}' not found` }, 404);

    const tool = skill.tools.find((t) => t.name === toolName);
    if (!tool) return c.json({ error: `Tool '${toolName}' not found` }, 404);

    try {
      const result = await tool.execute(body.arguments || {});
      return c.json({
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      });
    } catch (err: any) {
      return c.json({
        content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
        isError: true,
      }, 500);
    }
  });

  // ─── MCP Server Info ──────────────────────────────────
  app.get('/info', (c) => {
    return c.json({
      name: 'HiTechClaw',
      version: '2.1.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: {
        name: 'HiTechClaw AI Agent Platform',
        version: '2.1.0',
      },
    });
  });

  return app;
}
