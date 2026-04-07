import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';
/**
 * DeepSeek adapter — OpenAI-compatible API.
 * Base URL: https://api.deepseek.com
 * Models: deepseek-chat, deepseek-reasoner
 */
export declare class DeepSeekAdapter implements LLMAdapter {
    readonly provider = "deepseek";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * xAI (Grok) adapter — OpenAI-compatible API.
 * Base URL: https://api.x.ai/v1
 * Models: grok-2, grok-2-mini
 */
export declare class XAIAdapter implements LLMAdapter {
    readonly provider = "xai";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * OpenRouter adapter — Unified API gateway for 100+ models.
 * Base URL: https://openrouter.ai/api/v1
 * Models: meta-llama/llama-3.1-70b, google/gemini-pro, etc.
 */
export declare class OpenRouterAdapter implements LLMAdapter {
    readonly provider = "openrouter";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * Perplexity adapter — Search-augmented LLM API.
 * Base URL: https://api.perplexity.ai
 * Models: llama-3.1-sonar-large-128k-online, llama-3.1-sonar-small-128k-online
 */
export declare class PerplexityAdapter implements LLMAdapter {
    readonly provider = "perplexity";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[]): AsyncGenerator<StreamEvent>;
}
/**
 * Groq adapter — Ultra-fast inference via GroqCloud.
 * Base URL: https://api.groq.com/openai/v1
 * Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
 */
export declare class GroqAdapter implements LLMAdapter {
    readonly provider = "groq";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * Mistral adapter — Mistral AI API.
 * Base URL: https://api.mistral.ai/v1
 * Models: mistral-large-latest, mistral-small-latest, codestral-latest
 */
export declare class MistralAdapter implements LLMAdapter {
    readonly provider = "mistral";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * Gemini adapter — Google Gemini via OpenAI-compatible REST endpoint.
 * Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
 * Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
 */
export declare class GeminiAdapter implements LLMAdapter {
    readonly provider = "gemini";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
/**
 * HuggingFace adapter — OpenAI-compatible Inference API.
 * Base URL: https://api-inference.huggingface.co/v1/
 * Models: meta-llama/Llama-3.1-70B-Instruct, mistralai/Mixtral-8x7B-Instruct-v0.1, etc.
 */
export declare class HuggingFaceAdapter implements LLMAdapter {
    readonly provider = "huggingface";
    private client;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        apiKey?: string;
        model?: string;
        baseUrl?: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}
//# sourceMappingURL=openai-compatible-adapters.d.ts.map