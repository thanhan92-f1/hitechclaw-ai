import { Hono } from 'hono';
/**
 * @deprecated Use getTenantLanguageInstruction(settings) with per-tenant settings instead.
 * Kept for backward compatibility during migration.
 */
export declare function getLanguageInstruction(): string;
export declare function createSettingsRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=settings.d.ts.map