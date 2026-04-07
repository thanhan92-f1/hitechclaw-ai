import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';
export declare class AnthropicAdapter implements LLMAdapter {
    readonly provider = "anthropic";
    private client;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: {
        apiKey?: string;
        model: string;
        maxTokens?: number;
        temperature?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
    private toAnthropicMessage;
    private toAnthropicTool;
}
//# sourceMappingURL=anthropic-adapter.d.ts.map