/**
 * Plugin Gateway Routes — Auto-mounts plugin API routes and provides
 * plugin registry/management endpoints.
 */
import { Hono } from 'hono';
export function createPluginRoutes(pluginManager) {
    const app = new Hono();
    // List all registered plugins
    app.get('/', async (c) => {
        try {
            const entries = pluginManager.listAll();
            const plugins = entries.map((e) => ({
                id: e.plugin.id,
                name: e.plugin.name,
                version: e.plugin.version,
                description: e.plugin.description,
                author: e.plugin.author,
                icon: e.plugin.icon,
                type: e.plugin.type,
                status: e.status,
                activatedAt: e.activatedAt,
                error: e.error,
                hasRoutes: !!e.plugin.createRoutes,
                hasDomain: !!e.plugin.domain,
                pages: e.plugin.pages || [],
                collections: (e.plugin.collections || []).map((col) => col.name),
            }));
            return c.json({ ok: true, plugins });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get plugin details
    app.get('/:pluginId', async (c) => {
        try {
            const entry = pluginManager.get(c.req.param('pluginId'));
            if (!entry) {
                return c.json({ error: 'Plugin not found' }, 404);
            }
            const p = entry.plugin;
            return c.json({
                ok: true,
                plugin: {
                    id: p.id,
                    name: p.name,
                    version: p.version,
                    description: p.description,
                    author: p.author,
                    icon: p.icon,
                    type: p.type,
                    status: entry.status,
                    activatedAt: entry.activatedAt,
                    error: entry.error,
                    domain: p.domain ? {
                        agentPersona: p.domain.agentPersona.substring(0, 200) + '...',
                        skills: p.domain.skills.map((s) => ({
                            id: s.id,
                            name: s.name,
                            description: s.description,
                            toolCount: s.tools.length,
                        })),
                        recommendedIntegrations: p.domain.recommendedIntegrations,
                    } : null,
                    pages: p.pages || [],
                    collections: (p.collections || []).map((col) => col.name),
                    configSchema: p.configSchema || [],
                },
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Activate a plugin
    app.post('/:pluginId/activate', async (c) => {
        try {
            await pluginManager.activate(c.req.param('pluginId'));
            return c.json({ ok: true, message: `Plugin '${c.req.param('pluginId')}' activated` });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Deactivate a plugin
    app.post('/:pluginId/deactivate', async (c) => {
        try {
            await pluginManager.deactivate(c.req.param('pluginId'));
            return c.json({ ok: true, message: `Plugin '${c.req.param('pluginId')}' deactivated` });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get all frontend pages from active plugins (for sidebar rendering)
    app.get('/registry/pages', async (c) => {
        try {
            const pages = pluginManager.getPages();
            return c.json({ ok: true, pages });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Mount plugin-specific API routes at /api/plugins/:pluginId/api/*
    const routePlugins = pluginManager.getRoutePlugins();
    for (const { plugin, createRoutes } of routePlugins) {
        const ctx = pluginManager.createContext(plugin.id);
        const pluginApp = createRoutes(ctx);
        if (pluginApp && typeof pluginApp.fetch === 'function') {
            app.route(`/${plugin.id}/api`, pluginApp);
        }
    }
    return app;
}
//# sourceMappingURL=plugins.js.map