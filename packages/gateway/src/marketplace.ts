import { Hono } from 'hono';
import type { DomainPack } from '@hitechclaw/domains';
import { getInstalledDomainIds } from './domains.js';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  rating: number;
  downloads: number;
  installed: boolean;
  icon: string;
  tags: string[];
  domainId: string;
}

// In-memory store for user-published skills
const publishedSkills: Array<{
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  icon: string;
  tags: string[];
  tools: Array<{ name: string; description: string; parameters?: unknown }>;
  publishedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  validationErrors: string[];
}> = [];

function validateSkillPackage(pkg: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!pkg.name || typeof pkg.name !== 'string') errors.push('name is required (string)');
  if (!pkg.description || typeof pkg.description !== 'string') errors.push('description is required (string)');
  if (!pkg.version || typeof pkg.version !== 'string') errors.push('version is required (semver string)');
  if (typeof pkg.version === 'string' && !/^\d+\.\d+\.\d+/.test(pkg.version)) errors.push('version must be semver (e.g. 1.0.0)');
  if (!pkg.tools || !Array.isArray(pkg.tools) || pkg.tools.length === 0) errors.push('tools array is required and must not be empty');
  if (Array.isArray(pkg.tools)) {
    for (let i = 0; i < pkg.tools.length; i++) {
      const t = pkg.tools[i] as Record<string, unknown>;
      if (!t.name) errors.push(`tools[${i}].name is required`);
      if (!t.description) errors.push(`tools[${i}].description is required`);
    }
  }
  return errors;
}

export function createMarketplaceRoutes(domainPacks: DomainPack[]) {
  const app = new Hono();

  // GET /marketplace/skills — Return all skills as marketplace items
  app.get('/skills', (c) => {
    const installed = getInstalledDomainIds();
    const items: MarketplaceItem[] = [];

    for (const domain of domainPacks) {
      const isInstalled = installed.has(domain.id);
      for (const skill of domain.skills) {
        // Map skill category → marketplace category bucket
        const cat = skill.category ?? 'productivity';

        items.push({
          id: `${domain.id}:${skill.id}`,
          name: skill.name,
          description: skill.description,
          version: skill.version ?? '1.0.0',
          author: `HiTechClaw – ${domain.name}`,
          category: cat,
          rating: 0,
          downloads: 0,
          installed: isInstalled,
          icon: domain.icon ?? '🧩',
          tags: [domain.id, skill.category ?? cat].filter(Boolean),
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
    if (!domain) return c.json({ error: 'Domain not found' }, 404);
    getInstalledDomainIds().add(domainId);
    return c.json({ ok: true, id: c.req.param('id'), installed: true });
  });

  // POST /marketplace/skills/:id/uninstall — Uninstall a domain
  app.post('/skills/:id/uninstall', (c) => {
    const [domainId] = c.req.param('id').split(':');
    if (domainId === 'general') return c.json({ error: 'Cannot uninstall the general domain' }, 400);
    getInstalledDomainIds().delete(domainId);
    return c.json({ ok: true, id: c.req.param('id'), installed: false });
  });

  // ─── Skill Publishing Pipeline ────────────────────────────

  // POST /marketplace/publish/validate — Validate a skill package without publishing
  app.post('/publish/validate', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const errors = validateSkillPackage(body);
      return c.json({ ok: errors.length === 0, errors });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid JSON' }, 400);
    }
  });

  // POST /marketplace/publish — Publish a skill package
  app.post('/publish', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const errors = validateSkillPackage(body);
      if (errors.length > 0) {
        return c.json({ ok: false, errors }, 400);
      }

      const name = body.name as string;
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
        description: body.description as string,
        version: body.version as string,
        author: (body.author as string) || 'Community',
        category: (body.category as string) || 'productivity',
        icon: (body.icon as string) || '🧩',
        tags: (body.tags as string[]) || [],
        tools: (body.tools as Array<{ name: string; description: string; parameters?: unknown }>) || [],
        publishedAt: new Date().toISOString(),
        status: 'approved' as const,
        validationErrors: [],
      };
      publishedSkills.push(entry);

      return c.json({ ok: true, skill: entry }, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Publish failed' }, 500);
    }
  });

  // GET /marketplace/published — List user-published skills
  app.get('/published', (c) => {
    return c.json({ skills: publishedSkills, total: publishedSkills.length });
  });

  return app;
}
