import type { DocumentChunk } from './document-processor.js';
export interface HybridSearchResult {
    chunk: DocumentChunk;
    vectorScore: number;
    bm25Score: number;
    combinedScore: number;
    /** Source citation info for display */
    citation: {
        source: string;
        title: string;
        chunkIndex: number;
        excerpt: string;
    };
}
export interface HybridSearchOptions {
    topK?: number;
    /** Weight for vector similarity (0-1). BM25 weight is 1-alpha */
    alpha?: number;
    /** Minimum combined score to include */
    minScore?: number;
    /** Include source citations */
    includeCitations?: boolean;
}
interface BM25Index {
    /** Term → document frequency (how many chunks contain this term) */
    df: Map<string, number>;
    /** Per-chunk term frequency */
    tf: Map<string, Map<string, number>>;
    /** Total number of chunks */
    n: number;
    /** Average document length */
    avgDl: number;
    /** Chunk id → length */
    docLen: Map<string, number>;
}
export declare function buildBM25Index(chunks: DocumentChunk[]): BM25Index;
export declare function bm25Score(query: string, chunkId: string, index: BM25Index): number;
export declare function hybridSearch(query: string, queryEmbedding: number[], chunks: DocumentChunk[], bm25Index: BM25Index, options?: HybridSearchOptions): HybridSearchResult[];
export declare function buildCitationContext(results: HybridSearchResult[]): string;
export {};
//# sourceMappingURL=hybrid-search.d.ts.map