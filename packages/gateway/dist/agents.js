import { agentConfigsCollection, channelConnectionsCollection, messagesCollection, sessionsCollection, } from '@hitechclaw/db';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
// Helper to extract user info from Hono context
function getUserCtx(c) {
    const user = c.get('user');
    return {
        tenantId: (user === null || user === void 0 ? void 0 : user.tenantId) || 'default',
        userId: (user === null || user === void 0 ? void 0 : user.sub) || 'anonymous',
        isSuperAdmin: !!(user === null || user === void 0 ? void 0 : user.isSuperAdmin),
        role: (user === null || user === void 0 ? void 0 : user.role) || 'member',
    };
}
/** Build MongoDB filter for channel queries based on user role */
function channelFilter(ctx, extra) {
    // Super admin sees ALL channels across all tenants
    if (ctx.isSuperAdmin)
        return Object.assign({}, extra);
    // Tenant owner/admin sees all channels in their tenant
    if (ctx.role === 'owner' || ctx.role === 'admin')
        return Object.assign({ tenantId: ctx.tenantId }, extra);
    // Regular member sees only their own channels
    return Object.assign({ tenantId: ctx.tenantId, userId: ctx.userId }, extra);
}
// ─── Agents / Channel Connections Routes ────────────────────
export function createAgentsRoutes(ctx) {
    const app = new Hono();
    // ─── Agent Configs (AI Agent CRUD) ────────────────────────
    // List all agent configs for the tenant
    app.get('/configs', async (c) => {
        try {
            const { tenantId } = getUserCtx(c);
            const configs = agentConfigsCollection();
            const list = await configs.find({ tenantId }).sort({ updatedAt: -1 }).toArray();
            return c.json({ ok: true, configs: list });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get a single agent config
    app.get('/configs/:id', async (c) => {
        try {
            const { tenantId } = getUserCtx(c);
            const id = c.req.param('id');
            const configs = agentConfigsCollection();
            const config = await configs.findOne({ _id: id, tenantId });
            if (!config)
                return c.json({ error: 'Agent config not found' }, 404);
            return c.json({ ok: true, config });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Create a new agent config
    app.post('/configs', async (c) => {
        var _a, _b;
        try {
            const { tenantId } = getUserCtx(c);
            const body = await c.req.json();
            const { name, persona, systemPrompt, llmConfig, enabledSkills } = body;
            if (!name || typeof name !== 'string') {
                return c.json({ error: 'name is required' }, 400);
            }
            const now = new Date();
            const configs = agentConfigsCollection();
            // If this is the first config or marked as default, handle isDefault
            const existingCount = await configs.countDocuments({ tenantId });
            const isDefault = body.isDefault === true || existingCount === 0;
            if (isDefault) {
                await configs.updateMany({ tenantId, isDefault: true }, { $set: { isDefault: false } });
            }
            const config = {
                _id: randomUUID(),
                tenantId,
                name,
                persona: persona || '',
                systemPrompt: systemPrompt || '',
                llmConfig: llmConfig || { provider: 'openai', model: 'gpt-4o' },
                enabledSkills: enabledSkills || [],
                memoryConfig: body.memoryConfig || { enabled: true, maxEntries: 100 },
                securityConfig: body.securityConfig || { requireApprovalForShell: true, requireApprovalForNetwork: false },
                maxToolIterations: (_a = body.maxToolIterations) !== null && _a !== void 0 ? _a : 10,
                toolTimeout: (_b = body.toolTimeout) !== null && _b !== void 0 ? _b : 30000,
                isDefault,
                createdAt: now,
                updatedAt: now,
            };
            await configs.insertOne(config);
            return c.json({ ok: true, config }, 201);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Update an agent config
    app.put('/configs/:id', async (c) => {
        var _a;
        try {
            const { tenantId } = getUserCtx(c);
            const id = c.req.param('id');
            const body = await c.req.json();
            const configs = agentConfigsCollection();
            const existing = await configs.findOne({ _id: id, tenantId });
            if (!existing)
                return c.json({ error: 'Agent config not found' }, 404);
            const updates = { updatedAt: new Date() };
            if (body.name !== undefined)
                updates.name = body.name;
            if (body.persona !== undefined)
                updates.persona = body.persona;
            if (body.systemPrompt !== undefined)
                updates.systemPrompt = body.systemPrompt;
            if (body.llmConfig !== undefined)
                updates.llmConfig = body.llmConfig;
            if (body.enabledSkills !== undefined)
                updates.enabledSkills = body.enabledSkills;
            if (body.memoryConfig !== undefined)
                updates.memoryConfig = body.memoryConfig;
            if (body.securityConfig !== undefined)
                updates.securityConfig = body.securityConfig;
            if (body.maxToolIterations !== undefined)
                updates.maxToolIterations = body.maxToolIterations;
            if (body.toolTimeout !== undefined)
                updates.toolTimeout = body.toolTimeout;
            // Handle isDefault toggle
            if (body.isDefault === true) {
                await configs.updateMany({ tenantId, isDefault: true }, { $set: { isDefault: false } });
                updates.isDefault = true;
            }
            await configs.updateOne({ _id: id }, { $set: updates });
            const updated = await configs.findOne({ _id: id });
            // Invalidate cached agent instance
            (_a = ctx === null || ctx === void 0 ? void 0 : ctx.agentManager) === null || _a === void 0 ? void 0 : _a.invalidate(id);
            return c.json({ ok: true, config: updated });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Delete an agent config
    app.delete('/configs/:id', async (c) => {
        var _a;
        try {
            const { tenantId } = getUserCtx(c);
            const id = c.req.param('id');
            const configs = agentConfigsCollection();
            const existing = await configs.findOne({ _id: id, tenantId });
            if (!existing)
                return c.json({ error: 'Agent config not found' }, 404);
            await configs.deleteOne({ _id: id, tenantId });
            // Invalidate cached agent instance
            (_a = ctx === null || ctx === void 0 ? void 0 : ctx.agentManager) === null || _a === void 0 ? void 0 : _a.invalidate(id);
            // If we deleted the default, set the newest remaining as default
            if (existing.isDefault) {
                const newest = await configs.findOne({ tenantId }, { sort: { updatedAt: -1 } });
                if (newest) {
                    await configs.updateOne({ _id: newest._id }, { $set: { isDefault: true } });
                }
            }
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Channel Connections ──────────────────────────────────
    // List all channel connections for the current user/tenant
    app.get('/channels', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const channels = channelConnectionsCollection();
            const list = await channels.find(channelFilter(userCtx)).sort({ updatedAt: -1 }).toArray();
            const enriched = list.map((ch) => {
                var _a, _b;
                return (Object.assign(Object.assign({}, ch), { isRunning: (_b = (_a = ctx === null || ctx === void 0 ? void 0 : ctx.channelManager) === null || _a === void 0 ? void 0 : _a.isRunning(ch._id)) !== null && _b !== void 0 ? _b : false }));
            });
            return c.json({ ok: true, channels: enriched });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get a single channel connection
    app.get('/channels/:id', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const channels = channelConnectionsCollection();
            const channel = await channels.findOne(channelFilter(userCtx, { _id: id }));
            if (!channel)
                return c.json({ error: 'Channel not found' }, 404);
            // Mask sensitive config values
            const masked = maskConfig(channel);
            return c.json({ ok: true, channel: masked });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Create a new channel connection
    app.post('/channels', async (c) => {
        try {
            const { tenantId, userId } = getUserCtx(c);
            const body = await c.req.json();
            const { channelType, name, config } = body;
            if (!channelType || !name || !config) {
                return c.json({ error: 'channelType, name, and config are required' }, 400);
            }
            const validTypes = ['telegram', 'discord', 'facebook', 'slack', 'whatsapp', 'zalo', 'msteams', 'webhook'];
            if (!validTypes.includes(channelType)) {
                return c.json({ error: `Invalid channelType. Supported: ${validTypes.join(', ')}` }, 400);
            }
            // Validate channel-specific config
            const validation = validateChannelConfig(channelType, config);
            if (!validation.ok) {
                return c.json({ error: validation.error }, 400);
            }
            const now = new Date();
            const connection = {
                _id: randomUUID(),
                tenantId,
                userId,
                channelType,
                name,
                config,
                status: 'inactive',
                agentConfigId: body.agentConfigId || undefined,
                domainId: body.domainId || undefined,
                createdAt: now,
                updatedAt: now,
            };
            const channels = channelConnectionsCollection();
            await channels.insertOne(connection);
            return c.json({ ok: true, channel: connection }, 201);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Update a channel connection
    app.put('/channels/:id', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const body = await c.req.json();
            const { name, config, status } = body;
            const channels = channelConnectionsCollection();
            const existing = await channels.findOne(channelFilter(userCtx, { _id: id }));
            if (!existing)
                return c.json({ error: 'Channel not found' }, 404);
            const updates = { updatedAt: new Date() };
            if (name)
                updates.name = name;
            if (body.agentConfigId !== undefined)
                updates.agentConfigId = body.agentConfigId || undefined;
            if (body.domainId !== undefined)
                updates.domainId = body.domainId || undefined;
            if (config) {
                // Merge with existing config so partial updates don't wipe out fields
                const mergedConfig = Object.assign(Object.assign({}, existing.config), config);
                const validation = validateChannelConfig(existing.channelType, mergedConfig);
                if (!validation.ok)
                    return c.json({ error: validation.error }, 400);
                updates.config = mergedConfig;
            }
            if (status && ['active', 'inactive'].includes(status)) {
                updates.status = status;
            }
            await channels.updateOne({ _id: id }, { $set: updates });
            const updated = await channels.findOne({ _id: id });
            return c.json({ ok: true, channel: updated });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Delete a channel connection
    app.delete('/channels/:id', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const channels = channelConnectionsCollection();
            const result = await channels.deleteOne(channelFilter(userCtx, { _id: id }));
            if (result.deletedCount === 0)
                return c.json({ error: 'Channel not found' }, 404);
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Test/verify a channel connection
    app.post('/channels/:id/test', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const channels = channelConnectionsCollection();
            const channel = await channels.findOne(channelFilter(userCtx, { _id: id }));
            if (!channel)
                return c.json({ error: 'Channel not found' }, 404);
            const testResult = await testChannelConnection(channel);
            if (testResult.ok) {
                await channels.updateOne({ _id: id }, {
                    $set: {
                        status: 'active',
                        lastConnectedAt: new Date(),
                        metadata: testResult.metadata,
                        updatedAt: new Date(),
                    },
                });
                // Also start the channel runtime so it begins polling/listening immediately
                if (ctx === null || ctx === void 0 ? void 0 : ctx.channelManager) {
                    const updated = await channels.findOne({ _id: id });
                    if (updated) {
                        await ctx.channelManager.stopChannel(id).catch(() => { }); // stop if already running (token change)
                        await ctx.channelManager.startChannel(updated);
                    }
                }
            }
            else {
                await channels.updateOne({ _id: id }, {
                    $set: { status: 'error', updatedAt: new Date() },
                });
                // Stop any existing runtime (e.g. old token was revoked)
                if (ctx === null || ctx === void 0 ? void 0 : ctx.channelManager)
                    await ctx.channelManager.stopChannel(id).catch(() => { });
            }
            return c.json({ ok: testResult.ok, message: testResult.message, metadata: testResult.metadata });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Activate a channel (sets status to active + starts runtime)
    app.post('/channels/:id/activate', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const channels = channelConnectionsCollection();
            const channel = await channels.findOne(channelFilter(userCtx, { _id: id }));
            if (!channel)
                return c.json({ error: 'Channel not found' }, 404);
            // Test first
            const testResult = await testChannelConnection(channel);
            if (!testResult.ok) {
                return c.json({ error: `Cannot activate: ${testResult.message}` }, 400);
            }
            await channels.updateOne({ _id: id }, {
                $set: {
                    status: 'active',
                    lastConnectedAt: new Date(),
                    metadata: testResult.metadata,
                    updatedAt: new Date(),
                },
            });
            // Start the channel runtime if ChannelManager is available
            if (ctx === null || ctx === void 0 ? void 0 : ctx.channelManager) {
                const updated = await channels.findOne({ _id: id });
                if (updated)
                    await ctx.channelManager.startChannel(updated);
            }
            return c.json({ ok: true, message: 'Channel activated', metadata: testResult.metadata });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Deactivate a channel (sets status to inactive + stops runtime)
    app.post('/channels/:id/deactivate', async (c) => {
        try {
            const userCtx = getUserCtx(c);
            const id = c.req.param('id');
            const channels = channelConnectionsCollection();
            const result = await channels.updateOne(channelFilter(userCtx, { _id: id }), { $set: { status: 'inactive', updatedAt: new Date() } });
            if (result.matchedCount === 0)
                return c.json({ error: 'Channel not found' }, 404);
            // Stop the channel runtime if ChannelManager is available
            if (ctx === null || ctx === void 0 ? void 0 : ctx.channelManager) {
                await ctx.channelManager.stopChannel(id);
            }
            return c.json({ ok: true, message: 'Channel deactivated' });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Chat History (cross-platform) ───────────────────────
    // List Telegram/channel sessions for user
    app.get('/sessions', async (c) => {
        try {
            const { tenantId, userId } = getUserCtx(c);
            const platform = c.req.query('platform');
            const sessions = sessionsCollection();
            const filter = { tenantId };
            // Include all sessions belonging to this user (web + telegram + others)
            if (platform) {
                filter.platform = platform;
            }
            // For telegram sessions, match by tg- prefix
            const list = await sessions.find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
            return c.json({ ok: true, sessions: list });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get messages for a session
    app.get('/sessions/:id/messages', async (c) => {
        try {
            const id = c.req.param('id');
            const messages = messagesCollection();
            const list = await messages.find({ sessionId: id }).sort({ createdAt: 1 }).toArray();
            return c.json({ ok: true, messages: list });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // ─── Supported Channel Types ──────────────────────────────
    app.get('/channel-types', (c) => {
        return c.json({
            ok: true,
            types: [
                {
                    id: 'telegram',
                    name: 'Telegram',
                    icon: '✈️',
                    description: 'Connect a Telegram Bot to receive and send messages',
                    configFields: [
                        { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: '123456:ABC-DEF...' },
                    ],
                    setupGuide: 'Open @BotFather on Telegram → /newbot → copy token',
                },
                {
                    id: 'discord',
                    name: 'Discord',
                    icon: '🎮',
                    description: 'Connect a Discord Bot',
                    configFields: [
                        { key: 'botToken', label: 'Bot Token', type: 'password', required: true },
                        { key: 'guildId', label: 'Server ID', type: 'text', required: false },
                    ],
                    setupGuide: 'Create app at discord.com/developers → Bot → copy token',
                },
                {
                    id: 'facebook',
                    name: 'Facebook Messenger',
                    icon: '💬',
                    description: 'Connect Facebook Messenger via Page',
                    configFields: [
                        { key: 'pageAccessToken', label: 'Page Access Token', type: 'password', required: true },
                        { key: 'verifyToken', label: 'Verify Token', type: 'text', required: true },
                        { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
                    ],
                    setupGuide: 'Create app at developers.facebook.com → Messenger settings',
                },
                {
                    id: 'slack',
                    name: 'Slack',
                    icon: '💼',
                    description: 'Connect Slack workspace',
                    configFields: [
                        { key: 'botToken', label: 'Bot Token (xoxb-...)', type: 'password', required: true },
                        { key: 'signingSecret', label: 'Signing Secret', type: 'password', required: true },
                    ],
                    setupGuide: 'Create app at api.slack.com → OAuth & Permissions',
                },
                {
                    id: 'whatsapp',
                    name: 'WhatsApp',
                    icon: '📱',
                    description: 'Connect WhatsApp Business API',
                    configFields: [
                        { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: true },
                        { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
                        { key: 'verifyToken', label: 'Verify Token', type: 'text', required: true },
                    ],
                    setupGuide: 'Set up via Meta Business Suite → WhatsApp',
                },
                {
                    id: 'zalo',
                    name: 'Zalo OA',
                    icon: '💙',
                    description: 'Connect Zalo Official Account for Vietnamese market',
                    configFields: [
                        { key: 'oaId', label: 'OA ID', type: 'text', required: true, placeholder: '990607499038328075' },
                        { key: 'appId', label: 'App ID', type: 'text', required: true, placeholder: '1234567890' },
                        { key: 'secretKey', label: 'Secret Key', type: 'password', required: false, placeholder: 'Webhook verification (optional)' },
                        { key: 'accessToken', label: 'Access Token', type: 'password', required: false, placeholder: 'Optional — for sending messages via API' },
                    ],
                    setupGuide: 'Tạo app tại developers.zalo.me → Liên kết OA → Cấu hình Webhook URL tới HiTechClaw',
                },
                {
                    id: 'msteams',
                    name: 'Microsoft Teams',
                    icon: '🟣',
                    description: 'Connect Microsoft Teams via Bot Framework',
                    configFields: [
                        { key: 'appId', label: 'App ID (Client ID)', type: 'text', required: true },
                        { key: 'appPassword', label: 'App Password (Client Secret)', type: 'password', required: true },
                        { key: 'tenantId', label: 'Tenant ID', type: 'text', required: false, placeholder: 'common' },
                    ],
                    setupGuide: 'Create bot at dev.botframework.com → Azure AD app registration',
                },
                {
                    id: 'webhook',
                    name: 'Webhook',
                    icon: '🔗',
                    description: 'Custom webhook integration',
                    configFields: [
                        { key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true },
                        { key: 'secret', label: 'Secret Key', type: 'password', required: false },
                    ],
                    setupGuide: 'Configure your service to send POST requests to the webhook endpoint',
                },
            ],
        });
    });
    return app;
}
// ─── Helpers ──────────────────────────────────────────────
function validateChannelConfig(channelType, config) {
    switch (channelType) {
        case 'telegram':
            if (!config.botToken || typeof config.botToken !== 'string') {
                return { ok: false, error: 'botToken is required for Telegram' };
            }
            break;
        case 'discord':
            if (!config.botToken || typeof config.botToken !== 'string') {
                return { ok: false, error: 'botToken is required for Discord' };
            }
            break;
        case 'facebook':
            if (!config.pageAccessToken)
                return { ok: false, error: 'pageAccessToken is required for Facebook' };
            if (!config.verifyToken)
                return { ok: false, error: 'verifyToken is required for Facebook' };
            break;
        case 'slack':
            if (!config.botToken)
                return { ok: false, error: 'botToken is required for Slack' };
            break;
        case 'whatsapp':
            if (!config.phoneNumberId)
                return { ok: false, error: 'phoneNumberId is required for WhatsApp' };
            if (!config.accessToken)
                return { ok: false, error: 'accessToken is required for WhatsApp' };
            break;
        case 'zalo':
            if (!config.oaId)
                return { ok: false, error: 'oaId is required for Zalo' };
            if (!config.appId)
                return { ok: false, error: 'appId is required for Zalo' };
            break;
        case 'msteams':
            if (!config.appId)
                return { ok: false, error: 'appId is required for MS Teams' };
            if (!config.appPassword)
                return { ok: false, error: 'appPassword is required for MS Teams' };
            break;
        case 'webhook':
            if (!config.webhookUrl)
                return { ok: false, error: 'webhookUrl is required for Webhook' };
            break;
    }
    return { ok: true };
}
function maskConfig(channel) {
    const maskedConfig = Object.assign({}, channel.config);
    for (const key of Object.keys(maskedConfig)) {
        if (typeof maskedConfig[key] === 'string' && (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key'))) {
            const val = maskedConfig[key];
            maskedConfig[key] = val.length > 8 ? val.slice(0, 4) + '****' + val.slice(-4) : '****';
        }
    }
    return Object.assign(Object.assign({}, channel), { config: maskedConfig });
}
async function testChannelConnection(channel) {
    var _a, _b, _c;
    switch (channel.channelType) {
        case 'telegram': {
            try {
                const token = channel.config.botToken;
                const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok)
                    return { ok: false, message: 'Invalid bot token' };
                const data = await res.json();
                if (!data.ok)
                    return { ok: false, message: 'Invalid bot token' };
                return {
                    ok: true,
                    message: `Connected as @${data.result.username}`,
                    metadata: {
                        botId: data.result.id,
                        botUsername: data.result.username,
                        botName: data.result.first_name,
                    },
                };
            }
            catch (_d) {
                return { ok: false, message: 'Connection failed — check token' };
            }
        }
        case 'discord': {
            try {
                const token = channel.config.botToken;
                const res = await fetch('https://discord.com/api/v10/users/@me', {
                    headers: { Authorization: `Bot ${token}` },
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok)
                    return { ok: false, message: 'Invalid bot token' };
                const data = await res.json();
                return {
                    ok: true,
                    message: `Connected as ${data.username}#${data.discriminator}`,
                    metadata: { botId: data.id, botUsername: data.username },
                };
            }
            catch (_e) {
                return { ok: false, message: 'Connection failed — check token' };
            }
        }
        case 'facebook': {
            try {
                const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(channel.config.pageAccessToken)}`, { signal: AbortSignal.timeout(10000) });
                if (!res.ok)
                    return { ok: false, message: 'Invalid Page Access Token' };
                const data = await res.json();
                if (data.error)
                    return { ok: false, message: `Facebook error: ${((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}` };
                return {
                    ok: true,
                    message: `Connected to Facebook page "${data.name || 'unknown'}"`,
                    metadata: { pageId: data.id, pageName: data.name },
                };
            }
            catch (_f) {
                return { ok: false, message: 'Connection failed — check page access token' };
            }
        }
        case 'slack': {
            try {
                const token = channel.config.botToken;
                const res = await fetch('https://slack.com/api/auth.test', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(10000),
                });
                const data = await res.json();
                if (!data.ok)
                    return { ok: false, message: `Slack error: ${data.error}` };
                return {
                    ok: true,
                    message: `Connected as @${data.user} (team: ${data.team})`,
                    metadata: { botId: data.user_id, botUsername: data.user, team: data.team },
                };
            }
            catch (_g) {
                return { ok: false, message: 'Connection failed — check bot token' };
            }
        }
        case 'whatsapp': {
            try {
                const res = await fetch(`https://graph.facebook.com/v18.0/${channel.config.phoneNumberId}`, { headers: { Authorization: `Bearer ${channel.config.accessToken}` }, signal: AbortSignal.timeout(10000) });
                if (!res.ok)
                    return { ok: false, message: 'Invalid credentials' };
                const data = await res.json();
                return {
                    ok: true,
                    message: `Connected to WhatsApp (${data.display_phone_number || channel.config.phoneNumberId})`,
                    metadata: { phoneNumberId: data.id, displayPhone: data.display_phone_number },
                };
            }
            catch (_h) {
                return { ok: false, message: 'Connection failed — check credentials' };
            }
        }
        case 'zalo': {
            // If accessToken is provided, verify with getOA API
            if (channel.config.accessToken) {
                try {
                    const res = await fetch('https://openapi.zalo.me/v3.0/oa/getoa', {
                        headers: { access_token: channel.config.accessToken },
                        signal: AbortSignal.timeout(10000),
                    });
                    const data = await res.json();
                    if (data.error && data.error !== 0)
                        return { ok: false, message: `Zalo error: ${data.message}` };
                    return {
                        ok: true,
                        message: `Connected to Zalo OA "${((_b = data.data) === null || _b === void 0 ? void 0 : _b.name) || channel.config.oaId}"`,
                        metadata: { oaName: (_c = data.data) === null || _c === void 0 ? void 0 : _c.name, oaId: channel.config.oaId, appId: channel.config.appId },
                    };
                }
                catch (_j) {
                    return { ok: false, message: 'Connection failed — check access token' };
                }
            }
            // Without accessToken, just validate that oaId and appId are configured
            return {
                ok: true,
                message: `Zalo OA configured (OA: ${channel.config.oaId}, App: ${channel.config.appId}) — webhook mode`,
                metadata: { oaId: channel.config.oaId, appId: channel.config.appId },
            };
        }
        case 'msteams': {
            try {
                const res = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: channel.config.appId,
                        client_secret: channel.config.appPassword,
                        scope: 'https://api.botframework.com/.default',
                    }),
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok)
                    return { ok: false, message: 'Invalid app credentials' };
                return {
                    ok: true,
                    message: `Teams bot authenticated (app: ${channel.config.appId})`,
                    metadata: { appId: channel.config.appId, tenantId: channel.config.tenantId },
                };
            }
            catch (_k) {
                return { ok: false, message: 'Connection failed — check app credentials' };
            }
        }
        default:
            return { ok: true, message: 'Configuration saved (verification not available for this channel type)' };
    }
}
