// ─── OpenAI Embedding Provider ──────────────────────────────
export class OpenAIEmbeddingProvider {
    constructor(opts) {
        var _a, _b;
        this.dimension = 1536; // text-embedding-3-small default
        this.apiKey = opts.apiKey;
        this.model = (_a = opts.model) !== null && _a !== void 0 ? _a : 'text-embedding-3-small';
        this.baseUrl = (_b = opts.baseUrl) !== null && _b !== void 0 ? _b : 'https://api.openai.com/v1';
        if (this.model === 'text-embedding-3-large')
            this.dimension = 3072;
    }
    async embed(texts) {
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
        const data = (await res.json());
        // Sort by index to maintain order
        return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }
}
// ─── Local / Simple Embedding (for dev without API keys) ────
/**
 * Simple bag-of-words TF-based embedding for local dev.
 * NOT for production — just allows RAG pipeline to work without API keys.
 */
export class LocalEmbeddingProvider {
    constructor() {
        this.dimension = 384;
    }
    async embed(texts) {
        return texts.map((text) => this.simpleEmbed(text));
    }
    simpleEmbed(text) {
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
        for (let i = 0; i < vec.length; i++)
            norm += vec[i] * vec[i];
        norm = Math.sqrt(norm) || 1;
        const result = new Array(this.dimension);
        for (let i = 0; i < vec.length; i++)
            result[i] = vec[i] / norm;
        return result;
    }
    hashString(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h;
    }
}
