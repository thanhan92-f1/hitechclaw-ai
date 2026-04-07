import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as jose from 'jose';
import { randomUUID } from 'node:crypto';
import { getDB, users, tenants, oauthAccounts, eq, and, activityLogsCollection } from '@hitechclaw/db';
import type { MongoActivityLog } from '@hitechclaw/db';
import type { GatewayContext } from './gateway.js';
import { seedDefaultRoles, assignRoleToUser, getUserPermissions } from './rbac.js';

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

export function authMiddleware(jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret);

  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jose.jwtVerify(token, secret);
      c.set('user', {
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        tenantId: payload.tenantId as string,
        isSuperAdmin: payload.isSuperAdmin === true,
      });
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  };
}

// Secure password hashing via PBKDF2 (Web Crypto)
async function hashPassword(password: string, salt?: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordSalt = salt || Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(passwordSalt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${passwordSalt}:${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    const [, salt, _hash] = stored.split(':');
    const computed = await hashPassword(password, salt);
    return computed === stored;
  }
  // Legacy SHA-256 fallback (for existing users)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const legacyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return legacyHash === stored;
}

export function createAuthRoutes(ctx: GatewayContext) {
  const app = new Hono();
  const secret = new TextEncoder().encode(ctx.config.jwtSecret);

  const writeLoginLog = (entry: Omit<MongoActivityLog, '_id' | 'createdAt'>) => {
    activityLogsCollection().insertOne({
      _id: randomUUID(),
      createdAt: new Date(),
      ...entry,
    } as any).catch(() => {});
  };

  // POST /auth/login
  app.post('/login', async (c) => {
    const startedAt = Date.now();
    const body = await c.req.json();
    const { email, password, tenantSlug } = body;

    if (!email || !password) {
      writeLoginLog({
        tenantId: 'unknown',
        userId: 'anonymous',
        method: 'POST',
        path: '/auth/login',
        statusCode: 400,
        duration: Date.now() - startedAt,
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        requestBody: { email: email || '', tenantSlug: tenantSlug || '' },
      });
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const db = getDB();

    // Resolve tenant (optional slug — if not provided, find user's tenant)
    let user: typeof users.$inferSelect | undefined;

    if (tenantSlug) {
      // Specific tenant login
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
      if (!tenant || tenant.status !== 'active') {
        return c.json({ error: 'Tenant not found or inactive' }, 404);
      }
      const [found] = await db.select().from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.email, email)))
        .limit(1);
      user = found;
    } else {
      // No tenant slug: first try to find super admin, then fallback to any user
      const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      user = found;
    }

    if (!user) {
      writeLoginLog({
        tenantId: 'unknown',
        userId: 'anonymous',
        method: 'POST',
        path: '/auth/login',
        statusCode: 401,
        duration: Date.now() - startedAt,
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        requestBody: { email, tenantSlug: tenantSlug || '' },
      });
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    if (!user.passwordHash) {
      writeLoginLog({
        tenantId: user.tenantId,
        userId: user.id,
        method: 'POST',
        path: '/auth/login',
        statusCode: 400,
        duration: Date.now() - startedAt,
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        requestBody: { email, tenantSlug: tenantSlug || '' },
      });
      return c.json({ error: 'This account uses OAuth login. Please sign in with your linked provider.' }, 400);
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      writeLoginLog({
        tenantId: user.tenantId,
        userId: user.id,
        method: 'POST',
        path: '/auth/login',
        statusCode: 401,
        duration: Date.now() - startedAt,
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        requestBody: { email, tenantSlug: tenantSlug || '' },
      });
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Upgrade legacy hash to PBKDF2
    if (!user.passwordHash.startsWith('pbkdf2:')) {
      const upgraded = await hashPassword(password);
      await db.update(users).set({ passwordHash: upgraded, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Get user permissions from RBAC
    const permissions = await getUserPermissions(user.id);
    const isSuperAdmin = user.role === 'super_admin';

    const token = await new jose.SignJWT({
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      isSuperAdmin,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    writeLoginLog({
      tenantId: user.tenantId,
      userId: user.id,
      method: 'POST',
      path: '/auth/login',
      statusCode: 200,
      duration: Date.now() - startedAt,
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
      requestBody: { email, tenantSlug: tenantSlug || '' },
    });

    return c.json({
      token,
      expiresIn: 86400,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        isSuperAdmin,
        permissions: Array.from(permissions),
      },
    });
  });

  // POST /auth/register — self-registration
  // - roleName=owner (default): creates a new tenant + owner account
  // - roleName=member: joins an existing tenant as member
  app.post('/register', async (c) => {
    const body = await c.req.json();
    const { name, email, password, tenantName, tenantSlug, roleName } = body as {
      name?: string;
      email?: string;
      password?: string;
      tenantName?: string;
      tenantSlug?: string;
      roleName?: string;
    };

    const requestedRole = roleName === 'member' ? 'member' : 'owner';

    if (!name || !email || !password || !tenantSlug) {
      return c.json({ error: 'name, email, password, and tenantSlug are required' }, 400);
    }
    if (requestedRole === 'owner' && !tenantName) {
      return c.json({ error: 'tenantName is required for owner registration' }, 400);
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenantSlug)) {
      return c.json({ error: 'tenantSlug must be lowercase alphanumeric with hyphens' }, 400);
    }

    const db = getDB();
    const now = new Date();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    let resolvedTenantId = '';
    let resolvedTenantName = '';
    let resolvedTenantSlug = tenantSlug;

    if (requestedRole === 'owner') {
      // Check slug availability for new tenant
      const [existingTenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
      if (existingTenant) {
        return c.json({ error: 'Tenant slug already taken' }, 409);
      }

      const tenantId = crypto.randomUUID();
      resolvedTenantId = tenantId;
      resolvedTenantName = tenantName!;

      // Create tenant
      await db.insert(tenants).values({
        id: tenantId, name: tenantName!, slug: tenantSlug,
        plan: 'free', status: 'active', metadata: {},
        createdAt: now, updatedAt: now,
      });

      // Create default settings
      const { tenantSettings } = await import('@hitechclaw/db');
      await db.insert(tenantSettings).values({
        id: crypto.randomUUID(), tenantId,
        createdAt: now, updatedAt: now,
      });
    } else {
      // Member registration: join existing active tenant
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
      if (!tenant || tenant.status !== 'active') {
        return c.json({ error: 'Tenant not found or inactive' }, 404);
      }

      const [existingUser] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.email, email)))
        .limit(1);
      if (existingUser) {
        return c.json({ error: 'User with this email already exists in this tenant' }, 409);
      }

      resolvedTenantId = tenant.id;
      resolvedTenantName = tenant.name;
      resolvedTenantSlug = tenant.slug;
    }

    // Create user
    await db.insert(users).values({
      id: userId, tenantId: resolvedTenantId, name, email, passwordHash,
      role: requestedRole, status: 'active',
      lastLoginAt: now, createdAt: now, updatedAt: now,
    });

    // Seed default roles & assign selected role
    await seedDefaultRoles(resolvedTenantId);
    await assignRoleToUser(userId, requestedRole, resolvedTenantId);

    const token = await new jose.SignJWT({
      email,
      role: requestedRole,
      tenantId: resolvedTenantId,
      isSuperAdmin: false,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return c.json({
      token,
      expiresIn: 86400,
      user: { id: userId, name, email, role: requestedRole, tenantId: resolvedTenantId },
      tenant: { id: resolvedTenantId, name: resolvedTenantName, slug: resolvedTenantSlug },
    }, 201);
  });

  // POST /auth/invite — invite user to tenant (requires users:manage)
  app.post('/invite', authMiddleware(ctx.config.jwtSecret), async (c) => {
    const currentUser = c.get('user');
    const body = await c.req.json();
    const { name, email, roleName } = body;

    if (!name || !email) {
      return c.json({ error: 'name and email are required' }, 400);
    }

    const db = getDB();
    const tenantId = currentUser.tenantId;

    // Check if user already exists in tenant
    const [existing] = await db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .limit(1);
    if (existing) {
      return c.json({ error: 'User with this email already exists in this tenant' }, 409);
    }

    const userId = crypto.randomUUID();
    const now = new Date();

    await db.insert(users).values({
      id: userId, tenantId, name, email,
      passwordHash: null, // invited user — must set password or use OAuth
      role: 'user', status: 'invited',
      createdAt: now, updatedAt: now,
    });

    // Assign role (default: member)
    await seedDefaultRoles(tenantId);
    await assignRoleToUser(userId, roleName || 'member', tenantId, currentUser.sub);

    return c.json({
      user: { id: userId, name, email, role: 'user', status: 'invited', tenantId },
    }, 201);
  });

  // POST /auth/set-password — for invited or OAuth-only users
  app.post('/set-password', authMiddleware(ctx.config.jwtSecret), async (c) => {
    const currentUser = c.get('user');
    const body = await c.req.json();
    const { password, currentPassword } = body;

    if (!password || password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const db = getDB();
    const [user] = await db.select().from(users)
      .where(eq(users.id, currentUser.sub)).limit(1);

    if (!user) return c.json({ error: 'User not found' }, 404);

    // If user already has a password, require current password
    if (user.passwordHash) {
      if (!currentPassword) {
        return c.json({ error: 'Current password is required' }, 400);
      }
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return c.json({ error: 'Current password is incorrect' }, 401);
      }
    }

    const newHash = await hashPassword(password);
    await db.update(users).set({
      passwordHash: newHash,
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(users.id, currentUser.sub));

    return c.json({ success: true });
  });

  // GET /auth/me — returns user info + permissions + linked OAuth accounts
  app.get('/me', authMiddleware(ctx.config.jwtSecret), async (c) => {
    const jwtUser = c.get('user');
    const db = getDB();

    const [user] = await db.select().from(users)
      .where(eq(users.id, jwtUser.sub)).limit(1);
    if (!user) {
      throw new HTTPException(404, { message: 'User not found' });
    }

    const permissions = await getUserPermissions(user.id);

    const oauthLinks = await db.select({
      provider: oauthAccounts.provider,
      connectedAt: oauthAccounts.connectedAt,
    }).from(oauthAccounts)
      .where(eq(oauthAccounts.userId, user.id));

    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      tenantId: user.tenantId,
      avatarUrl: user.avatarUrl,
      hasPassword: !!user.passwordHash,
      isSuperAdmin: user.role === 'super_admin',
      permissions: Array.from(permissions),
      oauthProviders: oauthLinks.map(l => l.provider),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    });
  });

  return app;
}
