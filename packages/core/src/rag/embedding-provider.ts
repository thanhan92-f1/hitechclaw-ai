import type { LLMAdapter } from '../llm/llm-router.js';

// ─── Types ──────────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimension: number;
}

// ─── OpenAI Embedding Provider ──────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  dimension = 1536; // text-embedding-3-small default
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'text-embedding-3-small';
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
    if (this.model === 'text-embedding-3-large') this.dimension = 3072;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    // Sort by index to maintain order
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

// ─── Local / Simple Embedding (for dev without API keys) ────

/**
 * Simple bag-of-words TF-based embedding for local dev.
 * NOT for production — just allows RAG pipeline to work without API keys.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  dimension = 384;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.simpleEmbed(text));
  }

  private simpleEmbed(text: string): number[] {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const vec = new Float32Array(this.dimension);

    for (const word of words) {
      // Deterministic hash-based feature mapping
      const hash = this.hashString(word);
      const idx = Math.abs(hash) % this.dimension;
      vec[idx] += 1;
      // Bigram features
      const idx2 = Math.abs(hash * 31) % this.dimension;
      vec[idx2] += 0.5;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    const result = new Array<number>(this.dimension);
    for (let i = 0; i < vec.length; i++) result[i] = vec[i] / norm;
    return result;
  }

  private hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }
}
