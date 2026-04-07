import { Hono } from 'hono';
import * as jose from 'jose';
import { getDB, users, oauthAccounts, tenants, eq, and, } from '@hitechclaw/db';
import { seedDefaultRoles, assignRoleToUser, getUserPermissions } from './rbac.js';
// ─── Zalo Mini App Auth ─────────────────────────────────────
// Exchange Zalo access token (from zmp-sdk getAccessToken()) for HiTechClaw JWT.
// Flow: Mini App → getAccessToken() → POST /auth/zalo-miniapp → HiTechClaw JWT
const ZALO_GRAPH_API = 'https://graph.zalo.me/v2.0/me';
async function fetchZaloProfile(accessToken) {
    const url = `${ZALO_GRAPH_API}?access_token=${encodeURIComponent(accessToken)}&fields=id,name,picture`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zalo API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (data.error) {
        const errData = data.error;
        throw new Error(`Zalo API error: ${errData.message || 'Unknown error'}`);
    }
    return data;
}
export function createZaloMiniAppAuthRoutes(ctx) {
    const app = new Hono();
    const jwtSecret = new TextEncoder().encode(ctx.config.jwtSecret);
    // POST /auth/zalo-miniapp — Exchange Zalo access token for HiTechClaw JWT
    app.post('/', async (c) => {
        var _a, _b;
        try {
            const body = await c.req.json();
            const { accessToken, tenantSlug } = body;
            if (!accessToken || typeof accessToken !== 'string') {
                return c.json({ error: 'accessToken is required' }, 400);
            }
            // Verify token with Zalo Graph API
            let profile;
            try {
                profile = await fetchZaloProfile(accessToken);
            }
            catch (err) {
                return c.json({
                    error: err instanceof Error ? err.message : 'Failed to verify Zalo token',
                }, 401);
            }
            if (!profile.id || !profile.name) {
                return c.json({ error: 'Invalid Zalo profile data' }, 401);
            }
            const db = getDB();
            const now = new Date();
            // Resolve tenant
            const slug = tenantSlug || process.env.DEFAULT_TENANT_SLUG || 'default';
            const [tenant] = await db.select().from(tenants)
                .where(eq(tenants.slug, slug)).limit(1);
            if (!tenant || tenant.status !== 'active') {
                return c.json({ error: 'Tenant not found or inactive' }, 404);
            }
            // Zalo users don't have email — use zalo_{id}@zalo.miniapp as identifier
            const zaloEmail = `zalo_${profile.id}@zalo.miniapp`;
            const avatarUrl = ((_b = (_a = profile.picture) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.url) || null;
            // Check if Zalo OAuth account already linked in this tenant
            const [existingOAuth] = await db.select().from(oauthAccounts)
                .where(and(eq(oauthAccounts.provider, 'zalo-miniapp'), eq(oauthAccounts.providerAccountId, profile.id), eq(oauthAccounts.tenantId, tenant.id)))
                .limit(1);
            let user;
            if (existingOAuth) {
                // Existing Zalo user — update token, login
                await db.update(oauthAccounts).set({
                    accessToken,
                    profile: profile,
                    updatedAt: now,
                }).where(eq(oauthAccounts.id, existingOAuth.id));
                const [found] = await db.select().from(users)
                    .where(eq(users.id, existingOAuth.userId)).limit(1);
                user = found;
                await db.update(users).set({
                    lastLoginAt: now,
                    name: profile.name,
                    avatarUrl: avatarUrl || user.avatarUrl,
                    updatedAt: now,
                }).where(eq(users.id, user.id));
            }
            else {
                // Check if user with zalo email exists
                const [existingUser] = await db.select().from(users)
                    .where(and(eq(users.tenantId, tenant.id), eq(users.email, zaloEmail)))
                    .limit(1);
                if (existingUser) {
                    user = existingUser;
                    // Link Zalo account
                    await db.insert(oauthAccounts).values({
                        id: crypto.randomUUID(),
                        userId: user.id,
                        tenantId: tenant.id,
                        provider: 'zalo-miniapp',
                        providerAccountId: profile.id,
                        accessToken,
                        refreshToken: null,
                        tokenExpiresAt: null,
                        scope: null,
                        profile: profile,
                        connectedAt: now,
                        updatedAt: now,
                    });
                    await db.update(users).set({
                        lastLoginAt: now,
                        avatarUrl: avatarUrl || existingUser.avatarUrl,
                        updatedAt: now,
                    }).where(eq(users.id, user.id));
                }
                else {
                    // Create new user via Zalo Mini App
                    const userId = crypto.randomUUID();
                    await db.insert(users).values({
                        id: userId,
                        tenantId: tenant.id,
                        name: profile.name,
                        email: zaloEmail,
                        passwordHash: null,
                        avatarUrl,
                        role: 'user',
                        status: 'active',
                        lastLoginAt: now,
                        createdAt: now,
                        updatedAt: now,
                    });
                    await db.insert(oauthAccounts).values({
                        id: crypto.randomUUID(),
                        userId,
                        tenantId: tenant.id,
                        provider: 'zalo-miniapp',
                        providerAccountId: profile.id,
                        accessToken,
                        refreshToken: null,
                        tokenExpiresAt: null,
                        scope: null,
                        profile: profile,
                        connectedAt: now,
                        updatedAt: now,
                    });
                    await seedDefaultRoles(tenant.id);
                    await assignRoleToUser(userId, 'member', tenant.id);
                    const [created] = await db.select().from(users)
                        .where(eq(users.id, userId)).limit(1);
                    user = created;
                }
            }
            // Get permissions
            const permissions = await getUserPermissions(user.id);
            // Issue HiTechClaw JWT
            const token = await new jose.SignJWT({
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setSubject(user.id)
                .setIssuedAt()
                .setExpirationTime('24h')
                .sign(jwtSecret);
            return c.json({
                token,
                expiresIn: 86400,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    tenantId: user.tenantId,
                    avatarUrl: user.avatarUrl,
                    permissions: Array.from(permissions),
                },
                provider: 'zalo-miniapp',
            });
        }
        catch (err) {
            return c.json({
                error: err instanceof Error ? err.message : 'Failed',
            }, 500);
        }
    });
    return app;
}
