// ============================================================
// MCP Client Manager — Real MCP server connections via stdio, SSE, HTTP
// Spawns child processes or connects to remote servers, lists tools, and executes tool calls
// ============================================================
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// JSON Schema type → ToolParameter type mapping
function jsonSchemaTypeToParam(type) {
    const t = String(type);
    if (t === 'integer' || t === 'number')
        return 'number';
    if (t === 'boolean')
        return 'boolean';
    if (t === 'array')
        return 'array';
    if (t === 'object')
        return 'object';
    return 'string';
}
// Convert JSON Schema properties to ToolParameter[]
function schemaToParams(inputSchema) {
    const props = (inputSchema.properties || {});
    const required = (inputSchema.required || []);
    const params = [];
    for (const [name, schema] of Object.entries(props)) {
        params.push(Object.assign(Object.assign({ name, type: jsonSchemaTypeToParam(schema.type), description: schema.description || '', required: required.includes(name) }, (schema.enum ? { enum: schema.enum } : {})), (schema.default !== undefined ? { default: schema.default } : {})));
    }
    return params;
}
export class MCPClientManager {
    constructor() {
        this.connections = new Map();
        this.toolRegistry = null;
    }
    setToolRegistry(registry) {
        this.toolRegistry = registry;
    }
    /**
     * Connect to an MCP server via stdio, SSE, or HTTP, list its tools, and register them.
     */
    async connect(server) {
        // Disconnect existing connection if any
        if (this.connections.has(server.id)) {
            await this.disconnect(server.id);
        }
        let transport;
        if (server.type === 'stdio') {
            if (!server.command) {
                throw new Error(`stdio MCP server "${server.id}" requires a command`);
            }
            transport = new StdioClientTransport({
                command: server.command,
                args: server.args || [],
                stderr: 'pipe',
            });
        }
        else if (server.type === 'sse') {
            if (!server.url) {
                throw new Error(`SSE MCP server "${server.id}" requires a url`);
            }
            transport = new SSEClientTransport(new URL(server.url), { requestInit: server.headers ? { headers: server.headers } : undefined });
        }
        else if (server.type === 'http') {
            if (!server.url) {
                throw new Error(`HTTP MCP server "${server.id}" requires a url`);
            }
            transport = new StreamableHTTPClientTransport(new URL(server.url), { requestInit: server.headers ? { headers: server.headers } : undefined });
        }
        else {
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
            inputSchema: (t.inputSchema || { type: 'object', properties: {} }),
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
                const definition = {
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
    async callTool(serverId, toolName, args) {
        const conn = this.connections.get(serverId);
        if (!conn) {
            throw new Error(`MCP server "${serverId}" is not connected`);
        }
        const result = await conn.client.callTool({ name: toolName, arguments: args });
        // Extract text content from MCP result
        if (result.content && Array.isArray(result.content)) {
            const texts = result.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text);
            return texts.length === 1 ? texts[0] : texts.join('\n');
        }
        return result;
    }
    /**
     * Disconnect from an MCP server and unregister its tools.
     */
    async disconnect(serverId) {
        const conn = this.connections.get(serverId);
        if (!conn)
            return;
        // Unregister tools from the ToolRegistry
        if (this.toolRegistry) {
            for (const tool of conn.tools) {
                const toolName = `mcp_${serverId}_${tool.name}`;
                this.toolRegistry.unregister(toolName);
            }
        }
        try {
            await conn.client.close();
        }
        catch (_a) {
            // Ignore close errors
        }
        this.connections.delete(serverId);
    }
    /**
     * Check if a server is connected.
     */
    isConnected(serverId) {
        return this.connections.has(serverId);
    }
    /**
     * Get tools for a connected server.
     */
    getServerTools(serverId) {
        const conn = this.connections.get(serverId);
        if (!conn)
            return [];
        return conn.tools.map((t) => ({ name: t.name, description: t.description }));
    }
    /**
     * Disconnect all servers.
     */
    async disconnectAll() {
        for (const serverId of this.connections.keys()) {
            await this.disconnect(serverId);
        }
    }
}
