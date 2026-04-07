// ============================================================
// Models Management Routes — Ollama model management API
// GET    /api/models          — List models & status
// POST   /api/models/pull     — Pull (download) a model
// DELETE /api/models/:name    — Delete a model
// GET    /api/models/:name    — Get model info
// PUT    /api/models/active   — Switch active model
// GET    /api/models/health   — Ollama health status
// ============================================================
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { Hono } from 'hono';
export function createModelsRoutes(ctx) {
    const app = new Hono();
    function getOllamaAdapter() {
        var _a;
        return (_a = ctx.ollamaAdapter) !== null && _a !== void 0 ? _a : null;
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
        catch (_a) {
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
        catch (_a) {
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
                var _a, e_1, _b, _c;
                const encoder = new TextEncoder();
                try {
                    try {
                        for (var _d = true, _e = __asyncValues(adapter.pullModel(body.model)), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const progress = _c;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                        }
                        finally { if (e_1) throw e_1.error; }
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
        catch (_a) {
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
