import { Hono } from 'hono';
import type { GatewayContext } from './gateway.js';
interface JWTPayload {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    isSuperAdmin: boolean;
}
declare module 'hono' {
    interface ContextVariableMap {
        user: JWTPayload;
    }
}
export declare function authMiddleware(jwtSecret: string): (c: any, next: () => Promise<void>) => Promise<void>;
export declare function createAuthRoutes(ctx: GatewayContext): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=auth.d.ts.map