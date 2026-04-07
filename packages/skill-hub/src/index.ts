// ============================================================
// @hitechclaw/skill-hub — Skill Registry SDK
// ============================================================
// Provides types and helpers for the HiTechClaw skill marketplace.
// The actual API server lives in @hitechclaw/gateway/marketplace.

export const version = '2.0.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface SkillTool {
  name: string;
  description: string;
  parameters?: SkillParameter[];
}

export type SkillTrustLevel = 'builtin' | 'verified' | 'community' | 'untrusted';

export interface SkillRegistryEntry {
  /** Unique skill identifier within a domain (e.g. "healthcare/patient_search") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what this skill does */
  description: string;
  /** Domain this skill belongs to */
  domainId: string;
  /** Icon name (lucide-react) or emoji */
  icon?: string;
  /** Tools exposed by this skill */
  tools: SkillTool[];
  /** Whether this skill is currently installed/enabled */
  installed: boolean;
  /** Semantic version */
  version?: string;
  /** Tags for filtering in marketplace */
  tags?: string[];
  /** Author / source */
  author?: string;
  /** Trust level — determines sandbox policy */
  trustLevel?: SkillTrustLevel;
  /** Whether this skill requires sandbox execution */
  sandboxRequired?: boolean;
  /** Custom sandbox policy name (from builtin policies) */
  sandboxPolicy?: string;
}

export interface SkillInstallResult {
  ok: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// In-memory registry (for SDK consumers that manage skills locally)
// ---------------------------------------------------------------------------

export class SkillRegistry {
  private entries = new Map<string, SkillRegistryEntry>();

  register(entry: SkillRegistryEntry): void {
    this.entries.set(entry.id, { ...entry });
  }

  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  get(id: string): SkillRegistryEntry | undefined {
    return this.entries.get(id);
  }

  list(): SkillRegistryEntry[] {
    return [...this.entries.values()];
  }

  listInstalled(): SkillRegistryEntry[] {
    return this.list().filter((e) => e.installed);
  }

  listByDomain(domainId: string): SkillRegistryEntry[] {
    return this.list().filter((e) => e.domainId === domainId);
  }

  search(query: string): SkillRegistryEntry[] {
    const q = query.toLowerCase();
    return this.list().filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }

  /** List skills that require sandbox execution */
  listSandboxed(): SkillRegistryEntry[] {
    return this.list().filter((e) => e.sandboxRequired || e.trustLevel === 'community' || e.trustLevel === 'untrusted');
  }

  /** Check if a skill should run in a sandbox */
  requiresSandbox(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return true; // Unknown skills default to sandboxed
    if (entry.sandboxRequired) return true;
    return entry.trustLevel === 'community' || entry.trustLevel === 'untrusted';
  }

  /** Get the sandbox policy name for a skill */
  getSandboxPolicy(id: string): string {
    const entry = this.entries.get(id);
    if (entry?.sandboxPolicy) return entry.sandboxPolicy;
    switch (entry?.trustLevel) {
      case 'builtin': return 'permissive';
      case 'verified': return 'default';
      case 'community': return 'strict';
      case 'untrusted': return 'strict';
      default: return 'default';
    }
  }

  markInstalled(id: string, installed: boolean): void {
    const entry = this.entries.get(id);
    if (entry) entry.installed = installed;
  }

  /** Import entries from a raw API response (e.g. from GET /api/marketplace/skills) */
  importFromAPI(data: { skills: any[] }): void {
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
export function createSkillRegistry(): SkillRegistry {
  return new SkillRegistry();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a skill identifier as "domain/skillName" (normalized, lowercase, slugified).
 */
export function formatSkillId(domainId: string, skillName: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  return `${slug(domainId)}/${slug(skillName)}`;
}

/**
 * Returns a human-readable summary of a skill.
 */
export function describeSkill(entry: SkillRegistryEntry): string {
  const toolList = entry.tools.map((t) => t.name).join(', ');
  return `[${entry.domainId}] ${entry.name} — ${entry.description}` +
    (toolList ? ` (tools: ${toolList})` : '');
}
