import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';
export declare class OpenAIAdapter implements LLMAdapter {
    readonly provider = "openai";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        baseUrl?: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
    private toOpenAIMessage;
    private toOpenAITool;
}
//# sourceMappingURL=openai-adapter.d.ts.map