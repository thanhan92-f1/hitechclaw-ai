// ============================================================
// Models Management Routes — Ollama model management API
// GET    /api/models          — List models & status
// POST   /api/models/pull     — Pull (download) a model
// DELETE /api/models/:name    — Delete a model
// GET    /api/models/:name    — Get model info
// PUT    /api/models/active   — Switch active model
// GET    /api/models/health   — Ollama health status
// ============================================================
import { Hono } from 'hono';
export function createModelsRoutes(ctx) {
    const app = new Hono();
    function getOllamaAdapter() {
        return ctx.ollamaAdapter ?? null;
    }
    // GET /api/models — List available models
    app.get('/', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ error: 'Ollama not configured' }, 503);
        }
        try {
            const models = await adapter.listModels();
            const activeModel = adapter.getModel();
            return c.json({ models, activeModel });
        }
        catch {
            return c.json({ error: 'Failed to list models. Is Ollama running?' }, 503);
        }
    });
    // GET /api/models/health — Ollama health check
    app.get('/health', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ running: false, error: 'Ollama not configured' });
        }
        try {
            const status = await adapter.getHealthStatus();
            return c.json(status);
        }
        catch {
            return c.json({ running: false });
        }
    });
    // PUT /api/models/active — Switch active model
    app.put('/active', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ error: 'Ollama not configured' }, 503);
        }
        const body = await c.req.json();
        if (!body.model) {
            return c.json({ error: 'model is required' }, 400);
        }
        adapter.setModel(body.model);
        return c.json({ activeModel: body.model });
    });
    // POST /api/models/pull — Pull a model (SSE progress stream)
    app.post('/pull', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ error: 'Ollama not configured' }, 503);
        }
        const body = await c.req.json();
        if (!body.model) {
            return c.json({ error: 'model name is required' }, 400);
        }
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const progress of adapter.pullModel(body.model)) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : 'Pull failed';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', error: msg })}\n\n`));
                }
                controller.close();
            },
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    });
    // GET /api/models/:name — Get model info
    app.get('/:name', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ error: 'Ollama not configured' }, 503);
        }
        const name = c.req.param('name');
        try {
            const info = await adapter.getModelInfo(name);
            if (!info)
                return c.json({ error: 'Model not found' }, 404);
            return c.json(info);
        }
        catch {
            return c.json({ error: 'Failed to get model info' }, 500);
        }
    });
    // DELETE /api/models/:name — Delete a model
    app.delete('/:name', async (c) => {
        const adapter = getOllamaAdapter();
        if (!adapter) {
            return c.json({ error: 'Ollama not configured' }, 503);
        }
        const name = c.req.param('name');
        const ok = await adapter.deleteModel(name);
        if (!ok)
            return c.json({ error: 'Failed to delete model' }, 500);
        return c.json({ deleted: name });
    });
    return app;
}
//# sourceMappingURL=models.js.map