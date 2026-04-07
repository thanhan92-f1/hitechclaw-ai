// ============================================================
// Monitoring Routes — Logs, audit trail, system metrics
// ============================================================
import { Hono } from 'hono';
import { mongoMonitoringStore, listPricing } from '@hitechclaw/db';
export function createMonitoringRoutes(monitoring) {
    const app = new Hono();
    // ─── System Metrics ──────────────────────────────────────
    app.get('/metrics', async (c) => {
        try {
            const metrics = monitoring.getMetrics();
            return c.json({ ok: true, metrics });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Audit Logs ──────────────────────────────────────────
    app.get('/audit', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { userId, action, resource, from, to, limit, offset } = c.req.query();
            const result = await monitoring.getAuditLogs({
                tenantId,
                userId: userId || undefined,
                action: action || undefined,
                resource: resource || undefined,
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
            });
            return c.json({ ok: true, logs: result.logs, total: result.total });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── System Logs ─────────────────────────────────────────
    app.get('/logs', async (c) => {
        try {
            const { level, source, search, from, to, limit, offset } = c.req.query();
            const result = await monitoring.getSystemLogs({
                level: level || undefined,
                source: source || undefined,
                search: search || undefined,
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                limit: limit ? parseInt(limit, 10) : 100,
                offset: offset ? parseInt(offset, 10) : 0,
            });
            return c.json({ ok: true, logs: result.logs, total: result.total });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Health Dashboard ────────────────────────────────────
    app.get('/dashboard', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const metrics = monitoring.getMetrics();
            // Recent errors (last 10)
            const recentErrors = await monitoring.getSystemLogs({
                level: ['error', 'fatal'],
                limit: 10,
            });
            // Recent audit activity (last 10)
            const recentAudit = await monitoring.getAuditLogs({
                tenantId,
                limit: 10,
            });
            return c.json({
                ok: true,
                dashboard: {
                    metrics,
                    recentErrors: recentErrors.logs,
                    recentAudit: recentAudit.logs,
                },
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Activity Logs (per-user API requests) ────────────────
    app.get('/activity', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { userId, method, path, from, to, limit, offset } = c.req.query();
            const filter = {
                tenantId,
                userId: userId || undefined,
                method: method || undefined,
                path: path || undefined,
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
            };
            const [logs, total] = await Promise.all([
                mongoMonitoringStore.queryActivityLogs(filter),
                mongoMonitoringStore.countActivityLogs(filter),
            ]);
            return c.json({ ok: true, logs, total });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── LLM Logs (per-user LLM interactions) ─────────────────
    app.get('/llm', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { userId, provider, model, sessionId, success, from, to, limit, offset } = c.req.query();
            const filter = {
                tenantId,
                userId: userId || undefined,
                provider: provider || undefined,
                model: model || undefined,
                sessionId: sessionId || undefined,
                success: success !== undefined ? success === 'true' : undefined,
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
            };
            const [logs, total] = await Promise.all([
                mongoMonitoringStore.queryLLMLogs(filter),
                mongoMonitoringStore.countLLMLogs(filter),
            ]);
            return c.json({ ok: true, logs, total });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── LLM Usage Stats (aggregated) ─────────────────────────
    app.get('/llm/stats', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { from, to } = c.req.query();
            const stats = await mongoMonitoringStore.getLLMUsageStats(tenantId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
            return c.json({ ok: true, stats });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── LLM Pricing Reference ─────────────────────────────────
    app.get('/llm/pricing', (c) => {
        return c.json({ ok: true, pricing: listPricing() });
    });
    return app;
}
//# sourceMappingURL=monitoring.js.map