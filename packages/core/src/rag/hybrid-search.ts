// ============================================================
// Hybrid Search — BM25 + Vector cosine similarity fusion
// ============================================================

import type { DocumentChunk } from './document-processor.js';

// ─── Types ──────────────────────────────────────────────────

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

// ─── BM25 Implementation ────────────────────────────────────

const K1 = 1.2;
const B = 0.75;

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildBM25Index(chunks: DocumentChunk[]): BM25Index {
  const df = new Map<string, number>();
  const tf = new Map<string, Map<string, number>>();
  const docLen = new Map<string, number>();
  let totalLen = 0;

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.content);
    docLen.set(chunk.id, tokens.length);
    totalLen += tokens.length;

    const termFreq = new Map<string, number>();
    const seen = new Set<string>();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
      if (!seen.has(token)) {
        df.set(token, (df.get(token) || 0) + 1);
        seen.add(token);
      }
    }
    tf.set(chunk.id, termFreq);
  }

  return {
    df,
    tf,
    n: chunks.length,
    avgDl: chunks.length > 0 ? totalLen / chunks.length : 0,
    docLen,
  };
}

export function bm25Score(query: string, chunkId: string, index: BM25Index): number {
  const queryTokens = tokenize(query);
  const chunkTf = index.tf.get(chunkId);
  if (!chunkTf) return 0;

  const dl = index.docLen.get(chunkId) || 0;
  let score = 0;

  for (const term of queryTokens) {
    const docFreq = index.df.get(term) || 0;
    if (docFreq === 0) continue;

    const termFreq = chunkTf.get(term) || 0;
    if (termFreq === 0) continue;

    // IDF component
    const idf = Math.log((index.n - docFreq + 0.5) / (docFreq + 0.5) + 1);

    // TF component with length normalization
    const tfNorm = (termFreq * (K1 + 1)) / (termFreq + K1 * (1 - B + B * (dl / index.avgDl)));

    score += idf * tfNorm;
  }

  return score;
}

// ─── Hybrid Search Engine ───────────────────────────────────

export function hybridSearch(
  query: string,
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  bm25Index: BM25Index,
  options: HybridSearchOptions = {},
): HybridSearchResult[] {
  const {
    topK = 5,
    alpha = 0.6, // Default: 60% vector, 40% BM25
    minScore = 0.01,
    includeCitations = true,
  } = options;

  // Score all chunks
  const scored: HybridSearchResult[] = [];

  for (const chunk of chunks) {
    // Vector cosine similarity
    const vectorScore = chunk.embedding && chunk.embedding.length > 0
      ? cosineSimilarity(queryEmbedding, chunk.embedding)
      : 0;

    // BM25 score
    const bm25 = bm25Score(query, chunk.id, bm25Index);

    scored.push({
      chunk,
      vectorScore,
      bm25Score: bm25,
      combinedScore: 0, // will be normalized below
      citation: {
        source: chunk.metadata.source,
        title: chunk.metadata.title,
        chunkIndex: chunk.metadata.chunkIndex,
        excerpt: '',
      },
    });
  }

  // Normalize scores to [0, 1] range for fair fusion
  const maxVector = Math.max(...scored.map((s) => s.vectorScore), 0.001);
  const maxBm25 = Math.max(...scored.map((s) => s.bm25Score), 0.001);

  for (const item of scored) {
    const normVector = item.vectorScore / maxVector;
    const normBm25 = item.bm25Score / maxBm25;
    item.combinedScore = alpha * normVector + (1 - alpha) * normBm25;

    if (includeCitations) {
      // Generate excerpt (first 200 chars around the best matching segment)
      item.citation.excerpt = item.chunk.content.slice(0, 200).trim();
    }
  }

  return scored
    .filter((s) => s.combinedScore >= minScore)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK);
}

// ─── Build source citation context ──────────────────────────

export function buildCitationContext(results: HybridSearchResult[]): string {
  if (results.length === 0) return '';

  const parts = results.map((r, i) => {
    const src = r.citation.source || 'unknown';
    const title = r.citation.title || 'untitled';
    return `[${i + 1}] (${title} — ${src})\n${r.chunk.content}`;
  });

  return `The following sources are relevant to the user's question:\n\n${parts.join('\n\n')}\n\nWhen referencing information, cite the source number in brackets like [1], [2], etc.`;
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
  return denom > 0 ? dot / denom : 0;
}
