export interface EmbeddingProvider {
    embed(texts: string[]): Promise<number[][]>;
    dimension: number;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    dimension: number;
    private apiKey;
    private model;
    private baseUrl;
    constructor(opts: {
        apiKey: string;
        model?: string;
        baseUrl?: string;
    });
    embed(texts: string[]): Promise<number[][]>;
}
/**
 * Simple bag-of-words TF-based embedding for local dev.
 * NOT for production — just allows RAG pipeline to work without API keys.
 */
export declare class LocalEmbeddingProvider implements EmbeddingProvider {
    dimension: number;
    embed(texts: string[]): Promise<number[][]>;
    private simpleEmbed;
    private hashString;
}
//# sourceMappingURL=embedding-provider.d.ts.map