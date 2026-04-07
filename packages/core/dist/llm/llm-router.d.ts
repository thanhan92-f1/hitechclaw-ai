import type { LLMConfig, LLMMessage, LLMResponse, ResponseFormat, StreamEvent, ToolDefinition } from '@hitechclaw/shared';
export interface LLMAdapter {
    readonly provider: string;
    chat(messages: LLMMessage[], tools?: ToolDefinition[], options?: AdapterOptions): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[], options?: AdapterOptions): AsyncGenerator<StreamEvent>;
}
export interface AdapterOptions {
    responseFormat?: ResponseFormat;
}
/** Hint for automatic model selection when no explicit provider is requested. */
export type TaskComplexity = 'fast' | 'smart' | 'cheap';
export interface ChatOptions {
    /**
     * Override the default provider for this call. If provided the fallback
     * chain is still used when the named provider fails.
     */
    preferProvider?: string;
    /** Hint for automatic model routing when no preferProvider is set. */
    taskComplexity?: TaskComplexity;
    /** Ordered list of provider names to try in sequence. Overrides routing table. */
    fallbackChain?: string[];
    /** Structured output: force text, JSON object, or JSON schema response. */
    responseFormat?: ResponseFormat;
}
export declare class LLMRouter {
    private adapters;
    private config;
    constructor(config: LLMConfig);
    registerAdapter(adapter: LLMAdapter): void;
    setConfig(config: LLMConfig): void;
    getAdapter(provider?: string): LLMAdapter;
    /**
     * Build the ordered provider chain for a call.
     * Priority: explicit fallbackChain > preferProvider (+ routing table) > config.provider
     */
    private resolveChain;
    chat(messages: LLMMessage[], tools?: ToolDefinition[], options?: ChatOptions): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[], options?: ChatOptions): AsyncGenerator<StreamEvent>;
    /** Returns available (registered) providers. */
    getAvailableProviders(): string[];
}
//# sourceMappingURL=llm-router.d.ts.map