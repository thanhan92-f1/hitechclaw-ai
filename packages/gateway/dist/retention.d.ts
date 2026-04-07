import { Hono } from 'hono';
export declare function createRetentionRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/** Run retention cleanup for a tenant */
export declare function runRetentionCleanup(tenantId: string): Promise<{
    cleaned: Record<string, number>;
}>;
//# sourceMappingURL=retention.d.ts.map