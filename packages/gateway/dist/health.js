import { getDB, getMongo } from '@hitechclaw/db';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
const VERSION = '2.1.0';
export function createHealthRoutes() {
    const app = new Hono();
    // Liveness — app is running
    app.get('/health', (c) => {
        return c.json({
            status: 'ok',
            version: VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });
    // Readiness — app can serve traffic (DB connections alive)
    app.get('/health/ready', async (c) => {
        try {
            const db = getDB();
            await db.execute(sql `SELECT 1`);
            const mongo = getMongo();
            await mongo.command({ ping: 1 });
            return c.json({ status: 'ok' });
        }
        catch {
            return c.json({ status: 'unhealthy' }, 503);
        }
    });
    // Deep health — detailed dependency status
    app.get('/health/deep', async (c) => {
        const checks = {};
        let overall = 'ok';
        // PostgreSQL
        try {
            const start = performance.now();
            const db = getDB();
            await db.execute(sql `SELECT 1`);
            checks.postgres = { status: 'ok', latency_ms: Math.round(performance.now() - start) };
        }
        catch (err) {
            checks.postgres = { status: 'unhealthy', latency_ms: -1, error: err instanceof Error ? err.message : 'Failed' };
            overall = 'unhealthy';
        }
        // MongoDB
        try {
            const start = performance.now();
            const mongo = getMongo();
            await mongo.command({ ping: 1 });
            checks.mongodb = { status: 'ok', latency_ms: Math.round(performance.now() - start) };
        }
        catch (err) {
            checks.mongodb = { status: 'unhealthy', latency_ms: -1, error: err instanceof Error ? err.message : 'Failed' };
            overall = 'unhealthy';
        }
        // LLM Provider (Ollama / external)
        const llmProvider = process.env.LLM_PROVIDER ?? 'ollama';
        const llmBaseUrl = process.env.LLM_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
        try {
            const start = performance.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const healthUrl = llmProvider === 'ollama' ? `${llmBaseUrl}/api/tags` : `${llmBaseUrl}/models`;
            const resp = await fetch(healthUrl, { signal: controller.signal });
            clearTimeout(timeout);
            const latency = Math.round(performance.now() - start);
            if (resp.ok) {
                const data = await resp.json();
                const modelCount = llmProvider === 'ollama' && Array.isArray(data.models)
                    ? data.models.length
                    : undefined;
                checks.llm = { status: 'ok', latency_ms: latency, details: { provider: llmProvider, models: modelCount } };
            }
            else {
                checks.llm = { status: 'degraded', latency_ms: latency, error: `HTTP ${resp.status}` };
                if (overall === 'ok')
                    overall = 'degraded';
            }
        }
        catch (err) {
            checks.llm = { status: 'unhealthy', latency_ms: -1, error: err instanceof Error ? err.message : 'Failed', details: { provider: llmProvider } };
            if (overall === 'ok')
                overall = 'degraded'; // LLM down → degraded (not unhealthy, app can still serve)
        }
        // Memory
        const mem = process.memoryUsage();
        const usedMb = Math.round(mem.rss / 1024 / 1024);
        checks.memory = { status: usedMb > 900 ? 'warning' : 'ok', latency_ms: 0 };
        // CPU Load (1 min average)
        const os = await import('node:os');
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        const cpuLoad = Math.round((loadAvg[0] / cpuCount) * 100);
        checks.cpu = { status: cpuLoad > 90 ? 'warning' : 'ok', latency_ms: 0, details: { load_1m: loadAvg[0], load_5m: loadAvg[1], cores: cpuCount, usage_pct: cpuLoad } };
        if (overall === 'ok' && Object.values(checks).some(c => c.status === 'warning')) {
            overall = 'degraded';
        }
        return c.json({
            status: overall,
            version: VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            checks,
            memory: { used_mb: usedMb, heap_mb: Math.round(mem.heapUsed / 1024 / 1024) },
        }, overall === 'unhealthy' ? 503 : 200);
    });
    app.get('/', (c) => {
        return c.json({
            name: 'HiTechClaw AI Agent Platform',
            version: VERSION,
            docs: '/health',
        });
    });
    return app;
}
//# sourceMappingURL=health.js.map