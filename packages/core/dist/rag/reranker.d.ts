import type { DocumentChunk } from './document-processor.js';
export interface RerankerResult {
    chunk: DocumentChunk;
    originalScore: number;
    rerankedScore: number;
    rank: number;
}
export interface RerankerOptions {
    topK?: number;
    threshold?: number;
}
/**
 * A cross-encoder style re-ranker that scores query-document pairs
 * using multiple signal features. This is a lightweight local implementation
 * that combines lexical overlap, term frequency, position bias, and
 * semantic similarity signals for improved ranking without external APIs.
 */
export declare class CrossEncoderReranker {
    /**
     * Re-rank a set of search results against a query.
     * Combines multiple scoring signals for better relevance ranking.
     */
    rerank(query: string, results: Array<{
        chunk: DocumentChunk;
        score: number;
    }>, options?: RerankerOptions): RerankerResult[];
    private tokenize;
    private bigrams;
    private jaccardSimilarity;
    private termCoverage;
    private queryTermFrequency;
    private positionBias;
    private phraseMatchBonus;
}
//# sourceMappingURL=reranker.d.ts.map