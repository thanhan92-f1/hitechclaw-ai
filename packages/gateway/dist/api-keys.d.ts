import { Hono } from 'hono';
export declare function createApiKeyRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/** Validate an API key — call from auth middleware as a fallback */
export declare function validateApiKey(rawKey: string): Promise<{
    tenantId: string;
    scopes: string[];
} | null>;
//# sourceMappingURL=api-keys.d.ts.map