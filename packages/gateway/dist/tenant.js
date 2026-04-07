import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { getDB, tenants, tenantSettings, users, eq, and } from '@hitechclaw/db';
import { seedDefaultRoles, assignRoleToUser } from './rbac.js';
function toTenantInfo(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        plan: row.plan,
        status: row.status,
        metadata: (row.metadata ?? {}),
    };
}
// ─── In-memory cache (tenant settings) ──────────────────────
const settingsCache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute
function invalidateCache(tenantId) {
    settingsCache.delete(tenantId);
}
// ─── TenantService ──────────────────────────────────────────
export const TenantService = {
    async getById(tenantId) {
        const db = getDB();
        const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        return rows[0] ? toTenantInfo(rows[0]) : null;
    },
    async getBySlug(slug) {
        const db = getDB();
        const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
        return rows[0] ? toTenantInfo(rows[0]) : null;
    },
    async list() {
        const db = getDB();
        const rows = await db.select().from(tenants).where(eq(tenants.status, 'active'));
        return rows.map(toTenantInfo);
    },
    async create(data) {
        const db = getDB();
        const id = randomUUID();
        const now = new Date();
        // Check slug uniqueness
        const existing = await db.select().from(tenants).where(eq(tenants.slug, data.slug)).limit(1);
        if (existing.length > 0) {
            throw new Error('Tenant slug already exists');
        }
        const [tenant] = await db.insert(tenants).values({
            id,
            name: data.name,
            slug: data.slug,
            plan: data.plan ?? 'free',
            status: 'active',
            metadata: data.metadata ?? {},
            createdAt: now,
            updatedAt: now,
        }).returning();
        // Create default settings
        await db.insert(tenantSettings).values({
            id: randomUUID(),
            tenantId: id,
            createdAt: now,
            updatedAt: now,
        });
        return toTenantInfo(tenant);
    },
    async update(tenantId, data) {
        const db = getDB();
        const [updated] = await db.update(tenants)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(tenants.id, tenantId))
            .returning();
        return updated ? toTenantInfo(updated) : null;
    },
    // ─── Settings ───────────────────────────────────────────
    async getSettings(tenantId) {
        // Check cache
        const cached = settingsCache.get(tenantId);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            return cached.data;
        }
        const db = getDB();
        const rows = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        const result = {
            llmProvider: row.llmProvider,
            llmModel: row.llmModel,
            llmApiKey: row.llmApiKey,
            llmBaseUrl: row.llmBaseUrl,
            llmTemperature: row.llmTemperature,
            llmMaxTokens: row.llmMaxTokens,
            agentName: row.agentName,
            systemPrompt: row.systemPrompt,
            aiLanguage: row.aiLanguage,
            aiLanguageCustom: row.aiLanguageCustom,
            enableWebSearch: row.enableWebSearch,
            enableRag: row.enableRag,
            enableWorkflows: row.enableWorkflows,
            enabledDomains: row.enabledDomains,
            enabledIntegrations: row.enabledIntegrations,
            maxUsersPerTenant: row.maxUsersPerTenant,
            maxSessionsPerUser: row.maxSessionsPerUser,
            maxMessagesPerDay: row.maxMessagesPerDay,
            tavilyApiKey: row.tavilyApiKey,
            branding: row.branding,
            sandboxConfig: (row.sandboxConfig ?? {
                enabled: false,
                defaultPolicy: 'default',
                maxConcurrentSandboxes: 5,
                idleTimeoutMs: 300000,
                cpuLimit: '0.5',
                memoryLimit: '512Mi',
                gpuEnabled: false,
            }),
        };
        settingsCache.set(tenantId, { data: result, cachedAt: Date.now() });
        return result;
    },
    async updateSettings(tenantId, data) {
        const db = getDB();
        await db.update(tenantSettings)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(tenantSettings.tenantId, tenantId));
        invalidateCache(tenantId);
        return this.getSettings(tenantId);
    },
};
// ─── Language helper (per-tenant) ───────────────────────────
const LANGUAGE_MAP = {
    vi: 'Vietnamese (Tiếng Việt)',
    en: 'English',
    ja: 'Japanese (日本語)',
    ko: 'Korean (한국어)',
    zh: 'Chinese Simplified (简体中文)',
    'zh-tw': 'Chinese Traditional (繁體中文)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    es: 'Spanish (Español)',
    pt: 'Portuguese (Português)',
    it: 'Italian (Italiano)',
    ru: 'Russian (Русский)',
    th: 'Thai (ภาษาไทย)',
    id: 'Indonesian (Bahasa Indonesia)',
    ms: 'Malay (Bahasa Melayu)',
    ar: 'Arabic (العربية)',
    hi: 'Hindi (हिन्दी)',
};
export function getTenantLanguageInstruction(settings) {
    if (settings.aiLanguage === 'auto')
        return '';
    if (settings.aiLanguageCustom?.trim())
        return settings.aiLanguageCustom.trim();
    const langName = LANGUAGE_MAP[settings.aiLanguage];
    if (langName)
        return `You MUST respond in ${langName}. All your responses, explanations, and outputs must be written in ${langName}.`;
    return '';
}
export { LANGUAGE_MAP };
export function tenantMiddleware() {
    return async (c, next) => {
        const user = c.get('user');
        if (!user?.tenantId) {
            throw new HTTPException(403, { message: 'No tenant associated with user' });
        }
        // Super admin uses platform tenant settings but can access any tenant's data
        const tenantId = user.tenantId;
        const settings = await TenantService.getSettings(tenantId);
        if (!settings) {
            // For super admin, create minimal settings context so middleware doesn't block
            if (user.isSuperAdmin) {
                c.set('tenantId', tenantId);
                c.set('tenantSettings', {
                    llmProvider: 'ollama', llmModel: 'qwen2.5:14b', llmApiKey: null,
                    llmBaseUrl: null, llmTemperature: null, llmMaxTokens: null,
                    agentName: 'HiTechClaw Assistant', systemPrompt: null,
                    aiLanguage: 'auto', aiLanguageCustom: null,
                    enableWebSearch: true, enableRag: true, enableWorkflows: true,
                    enabledDomains: [], enabledIntegrations: [],
                    maxUsersPerTenant: 999, maxSessionsPerUser: 999, maxMessagesPerDay: 99999,
                    tavilyApiKey: null, branding: {},
                    sandboxConfig: { enabled: false, defaultPolicy: 'default', maxConcurrentSandboxes: 5, idleTimeoutMs: 300000, cpuLimit: '0.5', memoryLimit: '512Mi', gpuEnabled: false },
                });
                await next();
                return;
            }
            throw new HTTPException(403, { message: 'Tenant settings not found' });
        }
        // Check tenant is active (super admin bypasses)
        if (!user.isSuperAdmin) {
            const tenant = await TenantService.getById(tenantId);
            if (!tenant || tenant.status !== 'active') {
                throw new HTTPException(403, { message: 'Tenant is not active' });
            }
        }
        c.set('tenantId', tenantId);
        c.set('tenantSettings', settings);
        await next();
    };
}
// ─── Tenant CRUD Routes ────────────────────────────────────
// Super Admin: full CRUD on all tenants + create tenant admin users
// Tenant Owner/Admin: view and update their own tenant only
export function createTenantRoutes() {
    const app = new Hono();
    // GET /tenants — list all tenants (super admin) or own tenant (tenant admin)
    app.get('/', async (c) => {
        const user = c.get('user');
        if (user.isSuperAdmin) {
            // Super admin sees all tenants (including inactive)
            const db = getDB();
            const rows = await db.select().from(tenants);
            return c.json(rows.map(toTenantInfo));
        }
        // Tenant admin/owner sees only their own tenant
        if (user.role !== 'admin' && user.role !== 'owner') {
            throw new HTTPException(403, { message: 'Admin access required' });
        }
        const tenant = await TenantService.getById(user.tenantId);
        return c.json(tenant ? [tenant] : []);
    });
    // GET /tenants/list — public list of active tenant slugs (for login selector)
    app.get('/list', async (c) => {
        const db = getDB();
        const rows = await db.select({ slug: tenants.slug, name: tenants.name })
            .from(tenants)
            .where(and(eq(tenants.status, 'active')));
        // Exclude platform tenant from the public list
        return c.json(rows.filter(r => r.slug !== 'platform'));
    });
    // GET /tenants/:id
    app.get('/:id', async (c) => {
        const user = c.get('user');
        const tenantId = c.req.param('id');
        // Only super admin or users from the same tenant
        if (!user.isSuperAdmin && user.tenantId !== tenantId) {
            throw new HTTPException(403, { message: 'Access denied' });
        }
        const tenant = await TenantService.getById(tenantId);
        if (!tenant)
            throw new HTTPException(404, { message: 'Tenant not found' });
        return c.json(tenant);
    });
    // POST /tenants — create new tenant (SUPER ADMIN ONLY)
    app.post('/', async (c) => {
        const user = c.get('user');
        if (!user.isSuperAdmin) {
            throw new HTTPException(403, { message: 'Super Admin access required' });
        }
        const body = await c.req.json();
        const { name, slug, plan, metadata } = body;
        if (!name || !slug) {
            return c.json({ error: 'name and slug are required' }, 400);
        }
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
            return c.json({ error: 'slug must be lowercase alphanumeric with hyphens, 1-63 chars' }, 400);
        }
        if (slug === 'platform') {
            return c.json({ error: 'Cannot use reserved slug "platform"' }, 400);
        }
        try {
            const tenant = await TenantService.create({ name, slug, plan, metadata });
            // Seed default roles for the new tenant
            await seedDefaultRoles(tenant.id);
            return c.json(tenant, 201);
        }
        catch (err) {
            if (err.message?.includes('already exists')) {
                return c.json({ error: err.message }, 409);
            }
            throw err;
        }
    });
    // PUT /tenants/:id — update tenant
    app.put('/:id', async (c) => {
        const user = c.get('user');
        const tenantId = c.req.param('id');
        // Super admin can update any tenant; tenant owner/admin can update their own
        if (!user.isSuperAdmin) {
            if (user.tenantId !== tenantId || (user.role !== 'admin' && user.role !== 'owner')) {
                throw new HTTPException(403, { message: 'Access denied' });
            }
        }
        const body = await c.req.json();
        // Non-super-admin cannot change plan or status
        if (!user.isSuperAdmin) {
            delete body.plan;
            delete body.status;
        }
        const updated = await TenantService.update(tenantId, body);
        if (!updated)
            throw new HTTPException(404, { message: 'Tenant not found' });
        return c.json(updated);
    });
    // DELETE /tenants/:id — suspend tenant (SUPER ADMIN ONLY)
    app.delete('/:id', async (c) => {
        const user = c.get('user');
        if (!user.isSuperAdmin) {
            throw new HTTPException(403, { message: 'Super Admin access required' });
        }
        const tenantId = c.req.param('id');
        if (tenantId === 'platform') {
            return c.json({ error: 'Cannot delete platform tenant' }, 400);
        }
        const updated = await TenantService.update(tenantId, { status: 'suspended' });
        if (!updated)
            throw new HTTPException(404, { message: 'Tenant not found' });
        return c.json({ success: true, tenant: updated });
    });
    // POST /tenants/:id/admin — create admin user for a tenant (SUPER ADMIN ONLY)
    app.post('/:id/admin', async (c) => {
        const user = c.get('user');
        if (!user.isSuperAdmin) {
            throw new HTTPException(403, { message: 'Super Admin access required' });
        }
        const tenantId = c.req.param('id');
        const tenant = await TenantService.getById(tenantId);
        if (!tenant)
            throw new HTTPException(404, { message: 'Tenant not found' });
        const body = await c.req.json();
        const { name, email, password } = body;
        if (!name || !email || !password) {
            return c.json({ error: 'name, email, and password are required' }, 400);
        }
        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }
        const db = getDB();
        const [existing] = await db.select().from(users)
            .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
            .limit(1);
        if (existing) {
            return c.json({ error: 'User with this email already exists in this tenant' }, 409);
        }
        // Hash password with PBKDF2
        const encoder = new TextEncoder();
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' }, keyMaterial, 256);
        const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
        const passwordHash = `pbkdf2:${salt}:${hash}`;
        const userId = randomUUID();
        const now = new Date();
        await db.insert(users).values({
            id: userId, tenantId, name, email, passwordHash,
            role: 'owner', status: 'active',
            createdAt: now, updatedAt: now,
        });
        // Ensure default roles exist and assign owner
        await seedDefaultRoles(tenantId);
        await assignRoleToUser(userId, 'owner', tenantId, user.sub);
        return c.json({
            user: { id: userId, name, email, role: 'owner', tenantId },
        }, 201);
    });
    // GET /tenants/:id/settings
    app.get('/:id/settings', async (c) => {
        const user = c.get('user');
        const tenantId = c.req.param('id');
        if (!user.isSuperAdmin && user.tenantId !== tenantId) {
            throw new HTTPException(403, { message: 'Access denied' });
        }
        const settings = await TenantService.getSettings(tenantId);
        if (!settings)
            throw new HTTPException(404, { message: 'Settings not found' });
        const safe = {
            ...settings,
            llmApiKey: settings.llmApiKey ? '***' : null,
            tavilyApiKey: settings.tavilyApiKey ? '***' : null,
        };
        return c.json({
            ...safe,
            languages: Object.entries(LANGUAGE_MAP).map(([code, name]) => ({ code, name })),
        });
    });
    // PUT /tenants/:id/settings
    app.put('/:id/settings', async (c) => {
        const user = c.get('user');
        const tenantId = c.req.param('id');
        // Super admin can update any tenant's settings
        if (!user.isSuperAdmin) {
            if (user.tenantId !== tenantId || (user.role !== 'admin' && user.role !== 'owner')) {
                throw new HTTPException(403, { message: 'Access denied' });
            }
        }
        const body = await c.req.json();
        const updated = await TenantService.updateSettings(tenantId, body);
        if (!updated)
            throw new HTTPException(404, { message: 'Settings not found' });
        return c.json({ ok: true });
    });
    return app;
}
//# sourceMappingURL=tenant.js.map