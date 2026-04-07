import type { ToolCall, ToolResult, ToolDefinition, SandboxPolicy } from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';
/** Tool handler function type */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
/** Options for sandboxed tool execution */
export interface SandboxedToolOptions {
    /** Tenant ID for sandbox scoping */
    tenantId: string;
    /** Default policy when tool doesn't specify one */
    defaultPolicy: SandboxPolicy;
    /** Pre-created sandbox ID to reuse (pool) */
    reuseSandboxId?: string;
    /** Timeout for sandbox execution (ms) */
    timeoutMs?: number;
}
export declare class SandboxedToolExecutor {
    private readonly manager;
    constructor(manager: SandboxManager);
    /**
     * Execute a tool call, routing to sandbox if required.
     * Falls back to direct execution for tools without sandbox requirements.
     */
    execute(call: ToolCall, definition: ToolDefinition, handler: ToolHandler, options: SandboxedToolOptions): Promise<ToolResult>;
    /**
     * Execute a tool call inside a sandbox container.
     * Serializes the call as JSON, runs node inside sandbox, returns parsed result.
     */
    private executeInSandbox;
    /**
     * Build a scoped policy for a specific tool, merging tool-specific
     * requirements with the default policy.
     */
    private buildToolPolicy;
    /**
     * Escape string for safe shell injection.
     * Replaces single quotes to prevent shell injection.
     */
    private escapeShell;
}
//# sourceMappingURL=sandboxed-tool-executor.d.ts.map