// ─── Cross-Encoder Re-ranker ────────────────────────────────
/**
 * A cross-encoder style re-ranker that scores query-document pairs
 * using multiple signal features. This is a lightweight local implementation
 * that combines lexical overlap, term frequency, position bias, and
 * semantic similarity signals for improved ranking without external APIs.
 */
export class CrossEncoderReranker {
    /**
     * Re-rank a set of search results against a query.
     * Combines multiple scoring signals for better relevance ranking.
     */
    rerank(query, results, options) {
        const topK = options?.topK ?? 5;
        const threshold = options?.threshold ?? 0.0;
        const queryTokens = this.tokenize(query);
        const queryBigrams = this.bigrams(queryTokens);
        const scored = results.map((r) => {
            const docTokens = this.tokenize(r.chunk.content);
            const docBigrams = this.bigrams(docTokens);
            // Signal 1: Unigram overlap (Jaccard)
            const unigramScore = this.jaccardSimilarity(new Set(queryTokens), new Set(docTokens));
            // Signal 2: Bigram overlap
            const bigramScore = this.jaccardSimilarity(new Set(queryBigrams), new Set(docBigrams));
            // Signal 3: Term coverage — what fraction of query terms appear in doc
            const coverage = this.termCoverage(queryTokens, docTokens);
            // Signal 4: Term frequency — TF of query terms in document
            const tfScore = this.queryTermFrequency(queryTokens, docTokens);
            // Signal 5: Position bias — reward matches near the start
            const positionScore = this.positionBias(queryTokens, docTokens);
            // Signal 6: Length normalization — slight preference for concise chunks
            const lengthScore = Math.min(1.0, 200 / Math.max(docTokens.length, 1));
            // Signal 7: Exact phrase match bonus
            const phraseBonus = this.phraseMatchBonus(query.toLowerCase(), r.chunk.content.toLowerCase());
            // Weighted combination
            const rerankedScore = unigramScore * 0.15 +
                bigramScore * 0.10 +
                coverage * 0.25 +
                tfScore * 0.10 +
                positionScore * 0.05 +
                lengthScore * 0.05 +
                phraseBonus * 0.10 +
                r.score * 0.20; // keep original score influence
            return { chunk: r.chunk, originalScore: r.score, rerankedScore, rank: 0 };
        });
        scored.sort((a, b) => b.rerankedScore - a.rerankedScore);
        return scored
            .filter((r) => r.rerankedScore >= threshold)
            .slice(0, topK)
            .map((r, i) => ({ ...r, rank: i + 1 }));
    }
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter((t) => t.length > 1);
    }
    bigrams(tokens) {
        const result = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            result.push(`${tokens[i]} ${tokens[i + 1]}`);
        }
        return result;
    }
    jaccardSimilarity(a, b) {
        if (a.size === 0 && b.size === 0)
            return 0;
        let intersection = 0;
        for (const item of a) {
            if (b.has(item))
                intersection++;
        }
        return intersection / (a.size + b.size - intersection);
    }
    termCoverage(queryTokens, docTokens) {
        if (queryTokens.length === 0)
            return 0;
        const docSet = new Set(docTokens);
        let found = 0;
        for (const qt of queryTokens) {
            if (docSet.has(qt))
                found++;
        }
        return found / queryTokens.length;
    }
    queryTermFrequency(queryTokens, docTokens) {
        if (queryTokens.length === 0 || docTokens.length === 0)
            return 0;
        const querySet = new Set(queryTokens);
        let count = 0;
        for (const dt of docTokens) {
            if (querySet.has(dt))
                count++;
        }
        // Normalized TF
        return Math.min(1.0, count / (docTokens.length * 0.1));
    }
    positionBias(queryTokens, docTokens) {
        if (queryTokens.length === 0 || docTokens.length === 0)
            return 0;
        let totalScore = 0;
        const querySet = new Set(queryTokens);
        for (let i = 0; i < docTokens.length; i++) {
            if (querySet.has(docTokens[i])) {
                // Higher score for earlier positions
                totalScore += 1 / (1 + i * 0.01);
            }
        }
        return Math.min(1.0, totalScore / queryTokens.length);
    }
    phraseMatchBonus(query, content) {
        if (content.includes(query))
            return 1.0;
        // Check 3-word windows
        const words = query.split(/\s+/);
        if (words.length >= 3) {
            for (let i = 0; i <= words.length - 3; i++) {
                const phrase = words.slice(i, i + 3).join(' ');
                if (content.includes(phrase))
                    return 0.5;
            }
        }
        // Check 2-word windows
        if (words.length >= 2) {
            let found = 0;
            for (let i = 0; i <= words.length - 2; i++) {
                const phrase = words.slice(i, i + 2).join(' ');
                if (content.includes(phrase))
                    found++;
            }
            return found > 0 ? Math.min(0.3, found * 0.1) : 0;
        }
        return 0;
    }
}
//# sourceMappingURL=reranker.js.map