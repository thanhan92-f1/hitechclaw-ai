// ============================================================
// Sandbox API Routes — OpenShell sandbox management endpoints
// ============================================================
import { Hono } from 'hono';
import { BUILTIN_POLICIES } from '@hitechclaw/sandbox';
import { GPU_SANDBOX_IMAGES } from '@hitechclaw/sandbox';
import { sandboxAuditLogsCollection } from '@hitechclaw/db';
export function createSandboxRoutes(sandboxManager, tenantSandboxManager) {
    const app = new Hono();
    // ─── List tenant sandboxes ────────────────────────────────
    app.get('/', async (c) => {
        const tenantId = c.get('tenantId');
        const sandboxes = tenantSandboxManager.getTenantSandboxes(tenantId);
        return c.json({
            sandboxes: sandboxes.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                image: s.image,
                gpu: s.gpu,
                createdAt: s.createdAt,
                lastActivityAt: s.lastActivityAt,
            })),
            count: sandboxes.length,
        });
    });
    // ─── Create a new sandbox ────────────────────────────────
    app.post('/', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        try {
            const body = await c.req.json();
            const instance = await tenantSandboxManager.createForTenant(tenantId, {
                image: body.image,
                gpu: body.gpu,
            });
            return c.json({ sandbox: { id: instance.id, name: instance.name, status: instance.status } }, 201);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed to create sandbox' }, 400);
        }
    });
    // ─── Get sandbox details ─────────────────────────────────
    app.get('/:sandboxId', async (c) => {
        const tenantId = c.get('tenantId');
        const sandboxId = c.req.param('sandboxId');
        const instance = sandboxManager.getInstance(sandboxId);
        if (!instance || instance.tenantId !== tenantId) {
            return c.json({ error: 'Sandbox not found' }, 404);
        }
        return c.json({ sandbox: instance });
    });
    // ─── Destroy a sandbox ───────────────────────────────────
    app.delete('/:sandboxId', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        const sandboxId = c.req.param('sandboxId');
        const instance = sandboxManager.getInstance(sandboxId);
        if (!instance || instance.tenantId !== tenantId) {
            return c.json({ error: 'Sandbox not found' }, 404);
        }
        try {
            await tenantSandboxManager.destroy(tenantId, sandboxId);
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed to destroy sandbox' }, 500);
        }
    });
    // ─── Destroy all tenant sandboxes ────────────────────────
    app.delete('/', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        try {
            const count = await tenantSandboxManager.destroyAll(tenantId);
            return c.json({ ok: true, destroyed: count });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Get tenant sandbox config ───────────────────────────
    app.get('/config', async (c) => {
        const tenantId = c.get('tenantId');
        const config = tenantSandboxManager.getTenantConfig(tenantId);
        return c.json({ config });
    });
    // ─── Update tenant sandbox config ────────────────────────
    app.put('/config', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        try {
            const body = await c.req.json();
            const allowedKeys = [
                'enabled', 'defaultPolicy', 'maxConcurrentSandboxes',
                'idleTimeoutMs', 'cpuLimit', 'memoryLimit', 'gpuEnabled',
            ];
            const filtered = {};
            for (const key of allowedKeys) {
                if (key in body) {
                    filtered[key] = body[key];
                }
            }
            // Validate policy name
            if (filtered.defaultPolicy !== undefined) {
                const policyName = String(filtered.defaultPolicy);
                if (!BUILTIN_POLICIES[policyName]) {
                    return c.json({ error: `Unknown policy: ${policyName}` }, 400);
                }
            }
            tenantSandboxManager.setTenantConfig(tenantId, filtered);
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 400);
        }
    });
    // ─── List available policies ─────────────────────────────
    app.get('/policies', async (c) => {
        const policies = Object.entries(BUILTIN_POLICIES).map(([name, policy]) => ({
            name,
            version: policy.version,
            networkDefault: policy.network.defaultAction,
            networkRulesCount: policy.network.rules.length,
            fsDefaultAccess: policy.filesystem.defaultAccess,
            maxProcesses: policy.process.maxProcesses,
        }));
        return c.json({ policies });
    });
    // ─── Pool stats (admin only) ─────────────────────────────
    app.get('/stats', async (c) => {
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        const poolStats = sandboxManager.getPoolStats();
        const tenantStats = tenantSandboxManager.getUsageStats();
        return c.json({ pool: poolStats, tenants: tenantStats });
    });
    // ─── Sandbox audit logs ──────────────────────────────────
    app.get('/audit', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
        const offset = parseInt(c.req.query('offset') ?? '0', 10);
        try {
            const logs = await sandboxAuditLogsCollection()
                .find({ tenantId })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .toArray();
            return c.json({ logs, count: logs.length });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── List ML sandbox images ──────────────────────────────
    app.get('/ml/images', async (c) => {
        return c.json({
            images: GPU_SANDBOX_IMAGES.map((img) => ({
                name: img.name,
                description: img.description,
                gpuRequired: img.gpuRequired,
                packages: img.packages,
            })),
        });
    });
    return app;
}
//# sourceMappingURL=sandbox.js.map