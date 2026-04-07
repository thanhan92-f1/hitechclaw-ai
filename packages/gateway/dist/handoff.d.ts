import { Hono } from 'hono';
export declare function createHandoffRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function checkEscalationTriggers(tenantId: string, message: string, sessionId: string, userId: string): Promise<{
    shouldEscalate: boolean;
    reason?: string;
    detail?: string;
}>;
//# sourceMappingURL=handoff.d.ts.map