export class ToolRegistry {
    tools = new Map();
    register(definition, handler) {
        if (this.tools.has(definition.name)) {
            throw new Error(`Tool "${definition.name}" is already registered`);
        }
        this.tools.set(definition.name, { definition, handler });
    }
    unregister(name) {
        return this.tools.delete(name);
    }
    get(name) {
        return this.tools.get(name);
    }
    has(name) {
        return this.tools.has(name);
    }
    getDefinitions() {
        return [...this.tools.values()].map((t) => t.definition);
    }
    getDefinition(name) {
        return this.tools.get(name)?.definition;
    }
    async execute(toolCall) {
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
        }
        catch (err) {
            return {
                toolCallId: toolCall.id,
                success: false,
                result: null,
                error: err instanceof Error ? err.message : String(err),
                duration: Date.now() - start,
            };
        }
    }
    async executeAll(toolCalls) {
        return Promise.all(toolCalls.map((tc) => this.execute(tc)));
    }
}
//# sourceMappingURL=tool-registry.js.map