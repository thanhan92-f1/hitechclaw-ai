import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface DocMcpServerOptions {
    /** Path to the dev-docs directory */
    docsRoot: string;
    /** Server name */
    name?: string;
    /** Server version */
    version?: string;
}
export declare function createDocMcpServer(options: DocMcpServerOptions): McpServer;
//# sourceMappingURL=server.d.ts.map