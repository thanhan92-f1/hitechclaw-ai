import { Hono } from 'hono';
import { retentionPoliciesCollection, getMongo } from '@hitechclaw/db';
export function createRetentionRoutes() {
    const app = new Hono();
    // List retention policies
    app.get('/', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const col = await retentionPoliciesCollection();
            const policies = await col.find({ tenantId }).toArray();
            return c.json({ policies });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Upsert retention policy for a resource
    app.put('/:resource', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const resource = c.req.param('resource');
            const validResources = ['messages', 'sessions', 'memory_entries', 'llm_logs', 'activity_logs', 'audit_logs'];
            if (!validResources.includes(resource)) {
                return c.json({ error: `Invalid resource. Must be one of: ${validResources.join(', ')}` }, 400);
            }
            const body = await c.req.json();
            if (!body.retentionDays || body.retentionDays < 1) {
                return c.json({ error: 'retentionDays must be >= 1' }, 400);
            }
            const col = await retentionPoliciesCollection();
            await col.updateOne({ tenantId, resource }, {
                $set: {
                    retentionDays: body.retentionDays,
                    enabled: body.enabled,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    tenantId,
                    resource,
                    lastRunAt: undefined,
                    createdAt: new Date(),
                },
            }, { upsert: true });
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Manually trigger retention cleanup
    app.post('/cleanup', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const result = await runRetentionCleanup(tenantId);
            return c.json(result);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
/** Run retention cleanup for a tenant */
export async function runRetentionCleanup(tenantId) {
    const col = await retentionPoliciesCollection();
    const policies = await col.find({ tenantId, enabled: true }).toArray();
    const db = getMongo();
    const results = {};
    for (const policy of policies) {
        const cutoff = new Date(Date.now() - policy.retentionDays * 86400000);
        const collection = db.collection(policy.resource);
        const res = await collection.deleteMany({ tenantId, createdAt: { $lt: cutoff } });
        results[policy.resource] = res.deletedCount;
        await col.updateOne({ _id: policy._id }, { $set: { lastRunAt: new Date() } });
    }
    return { cleaned: results };
}
//# sourceMappingURL=retention.js.map