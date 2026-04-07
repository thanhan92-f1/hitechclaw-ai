import { Hono } from 'hono';
import type { IntegrationRegistry } from '@hitechclaw/integrations';

export function createIntegrationRoutes(registry: IntegrationRegistry) {
  const app = new Hono();

  // GET /integrations — List all available integrations
  app.get('/', (c) => {
    const integrations = registry.listAll().map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      icon: i.icon,
      category: i.category,
      authType: i.auth.type,
      actions: i.actions.map((a) => ({ name: a.name, description: a.description })),
      triggers: (i.triggers || []).map((t) => ({ name: t.name, description: t.description, type: 'polling' })),
    }));
    return c.json({ integrations, total: integrations.length });
  });

  // GET /integrations/:id — Get a single integration detail
  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const integration = registry.get(id);
    if (!integration) {
      return c.json({ error: `Integration '${id}' not found` }, 404);
    }
    return c.json({
      id: integration.id,
      name: integration.name,
      description: integration.description,
      icon: integration.icon,
      category: integration.category,
      authType: integration.auth.type,
      actions: integration.actions.map((a) => ({
        name: a.name,
        description: a.description,
        requiresApproval: a.requiresApproval || false,
      })),
      triggers: (integration.triggers || []).map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  });

  // POST /integrations/:id/connect — Connect user to an integration
  app.post('/:id/connect', async (c) => {
    const id = c.req.param('id');
    const integration = registry.get(id);
    if (!integration) {
      return c.json({ error: `Integration '${id}' not found` }, 404);
    }
    const body = await c.req.json<{ credentials: Record<string, string> }>();
    if (!body.credentials) {
      return c.json({ error: 'credentials required' }, 400);
    }
    try {
      const userId = (c.get as any)('userId') || 'anonymous';
      await registry.connect(id, userId, body.credentials);
      return c.json({
        status: 'connected',
        integrationId: id,
        connectedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to connect' }, 500);
    }
  });

  // POST /integrations/:id/disconnect — Disconnect user from an integration
  app.post('/:id/disconnect', async (c) => {
    const id = c.req.param('id');
    const userId = (c.get as any)('userId') || 'anonymous';
    try {
      await registry.disconnect(id, userId);
      return c.json({ status: 'disconnected', integrationId: id });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to disconnect' }, 500);
    }
  });

  // GET /integrations/:id/status — Check connection status
  app.get('/:id/status', (c) => {
    const id = c.req.param('id');
    const userId = (c.get as any)('userId') || 'anonymous';
    const connection = registry.getConnection(id, userId);
    if (!connection) {
      return c.json({ status: 'disconnected', integrationId: id });
    }
    return c.json({
      status: connection.status,
      integrationId: id,
      connectedAt: connection.connectedAt.toISOString(),
      lastUsedAt: connection.lastUsedAt?.toISOString(),
    });
  });

  // POST /integrations/:id/execute — Execute an integration action
  app.post('/:id/execute', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ action: string; params: Record<string, unknown> }>();
    if (!body.action) {
      return c.json({ error: 'action name required' }, 400);
    }
    const userId = (c.get as any)('userId') || 'anonymous';
    try {
      const result = await registry.executeAction(id, body.action, body.params || {}, userId);
      return c.json(result);
    } catch (err: any) {
      return c.json({ success: false, error: err.message || 'Execution failed' }, 500);
    }
  });

  return app;
}
