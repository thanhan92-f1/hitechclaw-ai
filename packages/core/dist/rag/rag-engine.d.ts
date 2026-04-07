import { type RagDocument, type DocumentChunk, type ChunkingOptions } from './document-processor.js';
import { type EmbeddingProvider } from './embedding-provider.js';
import { type VectorStore, type VectorSearchResult } from './vector-store.js';
import { type CrawlOptions, type CrawlProgress } from './web-crawler.js';
import { type RerankerResult, type RerankerOptions } from './reranker.js';
export interface RagConfig {
    chunkingOptions?: ChunkingOptions;
    topK?: number;
    scoreThreshold?: number;
}
export interface RetrievalResult {
    chunks: VectorSearchResult[];
    context: string;
    query: string;
}
export interface KnowledgeBaseStats {
    totalDocuments: number;
    totalChunks: number;
    totalCollections: number;
    totalEnabledDocuments: number;
    documents: Array<{
        id: string;
        title: string;
        source: string;
        chunkCount: number;
        createdAt: string;
    }>;
}
export interface KBCollection {
    id: string;
    name: string;
    description: string;
    color: string;
    documentCount: number;
    createdAt: string;
    updatedAt: string;
    /** Tenant that owns this collection */
    tenantId?: string;
}
export interface DocumentMeta {
    enabled: boolean;
    tags: string[];
    collectionId: string | null;
    customMetadata: Record<string, string>;
    chunkingOptions: ChunkingOptions;
    processingStatus: 'pending' | 'processing' | 'completed' | 'error';
    processingError?: string;
    wordCount: number;
    charCount: number;
    /** Tenant that owns this document — used for cross-tenant isolation */
    tenantId?: string;
}
export interface QueryHistoryEntry {
    id: string;
    query: string;
    resultCount: number;
    avgScore: number;
    topScore: number;
    timestamp: string;
    collectionId?: string | null;
}
export interface KBAnalytics {
    totalQueries: number;
    avgResultCount: number;
    avgScore: number;
    topQueries: Array<{
        query: string;
        count: number;
        avgScore: number;
    }>;
    recentQueries: QueryHistoryEntry[];
    documentsBySource: Record<string, number>;
    documentsByCollection: Record<string, number>;
    chunkSizeDistribution: {
        min: number;
        max: number;
        avg: number;
        median: number;
    };
}
export declare class RagEngine {
    private processor;
    private embeddings;
    private vectorStore;
    private documents;
    private documentMeta;
    private collections;
    private queryHistory;
    private config;
    private reranker;
    constructor(embeddings?: EmbeddingProvider, vectorStore?: VectorStore, config?: RagConfig);
    createCollection(name: string, description?: string, color?: string, tenantId?: string): KBCollection;
    updateCollection(id: string, updates: {
        name?: string;
        description?: string;
        color?: string;
    }): KBCollection | null;
    deleteCollection(id: string): boolean;
    listCollections(tenantId?: string): KBCollection[];
    getCollection(id: string): KBCollection | undefined;
    private refreshCollectionCounts;
    ingestText(text: string, title: string, source?: string, options?: {
        tags?: string[];
        collectionId?: string;
        customMetadata?: Record<string, string>;
        chunkingOptions?: ChunkingOptions;
        tenantId?: string;
    }): Promise<RagDocument>;
    ingestUrl(url: string, title?: string, options?: {
        tags?: string[];
        collectionId?: string;
        customMetadata?: Record<string, string>;
        chunkingOptions?: ChunkingOptions;
        tenantId?: string;
    }): Promise<RagDocument>;
    private htmlToText;
    private extractTitle;
    reindexDocument(documentId: string, newChunkingOptions?: ChunkingOptions): Promise<RagDocument | null>;
    setDocumentEnabled(documentId: string, enabled: boolean): boolean;
    updateDocumentMeta(documentId: string, updates: {
        title?: string;
        tags?: string[];
        collectionId?: string;
        customMetadata?: Record<string, string>;
    }): boolean;
    getDocumentChunks(documentId: string): DocumentChunk[] | null;
    updateChunk(documentId: string, chunkId: string, content: string): Promise<boolean>;
    deleteChunk(documentId: string, chunkId: string): Promise<boolean>;
    addChunk(documentId: string, content: string): Promise<DocumentChunk | null>;
    retrieve(query: string, topK?: number, collectionId?: string | null, tenantId?: string): Promise<RetrievalResult>;
    buildRagPrompt(basePrompt: string, context: string): string;
    removeDocument(documentId: string): Promise<boolean>;
    batchRemoveDocuments(documentIds: string[]): Promise<number>;
    batchSetEnabled(documentIds: string[], enabled: boolean): Promise<number>;
    batchReindex(documentIds: string[], chunkingOptions?: ChunkingOptions): Promise<number>;
    batchMoveToCollection(documentIds: string[], collectionId: string): Promise<number>;
    getStats(tenantId?: string): KnowledgeBaseStats;
    getDocument(id: string, tenantId?: string): RagDocument | undefined;
    getDocumentMeta(id: string, tenantId?: string): DocumentMeta | undefined;
    listDocuments(options?: {
        collectionId?: string;
        tag?: string;
        source?: string;
        enabled?: boolean;
        search?: string;
        tenantId?: string;
    }): Array<Omit<RagDocument, 'chunks'> & {
        chunkCount: number;
        meta: DocumentMeta;
    }>;
    getAllTags(): string[];
    getAnalytics(): KBAnalytics;
    getQueryHistory(limit?: number): QueryHistoryEntry[];
    /**
     * Crawl a website and ingest all discovered pages into the knowledge base.
     * Yields progress updates for streaming to the client.
     */
    crawlSite(startUrl: string, crawlOptions?: CrawlOptions, ingestOptions?: {
        tags?: string[];
        collectionId?: string;
        chunkingOptions?: ChunkingOptions;
        tenantId?: string;
    }): AsyncGenerator<CrawlProgress & {
        ingested: number;
    }>;
    searchWithReranking(query: string, options?: {
        topK?: number;
        collectionId?: string;
        rerankerOptions?: RerankerOptions;
        tenantId?: string;
    }): Promise<RerankerResult[]>;
    /**
     * Get documents that may need re-indexing (imported from web, older than maxAgeMs).
     */
    getStaleDocuments(maxAgeMs?: number): Array<{
        id: string;
        title: string;
        source: string;
        age: number;
    }>;
    /**
     * Re-fetch and re-ingest a web-sourced document from its source URL.
     */
    refreshDocument(documentId: string): Promise<RagDocument | null>;
    getDefaultChunkingOptions(): Required<ChunkingOptions>;
    setDefaultChunkingOptions(options: ChunkingOptions): void;
}
//# sourceMappingURL=rag-engine.d.ts.map