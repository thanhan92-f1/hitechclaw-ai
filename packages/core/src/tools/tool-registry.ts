import type { ToolDefinition, ToolCall, ToolResult } from '@hitechclaw/shared';

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool "${definition.name}" is already registered`);
    }
    this.tools.set(definition.name, { definition, handler });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);
    const start = Date.now();

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        success: false,
        result: null,
        error: `Tool "${toolCall.name}" not found`,
        duration: Date.now() - start,
      };
    }

    try {
      const result = await tool.handler(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        success: true,
        result,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        toolCallId: toolCall.id,
        success: false,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  async executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map((tc) => this.execute(tc)));
  }
}
