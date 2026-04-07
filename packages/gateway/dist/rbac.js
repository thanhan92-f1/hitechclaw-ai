import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getDB, roles, permissions, rolePermissions, userRoles, users, eq, and, inArray, } from '@hitechclaw/db';
// ─── Permission Constants ──────────────────────────────────
export const RESOURCES = [
    'chat', 'sessions', 'knowledge', 'workflows', 'integrations',
    'domains', 'settings', 'users', 'roles', 'tenants', 'models',
    'ml', 'agents', 'webhooks', 'mcp',
];
export const ACTIONS = ['read', 'write', 'delete', 'manage'];
// All granular permission definitions
export const ALL_PERMISSIONS = [];
for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
        ALL_PERMISSIONS.push({
            resource, action,
            description: `${action} access to ${resource}`,
        });
    }
}
export const DEFAULT_ROLE_TEMPLATES = [
    {
        name: 'owner',
        displayName: 'Owner',
        description: 'Full access to everything. Cannot be deleted.',
        permissions: ['*:*'],
    },
    {
        name: 'admin',
        displayName: 'Admin',
        description: 'Full access except tenant deletion and ownership transfer.',
        permissions: [
            'chat:read', 'chat:write', 'chat:delete', 'chat:manage',
            'sessions:read', 'sessions:write', 'sessions:delete', 'sessions:manage',
            'knowledge:read', 'knowledge:write', 'knowledge:delete', 'knowledge:manage',
            'workflows:read', 'workflows:write', 'workflows:delete', 'workflows:manage',
            'integrations:read', 'integrations:write', 'integrations:delete', 'integrations:manage',
            'domains:read', 'domains:write', 'domains:delete', 'domains:manage',
            'settings:read', 'settings:write', 'settings:manage',
            'users:read', 'users:write', 'users:delete', 'users:manage',
            'roles:read', 'roles:write', 'roles:delete', 'roles:manage',
            'models:read', 'models:write', 'models:manage',
            'ml:read', 'ml:write', 'ml:manage',
            'agents:read', 'agents:write', 'agents:delete', 'agents:manage',
            'webhooks:read', 'webhooks:write', 'webhooks:delete', 'webhooks:manage',
            'mcp:read', 'mcp:write', 'mcp:manage',
        ],
    },
    {
        name: 'member',
        displayName: 'Member',
        description: 'Standard access. Can use chat, workflows, integrations.',
        permissions: [
            'chat:read', 'chat:write',
            'sessions:read', 'sessions:write',
            'knowledge:read',
            'workflows:read', 'workflows:write',
            'integrations:read', 'integrations:write',
            'domains:read',
            'models:read',
            'ml:read',
            'agents:read',
            'mcp:read',
        ],
    },
    {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access.',
        permissions: [
            'chat:read',
            'sessions:read',
            'knowledge:read',
            'workflows:read',
            'integrations:read',
            'domains:read',
            'models:read',
            'agents:read',
        ],
    },
];
// ─── Seed Permissions + Default Roles for a Tenant ─────────
export async function seedPermissions() {
    const db = getDB();
    for (const perm of ALL_PERMISSIONS) {
        const id = `${perm.resource}:${perm.action}`;
        const [existing] = await db.select().from(permissions)
            .where(and(eq(permissions.resource, perm.resource), eq(permissions.action, perm.action)))
            .limit(1);
        if (!existing) {
            await db.insert(permissions).values({
                id, resource: perm.resource, action: perm.action, description: perm.description,
            });
        }
    }
}
export async function seedDefaultRoles(tenantId) {
    const db = getDB();
    const now = new Date();
    // Ensure global permissions exist
    await seedPermissions();
    const allPerms = await db.select().from(permissions);
    const permMap = new Map(allPerms.map(p => [`${p.resource}:${p.action}`, p.id]));
    for (const tpl of DEFAULT_ROLE_TEMPLATES) {
        const roleId = `${tenantId}:${tpl.name}`;
        const [existing] = await db.select().from(roles)
            .where(and(eq(roles.tenantId, tenantId), eq(roles.name, tpl.name)))
            .limit(1);
        if (!existing) {
            await db.insert(roles).values({
                id: roleId, tenantId, name: tpl.name,
                displayName: tpl.displayName, description: tpl.description,
                isSystem: true, createdAt: now, updatedAt: now,
            });
            // Assign permissions
            if (tpl.permissions.includes('*:*')) {
                // Owner gets all permissions
                for (const perm of allPerms) {
                    await db.insert(rolePermissions).values({
                        id: `${roleId}:${perm.id}`, roleId, permissionId: perm.id,
                    });
                }
            }
            else {
                for (const permKey of tpl.permissions) {
                    const permId = permMap.get(permKey);
                    if (permId) {
                        await db.insert(rolePermissions).values({
                            id: `${roleId}:${permId}`, roleId, permissionId: permId,
                        });
                    }
                }
            }
        }
    }
}
// ─── Assign Role to User ──────────────────────────────────
export async function assignRoleToUser(userId, roleName, tenantId, assignedBy) {
    const db = getDB();
    const [role] = await db.select().from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleName)))
        .limit(1);
    if (!role)
        throw new Error(`Role '${roleName}' not found for tenant`);
    const [existing] = await db.select().from(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)))
        .limit(1);
    if (existing)
        return; // already assigned
    await db.insert(userRoles).values({
        id: crypto.randomUUID(), userId, roleId: role.id,
        assignedAt: new Date(), assignedBy,
    });
}
// ─── Get User Permissions ──────────────────────────────────
export async function getUserPermissions(userId) {
    const db = getDB();
    // Get all roles for user
    const userRoleRows = await db.select({ roleId: userRoles.roleId })
        .from(userRoles).where(eq(userRoles.userId, userId));
    if (userRoleRows.length === 0)
        return new Set();
    const roleIds = userRoleRows.map(r => r.roleId);
    // Get all permissions for those roles
    const rpRows = await db.select({
        resource: permissions.resource,
        action: permissions.action,
    })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(inArray(rolePermissions.roleId, roleIds));
    return new Set(rpRows.map(r => `${r.resource}:${r.action}`));
}
// ─── Check Permission ──────────────────────────────────────
export async function hasPermission(userId, resource, action) {
    // Super admins bypass permission checks
    const db = getDB();
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (user?.role === 'super_admin')
        return true;
    const perms = await getUserPermissions(userId);
    return perms.has(`${resource}:${action}`);
}
// ─── Hono Middleware: require permission ────────────────────
export function requirePermission(resource, action) {
    return async (c, next) => {
        const user = c.get('user');
        if (!user?.sub) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }
        // Super admin bypasses
        if (user.isSuperAdmin) {
            await next();
            return;
        }
        const allowed = await hasPermission(user.sub, resource, action);
        if (!allowed) {
            throw new HTTPException(403, {
                message: `Forbidden: missing permission ${resource}:${action}`,
            });
        }
        await next();
    };
}
// ─── Hono Middleware: require super admin ───────────────────
export function requireSuperAdmin() {
    return async (c, next) => {
        const user = c.get('user');
        if (!user?.sub) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }
        if (!user.isSuperAdmin) {
            throw new HTTPException(403, { message: 'Super Admin access required' });
        }
        await next();
    };
}
// ─── Hono Middleware: require any of these roles (legacy) ──
export function requireRole(...roleNames) {
    return async (c, next) => {
        const user = c.get('user');
        if (!user?.sub) {
            throw new HTTPException(401, { message: 'Unauthorized' });
        }
        const db = getDB();
        const userRoleRows = await db.select({ roleName: roles.name })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.userId, user.sub));
        const userRoleNames = userRoleRows.map(r => r.roleName);
        const hasRole = roleNames.some(rn => userRoleNames.includes(rn));
        if (!hasRole) {
            throw new HTTPException(403, {
                message: `Forbidden: requires one of roles [${roleNames.join(', ')}]`,
            });
        }
        await next();
    };
}
// ─── RBAC Management Routes ────────────────────────────────
export function createRBACRoutes() {
    const app = new Hono();
    // ── List all roles for current tenant ──
    app.get('/roles', requirePermission('roles', 'read'), async (c) => {
        const user = c.get('user');
        const db = getDB();
        const tenantRoles = await db.select().from(roles)
            .where(eq(roles.tenantId, user.tenantId));
        // Attach permission count and list for each role
        const rolesWithPerms = await Promise.all(tenantRoles.map(async (role) => {
            const rpRows = await db.select({ id: permissions.id })
                .from(rolePermissions)
                .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                .where(eq(rolePermissions.roleId, role.id));
            return { ...role, permissionCount: rpRows.length, permissions: rpRows.map(r => r.id) };
        }));
        return c.json({ roles: rolesWithPerms });
    });
    // ── Create a custom role ──
    app.post('/roles', requirePermission('roles', 'manage'), async (c) => {
        const user = c.get('user');
        const body = await c.req.json();
        const { name, displayName, description, permissionIds } = body;
        if (!name || !displayName) {
            return c.json({ error: 'name and displayName are required' }, 400);
        }
        if (!/^[a-z][a-z0-9_-]{1,62}$/.test(name)) {
            return c.json({ error: 'name must be lowercase alphanumeric (2-63 chars)' }, 400);
        }
        const db = getDB();
        const tenantId = user.tenantId;
        const now = new Date();
        const roleId = `${tenantId}:${name}`;
        const [existing] = await db.select().from(roles)
            .where(and(eq(roles.tenantId, tenantId), eq(roles.name, name)))
            .limit(1);
        if (existing)
            return c.json({ error: 'Role name already exists' }, 409);
        await db.insert(roles).values({
            id: roleId, tenantId, name, displayName,
            description: description || null,
            isSystem: false, createdAt: now, updatedAt: now,
        });
        // Assign permissions if provided
        if (Array.isArray(permissionIds)) {
            for (const permId of permissionIds) {
                await db.insert(rolePermissions).values({
                    id: `${roleId}:${permId}`, roleId, permissionId: permId,
                }).onConflictDoNothing();
            }
        }
        return c.json({ id: roleId, name, displayName }, 201);
    });
    // ── Update a custom role ──
    app.put('/roles/:roleId', requirePermission('roles', 'manage'), async (c) => {
        const user = c.get('user');
        const roleId = c.req.param('roleId');
        const body = await c.req.json();
        const db = getDB();
        const [role] = await db.select().from(roles)
            .where(and(eq(roles.id, roleId), eq(roles.tenantId, user.tenantId)))
            .limit(1);
        if (!role)
            return c.json({ error: 'Role not found' }, 404);
        if (role.isSystem)
            return c.json({ error: 'Cannot modify system roles' }, 403);
        const updates = { updatedAt: new Date() };
        if (body.displayName)
            updates.displayName = body.displayName;
        if (body.description !== undefined)
            updates.description = body.description;
        await db.update(roles).set(updates).where(eq(roles.id, roleId));
        // Update permissions if provided
        if (Array.isArray(body.permissionIds)) {
            // Remove existing
            await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
            // Add new
            for (const permId of body.permissionIds) {
                await db.insert(rolePermissions).values({
                    id: `${roleId}:${permId}`, roleId, permissionId: permId,
                }).onConflictDoNothing();
            }
        }
        return c.json({ success: true });
    });
    // ── Delete a custom role ──
    app.delete('/roles/:roleId', requirePermission('roles', 'manage'), async (c) => {
        const user = c.get('user');
        const roleId = c.req.param('roleId');
        const db = getDB();
        const [role] = await db.select().from(roles)
            .where(and(eq(roles.id, roleId), eq(roles.tenantId, user.tenantId)))
            .limit(1);
        if (!role)
            return c.json({ error: 'Role not found' }, 404);
        if (role.isSystem)
            return c.json({ error: 'Cannot delete system roles' }, 403);
        await db.delete(roles).where(eq(roles.id, roleId));
        return c.json({ success: true });
    });
    // ── List all permissions ──
    app.get('/permissions', requirePermission('roles', 'read'), async (c) => {
        const db = getDB();
        const allPerms = await db.select().from(permissions);
        return c.json({ permissions: allPerms });
    });
    // ── Get permissions for a specific role ──
    app.get('/roles/:roleId/permissions', requirePermission('roles', 'read'), async (c) => {
        const user = c.get('user');
        const roleId = c.req.param('roleId');
        const db = getDB();
        const [role] = await db.select().from(roles)
            .where(and(eq(roles.id, roleId), eq(roles.tenantId, user.tenantId)))
            .limit(1);
        if (!role)
            return c.json({ error: 'Role not found' }, 404);
        const rpRows = await db.select({
            id: permissions.id,
            resource: permissions.resource,
            action: permissions.action,
            description: permissions.description,
        })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, roleId));
        return c.json({ role: role.name, permissions: rpRows });
    });
    // ── Assign role to a user ──
    app.post('/users/:userId/roles', requirePermission('users', 'manage'), async (c) => {
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        const body = await c.req.json();
        const { roleName } = body;
        if (!roleName)
            return c.json({ error: 'roleName is required' }, 400);
        const db = getDB();
        // Validate target user belongs to same tenant
        const [targetUser] = await db.select().from(users)
            .where(and(eq(users.id, targetUserId), eq(users.tenantId, currentUser.tenantId)))
            .limit(1);
        if (!targetUser)
            return c.json({ error: 'User not found' }, 404);
        try {
            await assignRoleToUser(targetUserId, roleName, currentUser.tenantId, currentUser.sub);
            return c.json({ success: true });
        }
        catch (err) {
            return c.json({ error: err.message }, 400);
        }
    });
    // ── Remove role from a user ──
    app.delete('/users/:userId/roles/:roleName', requirePermission('users', 'manage'), async (c) => {
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        const roleName = c.req.param('roleName');
        const db = getDB();
        const [role] = await db.select().from(roles)
            .where(and(eq(roles.tenantId, currentUser.tenantId), eq(roles.name, roleName)))
            .limit(1);
        if (!role)
            return c.json({ error: 'Role not found' }, 404);
        await db.delete(userRoles)
            .where(and(eq(userRoles.userId, targetUserId), eq(userRoles.roleId, role.id)));
        return c.json({ success: true });
    });
    // ── Get roles for a user ──
    app.get('/users/:userId/roles', requirePermission('users', 'read'), async (c) => {
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        const db = getDB();
        const [targetUser] = await db.select().from(users)
            .where(and(eq(users.id, targetUserId), eq(users.tenantId, currentUser.tenantId)))
            .limit(1);
        if (!targetUser)
            return c.json({ error: 'User not found' }, 404);
        const userRoleRows = await db.select({
            roleId: roles.id,
            roleName: roles.name,
            displayName: roles.displayName,
            isSystem: roles.isSystem,
        })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.userId, targetUserId));
        return c.json({ userId: targetUserId, roles: userRoleRows });
    });
    // ── Get effective permissions for a user ──
    app.get('/users/:userId/permissions', requirePermission('users', 'read'), async (c) => {
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        const db = getDB();
        const [targetUser] = await db.select().from(users)
            .where(and(eq(users.id, targetUserId), eq(users.tenantId, currentUser.tenantId)))
            .limit(1);
        if (!targetUser)
            return c.json({ error: 'User not found' }, 404);
        const perms = await getUserPermissions(targetUserId);
        return c.json({ userId: targetUserId, permissions: Array.from(perms) });
    });
    // ── Create user in current tenant ──
    app.post('/users', requirePermission('users', 'manage'), async (c) => {
        const currentUser = c.get('user');
        const body = await c.req.json();
        const { name, email, password, role: roleName = 'member' } = body;
        if (!name || !email || !password) {
            return c.json({ error: 'name, email, and password are required' }, 400);
        }
        if (password.length < 8) {
            return c.json({ error: 'password must be at least 8 characters' }, 400);
        }
        if (!['admin', 'member', 'viewer'].includes(roleName)) {
            return c.json({ error: 'role must be one of: admin, member, viewer' }, 400);
        }
        const db = getDB();
        const [existing] = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.email, email), eq(users.tenantId, currentUser.tenantId)))
            .limit(1);
        if (existing)
            return c.json({ error: 'Email already exists in this tenant' }, 409);
        const encoder = new TextEncoder();
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' }, keyMaterial, 256);
        const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
        const passwordHash = `${salt}:${hash}`;
        const now = new Date();
        const userId = crypto.randomUUID();
        await db.insert(users).values({
            id: userId,
            tenantId: currentUser.tenantId,
            name,
            email,
            passwordHash,
            role: roleName,
            status: 'active',
            lastLoginAt: now,
            createdAt: now,
            updatedAt: now,
        });
        await assignRoleToUser(userId, roleName, currentUser.tenantId);
        return c.json({ user: { id: userId, name, email, role: roleName, tenantId: currentUser.tenantId } }, 201);
    });
    // ── List all users in current tenant ──
    app.get('/users', requirePermission('users', 'read'), async (c) => {
        const currentUser = c.get('user');
        const db = getDB();
        const tenantUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            status: users.status,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
        }).from(users)
            .where(eq(users.tenantId, currentUser.tenantId))
            .orderBy(users.createdAt);
        // Attach roles for each user
        const usersWithRoles = await Promise.all(tenantUsers.map(async (u) => {
            const userRoleRecords = await db.select({
                roleName: roles.name,
            }).from(userRoles)
                .innerJoin(roles, eq(userRoles.roleId, roles.id))
                .where(eq(userRoles.userId, u.id));
            return { ...u, roles: userRoleRecords.map(r => r.roleName) };
        }));
        return c.json({ users: usersWithRoles });
    });
    // ── Update user status (suspend/activate) ──
    app.patch('/users/:userId/status', requirePermission('users', 'manage'), async (c) => {
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        const { status } = await c.req.json();
        const db = getDB();
        if (!['active', 'suspended', 'invited'].includes(status)) {
            return c.json({ error: 'Invalid status' }, 400);
        }
        if (targetUserId === currentUser.sub) {
            return c.json({ error: 'Cannot change your own status' }, 400);
        }
        const [targetUser] = await db.select().from(users)
            .where(and(eq(users.id, targetUserId), eq(users.tenantId, currentUser.tenantId)))
            .limit(1);
        if (!targetUser)
            return c.json({ error: 'User not found' }, 404);
        await db.update(users).set({ status }).where(eq(users.id, targetUserId));
        return c.json({ success: true });
    });
    return app;
}
//# sourceMappingURL=rbac.js.map