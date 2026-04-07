// ============================================================
// Global Search Routes — Search across knowledge base and chat
// POST /api/search — Global search
// ============================================================
import { Hono } from 'hono';
export function createSearchRoutes(ctx) {
    const app = new Hono();
    // POST /api/search — Global search across KB and chat
    app.post('/', async (c) => {
        var _a, _b, _c;
        const body = await c.req.json();
        if (!body.query) {
            return c.json({ error: 'query is required' }, 400);
        }
        const sources = (_a = body.sources) !== null && _a !== void 0 ? _a : ['knowledge'];
        const results = [];
        // Search Knowledge Base
        if (sources.includes('knowledge')) {
            try {
                const retrieval = await ctx.rag.retrieve(body.query, (_b = body.topK) !== null && _b !== void 0 ? _b : 10, body.collectionId);
                if (retrieval.chunks) {
                    for (const r of retrieval.chunks) {
                        results.push({
                            type: 'knowledge',
                            title: ((_c = r.chunk.metadata) === null || _c === void 0 ? void 0 : _c.title) || r.chunk.documentId || 'Document',
                            content: r.chunk.content,
                            score: r.score,
                            metadata: Object.assign({ documentId: r.chunk.documentId }, r.chunk.metadata),
                        });
                    }
                }
            }
            catch (_d) {
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
