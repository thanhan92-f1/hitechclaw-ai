import { channelConnectionsCollection } from '@hitechclaw/db';
import { Hono } from 'hono';
export function createChannelWebhookRoutes(ctx) {
    const app = new Hono();
    app.get('/:connectionId', async (c) => {
        var _a, _b;
        try {
            const connectionId = c.req.param('connectionId');
            const conn = await channelConnectionsCollection().findOne({ _id: connectionId, status: 'active' });
            if (!conn)
                return c.text('Channel not found', 404);
            const instance = (_b = (_a = ctx.channelManager) === null || _a === void 0 ? void 0 : _a.getInstance) === null || _b === void 0 ? void 0 : _b.call(_a, connectionId);
            if (!(instance === null || instance === void 0 ? void 0 : instance.verifyWebhook))
                return c.text('Webhook verification not supported', 400);
            const mode = c.req.query('hub.mode') || c.req.query('mode') || '';
            const token = c.req.query('hub.verify_token') || c.req.query('verify_token') || '';
            const challenge = c.req.query('hub.challenge') || c.req.query('challenge') || '';
            const verified = instance.verifyWebhook(mode, token, challenge);
            if (verified === null)
                return c.text('Forbidden', 403);
            return c.text(verified, 200);
        }
        catch (err) {
            return c.text(err instanceof Error ? err.message : 'Failed', 500);
        }
    });
    app.post('/:connectionId', async (c) => {
        var _a, _b;
        try {
            const connectionId = c.req.param('connectionId');
            const conn = await channelConnectionsCollection().findOne({ _id: connectionId, status: 'active' });
            if (!conn)
                return c.json({ error: 'Channel not found' }, 404);
            const instance = (_b = (_a = ctx.channelManager) === null || _a === void 0 ? void 0 : _a.getInstance) === null || _b === void 0 ? void 0 : _b.call(_a, connectionId);
            if (!(instance === null || instance === void 0 ? void 0 : instance.handleWebhook)) {
                return c.json({ error: 'Webhook handling not supported for this channel' }, 400);
            }
            const payload = await c.req.json();
            await instance.handleWebhook(payload);
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
