import { Hono } from 'hono';
import crypto from 'node:crypto';
import { apiKeysCollection } from '@hitechclaw/db';
export function createApiKeyRoutes() {
    const app = new Hono();
    // List API keys (masked)
    app.get('/', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const col = await apiKeysCollection();
            const keys = await col.find({ tenantId }).sort({ createdAt: -1 }).toArray();
            const masked = keys.map((k) => ({
                _id: k._id,
                name: k.name,
                keyPrefix: k.keyPrefix,
                scopes: k.scopes,
                expiresAt: k.expiresAt,
                lastUsedAt: k.lastUsedAt,
                createdBy: k.createdBy,
                createdAt: k.createdAt,
            }));
            return c.json({ keys: masked });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Create API key — returns the raw key only once
    app.post('/', async (c) => {
        var _a;
        try {
            const tenantId = c.get('tenantId');
            const user = c.get('user');
            const userId = user.sub;
            const body = await c.req.json();
            if (!body.name)
                return c.json({ error: 'name is required' }, 400);
            const rawKey = `xck_${crypto.randomBytes(32).toString('hex')}`;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
            const keyPrefix = rawKey.slice(0, 12);
            const doc = {
                tenantId,
                name: body.name,
                keyPrefix,
                keyHash,
                scopes: (_a = body.scopes) !== null && _a !== void 0 ? _a : ['chat', 'knowledge'],
                expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : undefined,
                lastUsedAt: undefined,
                createdBy: userId,
                createdAt: new Date(),
            };
            const col = await apiKeysCollection();
            await col.insertOne(doc);
            return c.json({ key: rawKey, keyPrefix, name: body.name, scopes: doc.scopes });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Revoke (delete) an API key
    app.delete('/:keyId', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const { ObjectId } = await import('mongodb');
            const col = await apiKeysCollection();
            const result = await col.deleteOne({ _id: new ObjectId(c.req.param('keyId')), tenantId });
            if (result.deletedCount === 0)
                return c.json({ error: 'Key not found' }, 404);
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
/** Validate an API key — call from auth middleware as a fallback */
export async function validateApiKey(rawKey) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const col = await apiKeysCollection();
    const doc = await col.findOne({ keyHash });
    if (!doc)
        return null;
    if (doc.expiresAt && doc.expiresAt < new Date())
        return null;
    await col.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
    return { tenantId: doc.tenantId, scopes: doc.scopes };
}
