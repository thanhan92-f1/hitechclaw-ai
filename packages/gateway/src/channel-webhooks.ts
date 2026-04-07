import { channelConnectionsCollection } from '@hitechclaw/db';
import { Hono } from 'hono';
import type { GatewayContext } from './gateway.js';

interface VerifiableChannel {
  verifyWebhook?: (mode: string, token: string, challenge: string) => string | null;
}

interface WebhookChannel {
  handleWebhook?: (payload: unknown) => Promise<void>;
}

export function createChannelWebhookRoutes(ctx: GatewayContext) {
  const app = new Hono();

  app.get('/:connectionId', async (c) => {
    try {
      const connectionId = c.req.param('connectionId');
      const conn = await channelConnectionsCollection().findOne({ _id: connectionId, status: 'active' });
      if (!conn) return c.text('Channel not found', 404);

      const instance = ctx.channelManager?.getInstance?.(connectionId) as VerifiableChannel | undefined;
      if (!instance?.verifyWebhook) return c.text('Webhook verification not supported', 400);

      const mode = c.req.query('hub.mode') || c.req.query('mode') || '';
      const token = c.req.query('hub.verify_token') || c.req.query('verify_token') || '';
      const challenge = c.req.query('hub.challenge') || c.req.query('challenge') || '';

      const verified = instance.verifyWebhook(mode, token, challenge);
      if (verified === null) return c.text('Forbidden', 403);
      return c.text(verified, 200);
    } catch (err) {
      return c.text(err instanceof Error ? err.message : 'Failed', 500);
    }
  });

  app.post('/:connectionId', async (c) => {
    try {
      const connectionId = c.req.param('connectionId');
      const conn = await channelConnectionsCollection().findOne({ _id: connectionId, status: 'active' });
      if (!conn) return c.json({ error: 'Channel not found' }, 404);

      const instance = ctx.channelManager?.getInstance?.(connectionId) as WebhookChannel | undefined;
      if (!instance?.handleWebhook) {
        return c.json({ error: 'Webhook handling not supported for this channel' }, 400);
      }

      const payload = await c.req.json();
      await instance.handleWebhook(payload);

      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}
