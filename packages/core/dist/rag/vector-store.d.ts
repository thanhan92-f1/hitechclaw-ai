import type { DocumentChunk } from './document-processor.js';
export interface VectorSearchResult {
    chunk: DocumentChunk;
    score: number;
}
export interface VectorStore {
    add(chunks: DocumentChunk[]): Promise<void>;
    search(embedding: number[], topK?: number): Promise<VectorSearchResult[]>;
    remove(documentId: string): Promise<void>;
    count(): number;
    listDocumentIds(): string[];
}
export declare class InMemoryVectorStore implements VectorStore {
    private chunks;
    add(chunks: DocumentChunk[]): Promise<void>;
    search(embedding: number[], topK?: number): Promise<VectorSearchResult[]>;
    remove(documentId: string): Promise<void>;
    count(): number;
    listDocumentIds(): string[];
}
//# sourceMappingURL=vector-store.d.ts.map