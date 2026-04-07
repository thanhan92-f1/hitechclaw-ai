import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';
export interface OllamaModel {
    name: string;
    model: string;
    size: number;
    digest: string;
    modifiedAt: string;
    details: {
        format: string;
        family: string;
        parameterSize: string;
        quantizationLevel: string;
    };
}
export interface OllamaModelInfo {
    name: string;
    parameterSize: string;
    family: string;
    quantization: string;
    sizeMB: number;
}
export interface OllamaHealthStatus {
    running: boolean;
    version?: string;
    models: OllamaModelInfo[];
    gpuAvailable: boolean;
}
export declare class OllamaAdapter implements LLMAdapter {
    readonly provider = "ollama";
    private baseUrl;
    private model;
    private temperature;
    private maxTokens;
    constructor(config: {
        baseUrl?: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
    });
    chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
    chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
    /** Check if Ollama is reachable */
    isRunning(): Promise<boolean>;
    /** Get Ollama version */
    getVersion(): Promise<string | null>;
    /** List all locally available models */
    listModels(): Promise<OllamaModelInfo[]>;
    /** Get full health status */
    getHealthStatus(): Promise<OllamaHealthStatus>;
    /** Pull (download) a model */
    pullModel(modelName: string): AsyncGenerator<{
        status: string;
        completed?: number;
        total?: number;
    }>;
    /** Delete a model */
    deleteModel(modelName: string): Promise<boolean>;
    /** Get model info */
    getModelInfo(modelName: string): Promise<Record<string, unknown> | null>;
    /** Switch the active model */
    setModel(model: string): void;
    getModel(): string;
    getBaseUrl(): string;
    private toOllamaMessage;
    private toOllamaTool;
}
//# sourceMappingURL=ollama-adapter.d.ts.map