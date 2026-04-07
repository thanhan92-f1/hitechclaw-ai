export interface DocEntry {
    /** Unique ID derived from relative path */
    id: string;
    /** Document title (from first # heading or filename) */
    title: string;
    /** Category/folder path */
    category: string;
    /** Tags extracted from frontmatter or filename */
    tags: string[];
    /** Full content */
    content: string;
    /** Relative file path from docs root */
    filePath: string;
    /** Last modified timestamp */
    updatedAt: string;
    /** Word count */
    wordCount: number;
    /** Semantic version */
    version: string;
}
export interface DocVersion {
    version: string;
    updatedAt: string;
    wordCount: number;
    title: string;
}
export interface SearchResult {
    doc: DocEntry;
    /** Relevance score (higher = more relevant) */
    score: number;
    /** Matched snippet with context */
    snippet: string;
}
export interface DocStoreStats {
    totalDocs: number;
    categories: string[];
    tags: string[];
    totalWords: number;
}
export declare class DocStore {
    private docs;
    private docsRoot;
    constructor(docsRoot: string);
    /** Load/reload all docs from the file system */
    loadAll(): void;
    private indexDirectory;
    private indexFile;
    /** Full-text search across all documents */
    search(query: string, limit?: number): SearchResult[];
    /** Get a document by ID */
    getDoc(id: string): DocEntry | undefined;
    /** List all documents, optionally filtered by category */
    listDocs(category?: string): DocEntry[];
    /** List all categories */
    listCategories(): string[];
    /** Get statistics */
    getStats(): DocStoreStats;
    /** Add or update a document, optionally saving a version snapshot */
    upsertDoc(relPath: string, content: string, saveVersion?: boolean): DocEntry;
    /** Get version history for a document */
    getVersionHistory(id: string): DocVersion[];
    /** Get content of a specific version */
    getVersionContent(id: string, version: string): string | null;
    get docsPath(): string;
}
//# sourceMappingURL=doc-store.d.ts.map