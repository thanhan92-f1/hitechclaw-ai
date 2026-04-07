// ─── In-Memory Vector Store ─────────────────────────────────
export class InMemoryVectorStore {
    constructor() {
        this.chunks = [];
    }
    async add(chunks) {
        this.chunks.push(...chunks);
    }
    async search(embedding, topK = 5) {
        const scored = this.chunks
            .filter((c) => c.embedding && c.embedding.length > 0)
            .map((chunk) => ({
            chunk,
            score: cosineSimilarity(embedding, chunk.embedding),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        return scored;
    }
    async remove(documentId) {
        this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    }
    count() {
        return this.chunks.length;
    }
    listDocumentIds() {
        return [...new Set(this.chunks.map((c) => c.documentId))];
    }
}
// ─── Cosine Similarity ──────────────────────────────────────
function cosineSimilarity(a, b) {
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
