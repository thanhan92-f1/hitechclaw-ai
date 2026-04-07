import { Hono } from 'hono';
import { getInstalledDomainIds } from './domains.js';
// In-memory store for user-published skills
const publishedSkills = [];
function validateSkillPackage(pkg) {
    const errors = [];
    if (!pkg.name || typeof pkg.name !== 'string')
        errors.push('name is required (string)');
    if (!pkg.description || typeof pkg.description !== 'string')
        errors.push('description is required (string)');
    if (!pkg.version || typeof pkg.version !== 'string')
        errors.push('version is required (semver string)');
    if (typeof pkg.version === 'string' && !/^\d+\.\d+\.\d+/.test(pkg.version))
        errors.push('version must be semver (e.g. 1.0.0)');
    if (!pkg.tools || !Array.isArray(pkg.tools) || pkg.tools.length === 0)
        errors.push('tools array is required and must not be empty');
    if (Array.isArray(pkg.tools)) {
        for (let i = 0; i < pkg.tools.length; i++) {
            const t = pkg.tools[i];
            if (!t.name)
                errors.push(`tools[${i}].name is required`);
            if (!t.description)
                errors.push(`tools[${i}].description is required`);
        }
    }
    return errors;
}
export function createMarketplaceRoutes(domainPacks) {
    const app = new Hono();
    // GET /marketplace/skills — Return all skills as marketplace items
    app.get('/skills', (c) => {
        var _a, _b, _c, _d;
        const installed = getInstalledDomainIds();
        const items = [];
        for (const domain of domainPacks) {
            const isInstalled = installed.has(domain.id);
            for (const skill of domain.skills) {
                // Map skill category → marketplace category bucket
                const cat = (_a = skill.category) !== null && _a !== void 0 ? _a : 'productivity';
                items.push({
                    id: `${domain.id}:${skill.id}`,
                    name: skill.name,
                    description: skill.description,
                    version: (_b = skill.version) !== null && _b !== void 0 ? _b : '1.0.0',
                    author: `HiTechClaw – ${domain.name}`,
                    category: cat,
                    rating: 0,
                    downloads: 0,
                    installed: isInstalled,
                    icon: (_c = domain.icon) !== null && _c !== void 0 ? _c : '🧩',
                    tags: [domain.id, (_d = skill.category) !== null && _d !== void 0 ? _d : cat].filter(Boolean),
                    domainId: domain.id,
                });
            }
        }
        return c.json({ skills: items, total: items.length });
    });
    // POST /marketplace/skills/:id/install — Install a domain (enable all its skills)
    app.post('/skills/:id/install', (c) => {
        const [domainId] = c.req.param('id').split(':');
        const domain = domainPacks.find((d) => d.id === domainId);
        if (!domain)
            return c.json({ error: 'Domain not found' }, 404);
        getInstalledDomainIds().add(domainId);
        return c.json({ ok: true, id: c.req.param('id'), installed: true });
    });
    // POST /marketplace/skills/:id/uninstall — Uninstall a domain
    app.post('/skills/:id/uninstall', (c) => {
        const [domainId] = c.req.param('id').split(':');
        if (domainId === 'general')
            return c.json({ error: 'Cannot uninstall the general domain' }, 400);
        getInstalledDomainIds().delete(domainId);
        return c.json({ ok: true, id: c.req.param('id'), installed: false });
    });
    // ─── Skill Publishing Pipeline ────────────────────────────
    // POST /marketplace/publish/validate — Validate a skill package without publishing
    app.post('/publish/validate', async (c) => {
        try {
            const body = await c.req.json();
            const errors = validateSkillPackage(body);
            return c.json({ ok: errors.length === 0, errors });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Invalid JSON' }, 400);
        }
    });
    // POST /marketplace/publish — Publish a skill package
    app.post('/publish', async (c) => {
        try {
            const body = await c.req.json();
            const errors = validateSkillPackage(body);
            if (errors.length > 0) {
                return c.json({ ok: false, errors }, 400);
            }
            const name = body.name;
            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const id = `community/${slug}`;
            // Check for duplicate
            const existing = publishedSkills.find((s) => s.id === id && s.version === body.version);
            if (existing) {
                return c.json({ error: `Skill ${id}@${body.version} already published` }, 409);
            }
            const entry = {
                id,
                name,
                description: body.description,
                version: body.version,
                author: body.author || 'Community',
                category: body.category || 'productivity',
                icon: body.icon || '🧩',
                tags: body.tags || [],
                tools: body.tools || [],
                publishedAt: new Date().toISOString(),
                status: 'approved',
                validationErrors: [],
            };
            publishedSkills.push(entry);
            return c.json({ ok: true, skill: entry }, 201);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Publish failed' }, 500);
        }
    });
    // GET /marketplace/published — List user-published skills
    app.get('/published', (c) => {
        return c.json({ skills: publishedSkills, total: publishedSkills.length });
    });
    return app;
}
