import { Hono } from 'hono';
import { LANGUAGE_MAP, TenantService } from './tenant.js';
// ─── Per-tenant settings (DB-backed via TenantService) ──────
/**
 * @deprecated Use getTenantLanguageInstruction(settings) with per-tenant settings instead.
 * Kept for backward compatibility during migration.
 */
export function getLanguageInstruction() {
    return ''; // returns empty — callers should migrate to per-tenant version
}
export function createSettingsRoutes() {
    const app = new Hono();
    // GET /settings — Get current tenant's settings
    app.get('/', async (c) => {
        const tenantId = c.get('tenantId');
        const settings = c.get('tenantSettings');
        return c.json({
            aiLanguage: settings.aiLanguage,
            aiLanguageCustom: settings.aiLanguageCustom,
            agentName: settings.agentName,
            enableWebSearch: settings.enableWebSearch,
            enableRag: settings.enableRag,
            enableWorkflows: settings.enableWorkflows,
            languages: Object.entries(LANGUAGE_MAP).map(([code, name]) => ({ code, name })),
            modelDefaults: {
                provider: settings.llmProvider,
                model: settings.llmModel,
                temperature: settings.llmTemperature != null ? settings.llmTemperature / 100 : 0.7,
                maxTokens: settings.llmMaxTokens ?? 2048,
            },
        });
    });
    // GET /settings/setup/status — Check if tenant setup wizard is completed
    app.get('/setup/status', async (c) => {
        const settings = c.get('tenantSettings');
        const branding = (settings.branding ?? {});
        return c.json({ completed: branding.setupCompleted === true });
    });
    // POST /settings/setup/complete — Save initial setup config and mark completed
    app.post('/setup/complete', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (!user.isSuperAdmin && user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        const body = await c.req.json();
        const update = {};
        if (body.agentName)
            update.agentName = String(body.agentName);
        if (body.aiLanguage)
            update.aiLanguage = String(body.aiLanguage);
        if (body.llmProvider)
            update.llmProvider = String(body.llmProvider);
        if (body.llmModel)
            update.llmModel = String(body.llmModel);
        if (body.llmApiKey)
            update.llmApiKey = String(body.llmApiKey);
        if (body.llmBaseUrl)
            update.llmBaseUrl = String(body.llmBaseUrl);
        if (typeof body.enableWebSearch === 'boolean')
            update.enableWebSearch = body.enableWebSearch;
        if (typeof body.enableRag === 'boolean')
            update.enableRag = body.enableRag;
        if (typeof body.enableWorkflows === 'boolean')
            update.enableWorkflows = body.enableWorkflows;
        if (Array.isArray(body.enabledDomains))
            update.enabledDomains = body.enabledDomains;
        // Merge setupCompleted into branding
        const currentSettings = c.get('tenantSettings');
        const currentBranding = (currentSettings.branding ?? {});
        update.branding = { ...currentBranding, setupCompleted: true };
        await TenantService.updateSettings(tenantId, update);
        return c.json({ ok: true });
    });
    // PUT /settings — Update current tenant's settings
    app.put('/', async (c) => {
        const tenantId = c.get('tenantId');
        const user = c.get('user');
        if (!user.isSuperAdmin && user.role !== 'admin' && user.role !== 'owner') {
            return c.json({ error: 'Admin access required' }, 403);
        }
        const body = await c.req.json();
        const allowedKeys = [
            'aiLanguage', 'aiLanguageCustom', 'agentName', 'systemPrompt',
            'enableWebSearch', 'enableRag', 'enableWorkflows',
            'llmProvider', 'llmModel', 'llmApiKey', 'llmBaseUrl',
            'llmTemperature', 'llmMaxTokens', 'tavilyApiKey',
            'enabledDomains', 'enabledIntegrations', 'branding',
        ];
        const filtered = {};
        for (const key of allowedKeys) {
            if (key in body) {
                filtered[key] = body[key];
            }
        }
        // Validate language
        if (filtered.aiLanguage !== undefined) {
            const lang = String(filtered.aiLanguage).toLowerCase().trim();
            if (lang !== 'auto' && !(lang in LANGUAGE_MAP)) {
                return c.json({ error: 'Invalid language code' }, 400);
            }
            filtered.aiLanguage = lang;
        }
        await TenantService.updateSettings(tenantId, filtered);
        return c.json({ ok: true });
    });
    return app;
}
//# sourceMappingURL=settings.js.map