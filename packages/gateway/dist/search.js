// ============================================================
// Global Search Routes — Search across knowledge base and chat
// POST /api/search — Global search
// ============================================================
import { Hono } from 'hono';
export function createSearchRoutes(ctx) {
    const app = new Hono();
    // POST /api/search — Global search across KB and chat
    app.post('/', async (c) => {
        const body = await c.req.json();
        if (!body.query) {
            return c.json({ error: 'query is required' }, 400);
        }
        const sources = body.sources ?? ['knowledge'];
        const results = [];
        // Search Knowledge Base
        if (sources.includes('knowledge')) {
            try {
                const retrieval = await ctx.rag.retrieve(body.query, body.topK ?? 10, body.collectionId);
                if (retrieval.chunks) {
                    for (const r of retrieval.chunks) {
                        results.push({
                            type: 'knowledge',
                            title: r.chunk.metadata?.title || r.chunk.documentId || 'Document',
                            content: r.chunk.content,
                            score: r.score,
                            metadata: {
                                documentId: r.chunk.documentId,
                                ...r.chunk.metadata,
                            },
                        });
                    }
                }
            }
            catch {
                // KB search failure is non-fatal
            }
        }
        // Sort all results by score
        results.sort((a, b) => b.score - a.score);
        return c.json({
            query: body.query,
            results,
            total: results.length,
        });
    });
    return app;
}
//# sourceMappingURL=search.js.map