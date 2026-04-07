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
export declare class MCPClientManager {
    private connections;
    private toolRegistry;
    setToolRegistry(registry: ToolRegistry): void;
    /**
     * Connect to an MCP server via stdio, SSE, or HTTP, list its tools, and register them.
     */
    connect(server: MCPServerConfig): Promise<{
        tools: string[];
    }>;
    /**
     * Call a tool on a connected MCP server.
     */
    callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
    /**
     * Disconnect from an MCP server and unregister its tools.
     */
    disconnect(serverId: string): Promise<void>;
    /**
     * Check if a server is connected.
     */
    isConnected(serverId: string): boolean;
    /**
     * Get tools for a connected server.
     */
    getServerTools(serverId: string): Array<{
        name: string;
        description: string;
    }>;
    /**
     * Disconnect all servers.
     */
    disconnectAll(): Promise<void>;
}
//# sourceMappingURL=mcp-client.d.ts.map