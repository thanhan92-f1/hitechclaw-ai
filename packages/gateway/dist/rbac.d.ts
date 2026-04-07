import { Hono } from 'hono';
export declare const RESOURCES: readonly ["chat", "sessions", "knowledge", "workflows", "integrations", "domains", "settings", "users", "roles", "tenants", "models", "ml", "agents", "webhooks", "mcp"];
export declare const ACTIONS: readonly ["read", "write", "delete", "manage"];
export type Resource = typeof RESOURCES[number];
export type Action = typeof ACTIONS[number];
export type PermissionKey = `${Resource}:${Action}` | '*:*';
export declare const ALL_PERMISSIONS: Array<{
    resource: Resource;
    action: Action;
    description: string;
}>;
interface RoleTemplate {
    name: string;
    displayName: string;
    description: string;
    permissions: PermissionKey[];
}
export declare const DEFAULT_ROLE_TEMPLATES: RoleTemplate[];
export declare function seedPermissions(): Promise<void>;
export declare function seedDefaultRoles(tenantId: string): Promise<void>;
export declare function assignRoleToUser(userId: string, roleName: string, tenantId: string, assignedBy?: string): Promise<void>;
export declare function getUserPermissions(userId: string): Promise<Set<string>>;
export declare function hasPermission(userId: string, resource: Resource, action: Action): Promise<boolean>;
export declare function requirePermission(resource: Resource, action: Action): (c: any, next: () => Promise<void>) => Promise<void>;
export declare function requireSuperAdmin(): (c: any, next: () => Promise<void>) => Promise<void>;
export declare function requireRole(...roleNames: string[]): (c: any, next: () => Promise<void>) => Promise<void>;
export declare function createRBACRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=rbac.d.ts.map