import type { ToolDefinition, ToolCall, ToolResult } from '@hitechclaw/shared';
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
interface RegisteredTool {
    definition: ToolDefinition;
    handler: ToolHandler;
}
export declare class ToolRegistry {
    private tools;
    register(definition: ToolDefinition, handler: ToolHandler): void;
    unregister(name: string): boolean;
    get(name: string): RegisteredTool | undefined;
    has(name: string): boolean;
    getDefinitions(): ToolDefinition[];
    getDefinition(name: string): ToolDefinition | undefined;
    execute(toolCall: ToolCall): Promise<ToolResult>;
    executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]>;
}
export {};
//# sourceMappingURL=tool-registry.d.ts.map