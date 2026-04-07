import { Hono } from 'hono';
export function createKnowledgeRoutes(ctx) {
    const app = new Hono();
    // ─── Collections ────────────────────────────────────────
    app.get('/collections', (c) => {
        const tenantId = c.get('tenantId');
        return c.json({ collections: ctx.rag.listCollections(tenantId) });
    });
    app.post('/collections', async (c) => {
        const { name, description, color } = await c.req.json();
        if (!name)
            return c.json({ error: 'name is required' }, 400);
        const tenantId = c.get('tenantId');
        const col = ctx.rag.createCollection(name, description, color, tenantId);
        return c.json(col, 201);
    });
    app.put('/collections/:id', async (c) => {
        const col = ctx.rag.updateCollection(c.req.param('id'), await c.req.json());
        if (!col)
            return c.json({ error: 'Collection not found' }, 404);
        return c.json(col);
    });
    app.delete('/collections/:id', (c) => {
        const ok = ctx.rag.deleteCollection(c.req.param('id'));
        if (!ok)
            return c.json({ error: 'Cannot delete default collection' }, 400);
        return c.json({ success: true });
    });
    // ─── Document List & Stats ──────────────────────────────
    app.get('/', (c) => {
        const tenantId = c.get('tenantId');
        const { collectionId, tag, source, enabled, search } = c.req.query();
        const docs = ctx.rag.listDocuments({
            collectionId: collectionId || undefined,
            tag: tag || undefined,
            source: source || undefined,
            enabled: enabled !== undefined ? enabled === 'true' : undefined,
            search: search || undefined,
            tenantId,
        });
        const stats = ctx.rag.getStats(tenantId);
        return c.json({ documents: docs, stats });
    });
    app.get('/stats/overview', (c) => {
        const tenantId = c.get('tenantId');
        return c.json(ctx.rag.getStats(tenantId));
    });
    app.get('/tags', (c) => {
        return c.json({ tags: ctx.rag.getAllTags() });
    });
    app.get('/analytics', (c) => {
        return c.json(ctx.rag.getAnalytics());
    });
    app.get('/query-history', (c) => {
        const limit = parseInt(c.req.query('limit') ?? '20', 10);
        return c.json({ history: ctx.rag.getQueryHistory(limit) });
    });
    // ─── Document Upload ────────────────────────────────────
    app.post('/upload', async (c) => {
        const contentType = c.req.header('Content-Type') ?? '';
        let text;
        let title;
        let source;
        let tags = [];
        let collectionId;
        let customMetadata = {};
        let chunkSize;
        let chunkOverlap;
        if (contentType.includes('multipart/form-data')) {
            const form = await c.req.formData();
            const file = form.get('file');
            title = form.get('title') || file?.name || 'Untitled';
            source = form.get('source') || 'upload';
            const tagsStr = form.get('tags');
            if (tagsStr)
                tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
            collectionId = form.get('collectionId') || undefined;
            const metaStr = form.get('customMetadata');
            if (metaStr)
                try {
                    customMetadata = JSON.parse(metaStr);
                }
                catch { }
            const cs = form.get('chunkSize');
            if (cs)
                chunkSize = parseInt(cs, 10);
            const co = form.get('chunkOverlap');
            if (co)
                chunkOverlap = parseInt(co, 10);
            if (!file)
                return c.json({ error: 'No file uploaded' }, 400);
            text = await file.text();
        }
        else {
            const body = await c.req.json();
            text = body.text;
            title = body.title || 'Untitled';
            source = body.source || 'upload';
            tags = body.tags || [];
            collectionId = body.collectionId;
            customMetadata = body.customMetadata || {};
            chunkSize = body.chunkSize;
            chunkOverlap = body.chunkOverlap;
            if (!text)
                return c.json({ error: 'text is required' }, 400);
        }
        const chunkingOptions = (chunkSize || chunkOverlap) ? {
            chunkSize: chunkSize ?? 512,
            chunkOverlap: chunkOverlap ?? 50,
        } : undefined;
        const tenantId = c.get('tenantId');
        const doc = await ctx.rag.ingestText(text, title, source, {
            tags, collectionId, customMetadata, chunkingOptions, tenantId,
        });
        return c.json({
            id: doc.id,
            title: doc.title,
            chunkCount: doc.chunks.length,
            createdAt: doc.createdAt,
        }, 201);
    });
    // POST /api/knowledge/import-url — import from URL
    app.post('/import-url', async (c) => {
        const { url, title, tags, collectionId, customMetadata, chunkSize, chunkOverlap } = await c.req.json();
        if (!url)
            return c.json({ error: 'url is required' }, 400);
        try {
            new URL(url);
        }
        catch {
            return c.json({ error: 'Invalid URL' }, 400);
        }
        const chunkingOptions = (chunkSize || chunkOverlap) ? {
            chunkSize: chunkSize ?? 512,
            chunkOverlap: chunkOverlap ?? 50,
        } : undefined;
        const tenantId = c.get('tenantId');
        const doc = await ctx.rag.ingestUrl(url, title, {
            tags, collectionId, customMetadata, chunkingOptions, tenantId,
        });
        return c.json({
            id: doc.id,
            title: doc.title,
            source: doc.source,
            chunkCount: doc.chunks.length,
            createdAt: doc.createdAt,
        }, 201);
    });
    // ─── Search ─────────────────────────────────────────────
    app.post('/search', async (c) => {
        const { query, topK, collectionId } = await c.req.json();
        if (!query)
            return c.json({ error: 'query is required' }, 400);
        const tenantId = c.get('tenantId');
        const result = await ctx.rag.retrieve(query, topK, collectionId, tenantId);
        return c.json({
            query: result.query,
            results: result.chunks.map((r) => ({
                content: r.chunk.content,
                score: Math.round(r.score * 1000) / 1000,
                source: r.chunk.metadata.title,
                documentId: r.chunk.documentId,
                chunkIndex: r.chunk.metadata.chunkIndex,
            })),
            context: result.context,
        });
    });
    // ─── Document Details & Management ──────────────────────
    app.get('/:id', (c) => {
        const id = c.req.param('id');
        const tenantId = c.get('tenantId');
        const doc = ctx.rag.getDocument(id, tenantId);
        if (!doc)
            return c.json({ error: 'Document not found' }, 404);
        const meta = ctx.rag.getDocumentMeta(id, tenantId);
        return c.json({
            id: doc.id,
            title: doc.title,
            source: doc.source,
            mimeType: doc.mimeType,
            content: doc.content,
            chunkCount: doc.chunks.length,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            metadata: doc.metadata,
            meta,
        });
    });
    app.put('/:id', async (c) => {
        const body = await c.req.json();
        const ok = ctx.rag.updateDocumentMeta(c.req.param('id'), body);
        if (!ok)
            return c.json({ error: 'Document not found' }, 404);
        return c.json({ success: true });
    });
    app.delete('/:id', async (c) => {
        const removed = await ctx.rag.removeDocument(c.req.param('id'));
        if (!removed)
            return c.json({ error: 'Document not found' }, 404);
        return c.json({ success: true });
    });
    app.put('/:id/enabled', async (c) => {
        const { enabled } = await c.req.json();
        const ok = ctx.rag.setDocumentEnabled(c.req.param('id'), enabled);
        if (!ok)
            return c.json({ error: 'Document not found' }, 404);
        return c.json({ success: true });
    });
    app.post('/:id/reindex', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const chunkingOptions = (body.chunkSize || body.chunkOverlap) ? {
            chunkSize: body.chunkSize ?? 512,
            chunkOverlap: body.chunkOverlap ?? 50,
        } : undefined;
        const doc = await ctx.rag.reindexDocument(c.req.param('id'), chunkingOptions);
        if (!doc)
            return c.json({ error: 'Document not found' }, 404);
        return c.json({ id: doc.id, chunkCount: doc.chunks.length });
    });
    // ─── Chunk Management ──────────────────────────────────
    app.get('/:id/chunks', (c) => {
        const chunks = ctx.rag.getDocumentChunks(c.req.param('id'));
        if (!chunks)
            return c.json({ error: 'Document not found' }, 404);
        return c.json({ chunks });
    });
    app.post('/:id/chunks', async (c) => {
        const { content } = await c.req.json();
        if (!content)
            return c.json({ error: 'content is required' }, 400);
        const chunk = await ctx.rag.addChunk(c.req.param('id'), content);
        if (!chunk)
            return c.json({ error: 'Document not found' }, 404);
        return c.json(chunk, 201);
    });
    app.put('/:id/chunks/:chunkId', async (c) => {
        const { content } = await c.req.json();
        if (!content)
            return c.json({ error: 'content is required' }, 400);
        const ok = await ctx.rag.updateChunk(c.req.param('id'), c.req.param('chunkId'), content);
        if (!ok)
            return c.json({ error: 'Chunk not found' }, 404);
        return c.json({ success: true });
    });
    app.delete('/:id/chunks/:chunkId', async (c) => {
        const ok = await ctx.rag.deleteChunk(c.req.param('id'), c.req.param('chunkId'));
        if (!ok)
            return c.json({ error: 'Chunk not found' }, 404);
        return c.json({ success: true });
    });
    // ─── Batch Operations ──────────────────────────────────
    app.post('/batch/delete', async (c) => {
        const { documentIds } = await c.req.json();
        if (!Array.isArray(documentIds))
            return c.json({ error: 'documentIds array required' }, 400);
        const count = await ctx.rag.batchRemoveDocuments(documentIds);
        return c.json({ removed: count });
    });
    app.post('/batch/enable', async (c) => {
        const { documentIds, enabled } = await c.req.json();
        if (!Array.isArray(documentIds))
            return c.json({ error: 'documentIds array required' }, 400);
        const count = await ctx.rag.batchSetEnabled(documentIds, enabled);
        return c.json({ updated: count });
    });
    app.post('/batch/reindex', async (c) => {
        const { documentIds, chunkSize, chunkOverlap } = await c.req.json();
        if (!Array.isArray(documentIds))
            return c.json({ error: 'documentIds array required' }, 400);
        const chunkingOptions = (chunkSize || chunkOverlap) ? {
            chunkSize: chunkSize ?? 512, chunkOverlap: chunkOverlap ?? 50,
        } : undefined;
        const count = await ctx.rag.batchReindex(documentIds, chunkingOptions);
        return c.json({ reindexed: count });
    });
    app.post('/batch/move', async (c) => {
        const { documentIds, collectionId } = await c.req.json();
        if (!Array.isArray(documentIds) || !collectionId)
            return c.json({ error: 'documentIds and collectionId required' }, 400);
        const count = await ctx.rag.batchMoveToCollection(documentIds, collectionId);
        return c.json({ moved: count });
    });
    // ─── Web Crawl ──────────────────────────────────────────
    app.post('/crawl', async (c) => {
        try {
            const body = await c.req.json();
            const { url, maxPages, maxDepth, sameDomain, includePatterns, excludePatterns, tags, collectionId, chunkSize, chunkOverlap } = body;
            if (!url || typeof url !== 'string')
                return c.json({ error: 'url is required' }, 400);
            // Basic URL validation
            try {
                new URL(url);
            }
            catch {
                return c.json({ error: 'Invalid URL' }, 400);
            }
            const results = [];
            const errors = [];
            let totalIngested = 0;
            const crawlTenantId = c.get('tenantId');
            for await (const progress of ctx.rag.crawlSite(url, {
                maxPages: Math.min(maxPages ?? 20, 100), // cap at 100
                maxDepth: Math.min(maxDepth ?? 2, 5),
                sameDomain: sameDomain ?? true,
                includePatterns,
                excludePatterns,
            }, {
                tags,
                collectionId,
                chunkingOptions: (chunkSize || chunkOverlap) ? { chunkSize, chunkOverlap } : undefined,
                tenantId: crawlTenantId,
            })) {
                totalIngested = progress.ingested;
                for (const page of progress.pages) {
                    if (!results.find((r) => r.url === page.url)) {
                        results.push({ url: page.url, title: page.title, status: 'ingested' });
                    }
                }
                for (const err of progress.errors) {
                    if (!errors.find((e) => e.url === err.url)) {
                        errors.push(err);
                    }
                }
            }
            return c.json({ ok: true, ingested: totalIngested, pages: results, errors });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Crawl failed' }, 500);
        }
    });
    // ─── Knowledge Refresh ─────────────────────────────────
    app.get('/stale', (c) => {
        const maxAge = parseInt(c.req.query('maxAgeDays') ?? '7');
        const stale = ctx.rag.getStaleDocuments(maxAge * 24 * 60 * 60 * 1000);
        return c.json({ documents: stale });
    });
    app.post('/refresh/:id', async (c) => {
        try {
            const doc = await ctx.rag.refreshDocument(c.req.param('id'));
            if (!doc)
                return c.json({ error: 'Document not found or not web-sourced' }, 404);
            return c.json({ ok: true, document: { id: doc.id, title: doc.title, updatedAt: doc.updatedAt } });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Refresh failed' }, 500);
        }
    });
    app.post('/refresh-all', async (c) => {
        const maxAge = parseInt(c.req.query('maxAgeDays') ?? '7');
        const stale = ctx.rag.getStaleDocuments(maxAge * 24 * 60 * 60 * 1000);
        let refreshed = 0;
        const errors = [];
        for (const doc of stale) {
            try {
                const result = await ctx.rag.refreshDocument(doc.id);
                if (result)
                    refreshed++;
            }
            catch {
                errors.push(doc.id);
            }
        }
        return c.json({ ok: true, total: stale.length, refreshed, errors });
    });
    // ─── Chunking Config ──────────────────────────────────
    app.get('/chunking-config', (c) => {
        return c.json(ctx.rag.getDefaultChunkingOptions());
    });
    app.put('/chunking-config', async (c) => {
        const body = await c.req.json();
        const { chunkSize, chunkOverlap, separator } = body;
        ctx.rag.setDefaultChunkingOptions({ chunkSize, chunkOverlap, separator });
        return c.json({ ok: true, config: ctx.rag.getDefaultChunkingOptions() });
    });
    // ─── Re-ranked Search ─────────────────────────────────
    app.post('/search/reranked', async (c) => {
        try {
            const { query, topK, collectionId } = await c.req.json();
            if (!query)
                return c.json({ error: 'query is required' }, 400);
            const searchTenantId = c.get('tenantId');
            const results = await ctx.rag.searchWithReranking(query, { topK: topK ?? 5, collectionId, tenantId: searchTenantId });
            return c.json({
                ok: true,
                results: results.map((r) => ({
                    content: r.chunk.content,
                    score: r.rerankedScore,
                    originalScore: r.originalScore,
                    rank: r.rank,
                    source: r.chunk.metadata.source,
                    title: r.chunk.metadata.title,
                    chunkIndex: r.chunk.metadata.chunkIndex,
                })),
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Search failed' }, 500);
        }
    });
    return app;
}
//# sourceMappingURL=knowledge.js.map