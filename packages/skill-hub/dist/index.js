// ============================================================
// @hitechclaw/skill-hub — Skill Registry SDK
// ============================================================
// Provides types and helpers for the HiTechClaw skill marketplace.
// The actual API server lives in @hitechclaw/gateway/marketplace.
export const version = '2.0.0';
// ---------------------------------------------------------------------------
// In-memory registry (for SDK consumers that manage skills locally)
// ---------------------------------------------------------------------------
export class SkillRegistry {
    entries = new Map();
    register(entry) {
        this.entries.set(entry.id, { ...entry });
    }
    unregister(id) {
        return this.entries.delete(id);
    }
    get(id) {
        return this.entries.get(id);
    }
    list() {
        return [...this.entries.values()];
    }
    listInstalled() {
        return this.list().filter((e) => e.installed);
    }
    listByDomain(domainId) {
        return this.list().filter((e) => e.domainId === domainId);
    }
    search(query) {
        const q = query.toLowerCase();
        return this.list().filter((e) => e.name.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.tags?.some((t) => t.toLowerCase().includes(q)));
    }
    /** List skills that require sandbox execution */
    listSandboxed() {
        return this.list().filter((e) => e.sandboxRequired || e.trustLevel === 'community' || e.trustLevel === 'untrusted');
    }
    /** Check if a skill should run in a sandbox */
    requiresSandbox(id) {
        const entry = this.entries.get(id);
        if (!entry)
            return true; // Unknown skills default to sandboxed
        if (entry.sandboxRequired)
            return true;
        return entry.trustLevel === 'community' || entry.trustLevel === 'untrusted';
    }
    /** Get the sandbox policy name for a skill */
    getSandboxPolicy(id) {
        const entry = this.entries.get(id);
        if (entry?.sandboxPolicy)
            return entry.sandboxPolicy;
        switch (entry?.trustLevel) {
            case 'builtin': return 'permissive';
            case 'verified': return 'default';
            case 'community': return 'strict';
            case 'untrusted': return 'strict';
            default: return 'default';
        }
    }
    markInstalled(id, installed) {
        const entry = this.entries.get(id);
        if (entry)
            entry.installed = installed;
    }
    /** Import entries from a raw API response (e.g. from GET /api/marketplace/skills) */
    importFromAPI(data) {
        for (const s of data.skills ?? []) {
            this.register({
                id: s.id,
                name: s.name,
                description: s.description,
                domainId: s.domainId ?? s.id.split('/')[0] ?? 'general',
                icon: s.icon,
                tools: s.tools ?? [],
                installed: s.installed ?? false,
                version: s.version,
                tags: s.tags,
                author: s.author,
                trustLevel: s.trustLevel ?? 'community',
                sandboxRequired: s.sandboxRequired ?? (s.trustLevel === 'community' || s.trustLevel === 'untrusted'),
                sandboxPolicy: s.sandboxPolicy,
            });
        }
    }
}
/** Create a new empty SkillRegistry instance. */
export function createSkillRegistry() {
    return new SkillRegistry();
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Formats a skill identifier as "domain/skillName" (normalized, lowercase, slugified).
 */
export function formatSkillId(domainId, skillName) {
    const slug = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    return `${slug(domainId)}/${slug(skillName)}`;
}
/**
 * Returns a human-readable summary of a skill.
 */
export function describeSkill(entry) {
    const toolList = entry.tools.map((t) => t.name).join(', ');
    return `[${entry.domainId}] ${entry.name} — ${entry.description}` +
        (toolList ? ` (tools: ${toolList})` : '');
}
//# sourceMappingURL=index.js.map