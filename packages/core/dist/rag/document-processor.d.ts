export interface DocumentChunk {
    id: string;
    documentId: string;
    content: string;
    metadata: ChunkMetadata;
    embedding?: number[];
}
export interface ChunkMetadata {
    source: string;
    title: string;
    chunkIndex: number;
    totalChunks: number;
    charStart: number;
    charEnd: number;
    createdAt: string;
    [key: string]: unknown;
}
export interface RagDocument {
    id: string;
    title: string;
    content: string;
    mimeType: string;
    source: string;
    chunks: DocumentChunk[];
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
}
export interface ChunkingOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    separator?: string;
}
export interface MultiModalContent {
    type: 'text' | 'table' | 'image' | 'code';
    content: string;
    metadata?: Record<string, unknown>;
}
export declare class DocumentProcessor {
    private defaultOptions;
    /**
     * Process raw text into a RagDocument with chunks.
     */
    processText(text: string, title: string, source: string, options?: ChunkingOptions): RagDocument;
    /**
     * Process HTML content, extracting tables, code blocks, and images
     * as separate annotated chunks alongside regular text.
     */
    processHTML(html: string, title: string, source: string, options?: ChunkingOptions): RagDocument;
    /**
     * Extract structured segments from HTML: tables, images, code blocks, and text.
     */
    extractMultiModalContent(html: string): MultiModalContent[];
    private tableToText;
    private stripHtml;
    private detectCodeLanguage;
    /**
     * Split text into overlapping chunks using recursive splitting.
     */
    chunkText(text: string, documentId: string, title: string, source: string, options?: ChunkingOptions): DocumentChunk[];
    private recursiveSplit;
}
//# sourceMappingURL=document-processor.d.ts.map