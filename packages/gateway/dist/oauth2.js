import { Hono } from 'hono';
import * as jose from 'jose';
import { getDB, users, oauthAccounts, tenants, eq, and, } from '@hitechclaw/db';
import { seedDefaultRoles, assignRoleToUser } from './rbac.js';
import { authMiddleware } from './auth.js';
const PROVIDER_CONFIGS = {
    google: {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        mapProfile: (p) => ({
            providerAccountId: p.id,
            email: p.email,
            name: p.name,
            avatarUrl: p.picture,
        }),
    },
    github: {
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['read:user', 'user:email'],
        mapProfile: (p) => ({
            providerAccountId: String(p.id),
            email: p.email,
            name: p.name || p.login,
            avatarUrl: p.avatar_url,
        }),
    },
    discord: {
        authorizeUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        scopes: ['identify', 'email'],
        mapProfile: (p) => ({
            providerAccountId: p.id,
            email: p.email,
            name: p.global_name || p.username,
            avatarUrl: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : undefined,
        }),
    },
};
// ─── Resolve Provider Config ──────────────────────────────
function getProviderConfig(provider) {
    const base = PROVIDER_CONFIGS[provider];
    if (!base)
        return null;
    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`OAUTH2_${envPrefix}_CLIENT_ID`];
    const clientSecret = process.env[`OAUTH2_${envPrefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret)
        return null;
    return { ...base, clientId, clientSecret };
}
// ─── OAuth2 Token Exchange ─────────────────────────────────
async function exchangeCodeForTokens(config, code, redirectUri) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
    });
    const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
    };
}
// ─── Fetch User Profile ───────────────────────────────────
async function fetchUserProfile(config, accessToken) {
    const res = await fetch(config.userInfoUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch user profile: ${res.status}`);
    }
    const profile = await res.json();
    // GitHub: email might be null, need separate API call
    if (!profile.email && config.userInfoUrl.includes('github.com')) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (emailRes.ok) {
            const emails = await emailRes.json();
            const primary = emails.find(e => e.primary && e.verified);
            if (primary)
                profile.email = primary.email;
        }
    }
    return profile;
}
// ─── OAuth2 Routes ─────────────────────────────────────────
export function createOAuth2Routes(ctx) {
    const app = new Hono();
    const jwtSecret = new TextEncoder().encode(ctx.config.jwtSecret);
    // GET /auth/oauth2/providers — list enabled providers
    app.get('/providers', (c) => {
        const enabled = [];
        for (const provider of Object.keys(PROVIDER_CONFIGS)) {
            if (getProviderConfig(provider))
                enabled.push(provider);
        }
        return c.json({ providers: enabled });
    });
    // GET /auth/oauth2/:provider/authorize — get redirect URL
    app.get('/:provider/authorize', (c) => {
        const provider = c.req.param('provider');
        const tenantSlug = c.req.query('tenant');
        const config = getProviderConfig(provider);
        if (!config) {
            return c.json({ error: `OAuth2 provider '${provider}' is not configured` }, 400);
        }
        if (!tenantSlug) {
            return c.json({ error: 'tenant query parameter is required' }, 400);
        }
        const redirectUri = `${c.req.url.split('/auth/')[0]}/auth/oauth2/${provider}/callback`;
        // state = base64(JSON.stringify({ tenantSlug, nonce }))
        const state = btoa(JSON.stringify({
            tenantSlug,
            nonce: crypto.randomUUID(),
        }));
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: config.scopes.join(' '),
            state,
        });
        // Google: prompt account selection
        if (provider === 'google') {
            params.set('access_type', 'offline');
            params.set('prompt', 'consent');
        }
        const authorizeUrl = `${config.authorizeUrl}?${params.toString()}`;
        return c.json({ url: authorizeUrl });
    });
    // GET /auth/oauth2/:provider/callback — exchange code → login/register
    app.get('/:provider/callback', async (c) => {
        const provider = c.req.param('provider');
        const code = c.req.query('code');
        const stateParam = c.req.query('state');
        const error = c.req.query('error');
        if (error) {
            return c.json({ error: `OAuth2 error: ${error}` }, 400);
        }
        if (!code || !stateParam) {
            return c.json({ error: 'Missing code or state parameter' }, 400);
        }
        const config = getProviderConfig(provider);
        if (!config) {
            return c.json({ error: `OAuth2 provider '${provider}' is not configured` }, 400);
        }
        // Decode state
        let tenantSlug;
        try {
            const stateData = JSON.parse(atob(stateParam));
            tenantSlug = stateData.tenantSlug;
        }
        catch {
            return c.json({ error: 'Invalid state parameter' }, 400);
        }
        const db = getDB();
        // Resolve tenant
        const [tenant] = await db.select().from(tenants)
            .where(eq(tenants.slug, tenantSlug)).limit(1);
        if (!tenant || tenant.status !== 'active') {
            return c.json({ error: 'Tenant not found or inactive' }, 404);
        }
        // Exchange code for tokens
        const redirectUri = `${c.req.url.split('?')[0]}`;
        let tokens;
        try {
            tokens = await exchangeCodeForTokens(config, code, redirectUri);
        }
        catch (err) {
            return c.json({ error: err.message }, 502);
        }
        // Fetch user profile
        let profile;
        try {
            profile = await fetchUserProfile(config, tokens.accessToken);
        }
        catch (err) {
            return c.json({ error: err.message }, 502);
        }
        const mapped = config.mapProfile(profile);
        if (!mapped.email) {
            return c.json({ error: 'OAuth provider did not return an email address' }, 400);
        }
        const now = new Date();
        // Check if OAuth account already linked
        const [existingOAuth] = await db.select().from(oauthAccounts)
            .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, mapped.providerAccountId), eq(oauthAccounts.tenantId, tenant.id)))
            .limit(1);
        let user;
        if (existingOAuth) {
            // Update tokens
            await db.update(oauthAccounts).set({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken || undefined,
                tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
                scope: tokens.scope,
                profile,
                updatedAt: now,
            }).where(eq(oauthAccounts.id, existingOAuth.id));
            // Get user
            const [found] = await db.select().from(users)
                .where(eq(users.id, existingOAuth.userId)).limit(1);
            user = found;
            // Update last login
            await db.update(users).set({ lastLoginAt: now, updatedAt: now })
                .where(eq(users.id, user.id));
        }
        else {
            // Check if user with this email already exists in tenant
            const [existingUser] = await db.select().from(users)
                .where(and(eq(users.tenantId, tenant.id), eq(users.email, mapped.email)))
                .limit(1);
            if (existingUser) {
                // Link OAuth to existing user
                user = existingUser;
                await db.insert(oauthAccounts).values({
                    id: crypto.randomUUID(),
                    userId: user.id,
                    tenantId: tenant.id,
                    provider,
                    providerAccountId: mapped.providerAccountId,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken || null,
                    tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
                    scope: tokens.scope || null,
                    profile,
                    connectedAt: now,
                    updatedAt: now,
                });
                await db.update(users).set({
                    lastLoginAt: now,
                    avatarUrl: mapped.avatarUrl || existingUser.avatarUrl,
                    updatedAt: now,
                }).where(eq(users.id, user.id));
            }
            else {
                // Create new user via OAuth
                const userId = crypto.randomUUID();
                await db.insert(users).values({
                    id: userId,
                    tenantId: tenant.id,
                    name: mapped.name,
                    email: mapped.email,
                    passwordHash: null, // OAuth-only user
                    avatarUrl: mapped.avatarUrl || null,
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
                    provider,
                    providerAccountId: mapped.providerAccountId,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken || null,
                    tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
                    scope: tokens.scope || null,
                    profile,
                    connectedAt: now,
                    updatedAt: now,
                });
                // Ensure default roles exist, then assign 'member' role
                await seedDefaultRoles(tenant.id);
                await assignRoleToUser(userId, 'member', tenant.id);
                const [created] = await db.select().from(users)
                    .where(eq(users.id, userId)).limit(1);
                user = created;
            }
        }
        // Issue JWT
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
            },
            provider,
        });
    });
    // ── Link OAuth to authenticated user ──
    // POST /auth/oauth2/:provider/link (requires auth)
    app.post('/:provider/link', authMiddleware(ctx.config.jwtSecret), async (c) => {
        const currentUser = c.get('user');
        const provider = c.req.param('provider');
        const body = await c.req.json();
        const { code, redirectUri: clientRedirectUri } = body;
        if (!code) {
            return c.json({ error: 'code is required' }, 400);
        }
        const config = getProviderConfig(provider);
        if (!config) {
            return c.json({ error: `OAuth2 provider '${provider}' is not configured` }, 400);
        }
        const redirectUri = clientRedirectUri || `${c.req.url.split('/auth/')[0]}/auth/oauth2/${provider}/callback`;
        const tokens = await exchangeCodeForTokens(config, code, redirectUri);
        const profile = await fetchUserProfile(config, tokens.accessToken);
        const mapped = config.mapProfile(profile);
        const db = getDB();
        const now = new Date();
        // Check if already linked
        const [existing] = await db.select().from(oauthAccounts)
            .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, mapped.providerAccountId), eq(oauthAccounts.tenantId, currentUser.tenantId)))
            .limit(1);
        if (existing) {
            if (existing.userId === currentUser.sub) {
                return c.json({ error: 'This account is already linked to you' }, 409);
            }
            return c.json({ error: 'This OAuth account is already linked to another user' }, 409);
        }
        await db.insert(oauthAccounts).values({
            id: crypto.randomUUID(),
            userId: currentUser.sub,
            tenantId: currentUser.tenantId,
            provider,
            providerAccountId: mapped.providerAccountId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || null,
            tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
            scope: tokens.scope || null,
            profile,
            connectedAt: now,
            updatedAt: now,
        });
        return c.json({ success: true, provider, email: mapped.email });
    });
    // ── Unlink OAuth from authenticated user ──
    app.delete('/:provider/link', authMiddleware(ctx.config.jwtSecret), async (c) => {
        const currentUser = c.get('user');
        const provider = c.req.param('provider');
        const db = getDB();
        // Ensure user has a password or another OAuth link (prevent lockout)
        const [userRecord] = await db.select().from(users)
            .where(eq(users.id, currentUser.sub)).limit(1);
        const oauthLinks = await db.select().from(oauthAccounts)
            .where(eq(oauthAccounts.userId, currentUser.sub));
        const hasPassword = !!userRecord?.passwordHash;
        const otherLinks = oauthLinks.filter(l => l.provider !== provider);
        if (!hasPassword && otherLinks.length === 0) {
            return c.json({
                error: 'Cannot unlink: this is your only login method. Set a password first.',
            }, 400);
        }
        await db.delete(oauthAccounts)
            .where(and(eq(oauthAccounts.userId, currentUser.sub), eq(oauthAccounts.provider, provider)));
        return c.json({ success: true });
    });
    // ── List linked OAuth accounts for current user ──
    app.get('/accounts', authMiddleware(ctx.config.jwtSecret), async (c) => {
        const currentUser = c.get('user');
        const db = getDB();
        const accounts = await db.select({
            id: oauthAccounts.id,
            provider: oauthAccounts.provider,
            providerAccountId: oauthAccounts.providerAccountId,
            connectedAt: oauthAccounts.connectedAt,
        }).from(oauthAccounts)
            .where(eq(oauthAccounts.userId, currentUser.sub));
        return c.json({ accounts });
    });
    return app;
}
//# sourceMappingURL=oauth2.js.map