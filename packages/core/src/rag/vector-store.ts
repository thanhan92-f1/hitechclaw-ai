import type { DocumentChunk } from './document-processor.js';
import type { EmbeddingProvider } from './embedding-provider.js';

// ─── Types ──────────────────────────────────────────────────

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

// ─── In-Memory Vector Store ─────────────────────────────────

export class InMemoryVectorStore implements VectorStore {
  private chunks: DocumentChunk[] = [];

  async add(chunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...chunks);
  }

  async search(embedding: number[], topK = 5): Promise<VectorSearchResult[]> {
    const scored = this.chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(embedding, chunk.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  async remove(documentId: string): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
  }

  count(): number {
    return this.chunks.length;
  }

  listDocumentIds(): string[] {
    return [...new Set(this.chunks.map((c) => c.documentId))];
  }
}

// ─── Cosine Similarity ──────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
