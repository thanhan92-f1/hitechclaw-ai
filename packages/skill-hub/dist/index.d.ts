export declare const version = "2.0.0";
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
export declare class SkillRegistry {
    private entries;
    register(entry: SkillRegistryEntry): void;
    unregister(id: string): boolean;
    get(id: string): SkillRegistryEntry | undefined;
    list(): SkillRegistryEntry[];
    listInstalled(): SkillRegistryEntry[];
    listByDomain(domainId: string): SkillRegistryEntry[];
    search(query: string): SkillRegistryEntry[];
    /** List skills that require sandbox execution */
    listSandboxed(): SkillRegistryEntry[];
    /** Check if a skill should run in a sandbox */
    requiresSandbox(id: string): boolean;
    /** Get the sandbox policy name for a skill */
    getSandboxPolicy(id: string): string;
    markInstalled(id: string, installed: boolean): void;
    /** Import entries from a raw API response (e.g. from GET /api/marketplace/skills) */
    importFromAPI(data: {
        skills: any[];
    }): void;
}
/** Create a new empty SkillRegistry instance. */
export declare function createSkillRegistry(): SkillRegistry;
/**
 * Formats a skill identifier as "domain/skillName" (normalized, lowercase, slugified).
 */
export declare function formatSkillId(domainId: string, skillName: string): string;
/**
 * Returns a human-readable summary of a skill.
 */
export declare function describeSkill(entry: SkillRegistryEntry): string;
//# sourceMappingURL=index.d.ts.map