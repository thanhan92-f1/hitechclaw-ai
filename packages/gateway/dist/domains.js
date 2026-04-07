import { Hono } from 'hono';
// ─── Installed Domains Registry ─────────────────────────────
// 'general' is always installed by default
const installedDomainIds = new Set(['general']);
export function getInstalledDomainIds() {
    return installedDomainIds;
}
export function createDomainRoutes(domainPacks) {
    const app = new Hono();
    const findDomain = (id) => domainPacks.find((d) => d.id === id);
    // GET /domains — List all domain packs (Store view)
    app.get('/', (c) => {
        const domains = domainPacks.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            icon: d.icon,
            skillCount: d.skills.length,
            skills: d.skills.map((s) => ({ id: s.id, name: s.name, description: s.description })),
            recommendedIntegrations: d.recommendedIntegrations,
            knowledgePacks: d.knowledgePacks || [],
            installed: installedDomainIds.has(d.id),
        }));
        return c.json({ domains, total: domains.length });
    });
    // GET /domains/installed — List only installed domains
    app.get('/installed', (c) => {
        const domains = domainPacks
            .filter((d) => installedDomainIds.has(d.id))
            .map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            icon: d.icon,
            skillCount: d.skills.length,
            skills: d.skills.map((s) => ({ id: s.id, name: s.name, description: s.description })),
        }));
        return c.json({ domains, total: domains.length });
    });
    // POST /domains/:id/install — Install a domain
    app.post('/:id/install', (c) => {
        const id = c.req.param('id');
        const domain = findDomain(id);
        if (!domain) {
            return c.json({ error: `Domain pack '${id}' not found` }, 404);
        }
        installedDomainIds.add(id);
        return c.json({ ok: true, id, installed: true });
    });
    // POST /domains/:id/uninstall — Uninstall a domain
    app.post('/:id/uninstall', (c) => {
        const id = c.req.param('id');
        if (id === 'general') {
            return c.json({ error: 'Cannot uninstall the General domain' }, 400);
        }
        const domain = findDomain(id);
        if (!domain) {
            return c.json({ error: `Domain pack '${id}' not found` }, 404);
        }
        installedDomainIds.delete(id);
        return c.json({ ok: true, id, installed: false });
    });
    // GET /domains/:id — Get a single domain pack with full details
    app.get('/:id', (c) => {
        const id = c.req.param('id');
        const domain = findDomain(id);
        if (!domain) {
            return c.json({ error: `Domain pack '${id}' not found` }, 404);
        }
        return c.json({
            id: domain.id,
            name: domain.name,
            description: domain.description,
            icon: domain.icon,
            agentPersona: domain.agentPersona,
            installed: installedDomainIds.has(domain.id),
            skills: domain.skills.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                version: s.version,
                category: s.category,
                tools: s.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                })),
            })),
            recommendedIntegrations: domain.recommendedIntegrations,
            knowledgePacks: domain.knowledgePacks || [],
        });
    });
    // GET /domains/:id/persona — Get just the agent persona for a domain
    app.get('/:id/persona', (c) => {
        const id = c.req.param('id');
        const domain = findDomain(id);
        if (!domain) {
            return c.json({ error: `Domain pack '${id}' not found` }, 404);
        }
        return c.json({ id: domain.id, persona: domain.agentPersona });
    });
    // POST /domains/:domainId/skills/:skillId/tools/:toolName/execute — Execute a domain tool
    app.post('/:domainId/skills/:skillId/tools/:toolName/execute', async (c) => {
        const { domainId, skillId, toolName } = c.req.param();
        const domain = findDomain(domainId);
        if (!domain) {
            return c.json({ error: `Domain '${domainId}' not found` }, 404);
        }
        if (!installedDomainIds.has(domainId)) {
            return c.json({ error: `Domain '${domainId}' is not installed` }, 403);
        }
        const skill = domain.skills.find((s) => s.id === skillId);
        if (!skill) {
            return c.json({ error: `Skill '${skillId}' not found in domain '${domainId}'` }, 404);
        }
        const tool = skill.tools.find((t) => t.name === toolName);
        if (!tool) {
            return c.json({ error: `Tool '${toolName}' not found in skill '${skillId}'` }, 404);
        }
        const body = await c.req.json();
        try {
            const result = await tool.execute(body.params || {});
            return c.json(result);
        }
        catch (err) {
            return c.json({ success: false, error: err.message || 'Execution failed' }, 500);
        }
    });
    return app;
}
