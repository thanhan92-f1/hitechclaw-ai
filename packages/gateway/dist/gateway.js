import { eq, getDB } from '@hitechclaw/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { activityLoggerMiddleware } from './activity-logger.js';
import { createAgentsRoutes } from './agents.js';
import { createAnalyticsRoutes } from './analytics.js';
import { createApiKeyRoutes } from './api-keys.js';
import { createApprovalRoutes } from './approvals.js';
import { createZaloMiniAppAuthRoutes } from './auth-zalo-miniapp.js';
import { authMiddleware, createAuthRoutes } from './auth.js';
import { createChannelWebhookRoutes } from './channel-webhooks.js';
import { createChatRoutes } from './chat.js';
import { createDevDocsRoutes } from './dev-docs.js';
import { createDomainRoutes } from './domains.js';
import { createEvalRoutes } from './eval.js';
import { createHandoffRoutes } from './handoff.js';
import { createHealthRoutes } from './health.js';
import { createIntegrationRoutes } from './integrations.js';
import { createKnowledgeRoutes } from './knowledge.js';
import { createMarketplaceRoutes } from './marketplace.js';
import { createMCPRoutes } from './mcp.js';
import { createMedicalRoutes } from './medical.js';
import { createMLRoutes } from './ml.js';
import { createModelsRoutes } from './models.js';
import { createMonitoringRoutes } from './monitoring.js';
import { createMultiAgentRoutes } from './multi-agent.js';
import { createOAuth2Routes } from './oauth2.js';
import { createPluginRoutes } from './plugins.js';
import { createRBACRoutes } from './rbac.js';
import { createReportRoutes } from './report.js';
import { createRetentionRoutes } from './retention.js';
import { createSandboxRoutes } from './sandbox.js';
import { createSearchRoutes } from './search.js';
import { createSettingsRoutes } from './settings.js';
import { createTaskRoutes } from './tasks.js';
import { createTenantRoutes, tenantMiddleware } from './tenant.js';
import { createVoiceRoutes } from './voice.js';
import { createWidgetRoutes } from './widget.js';
import { createWorkflowRoutes, createWorkflowWebhookRoutes } from './workflows.js';
export function createGateway(ctx) {
    const app = new Hono();
    // Middleware
    app.use('*', logger());
    app.use('*', cors({
        origin: ctx.config.corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }));
    // Public routes
    app.route('/', createHealthRoutes());
    app.route('/auth', createAuthRoutes(ctx));
    app.route('/auth/oauth2', createOAuth2Routes(ctx));
    app.route('/auth/zalo-miniapp', createZaloMiniAppAuthRoutes(ctx));
    // Public: tenant list for login page selector
    app.get('/tenants/list', async (c) => {
        const db = getDB();
        const { tenants: tenantsTable } = await import('@hitechclaw/db');
        const rows = await db.select({ slug: tenantsTable.slug, name: tenantsTable.name })
            .from(tenantsTable)
            .where(eq(tenantsTable.status, 'active'));
        return c.json(rows.filter(r => r.slug !== 'platform'));
    });
    // Public webhook routes (no auth — secrets validated per-workflow)
    if (ctx.workflowEngine) {
        app.route('/webhooks/workflow', createWorkflowWebhookRoutes(ctx.workflowEngine));
    }
    if (ctx.channelManager) {
        app.route('/webhooks/channels', createChannelWebhookRoutes(ctx));
    }
    // Protected routes
    const api = new Hono();
    api.use('*', authMiddleware(ctx.config.jwtSecret));
    api.use('*', tenantMiddleware());
    api.use('*', activityLoggerMiddleware());
    api.route('/chat', createChatRoutes(ctx));
    api.route('/knowledge', createKnowledgeRoutes(ctx));
    api.route('/models', createModelsRoutes(ctx));
    api.route('/medical', createMedicalRoutes(ctx));
    api.route('/search', createSearchRoutes(ctx));
    if (ctx.integrationRegistry) {
        api.route('/integrations', createIntegrationRoutes(ctx.integrationRegistry));
    }
    if (ctx.domainPacks) {
        api.route('/domains', createDomainRoutes(ctx.domainPacks));
    }
    if (ctx.mlEngine) {
        api.route('/ml', createMLRoutes(ctx.mlEngine));
    }
    api.route('/settings', createSettingsRoutes());
    api.route('/tenants', createTenantRoutes());
    api.route('/mcp', createMCPRoutes(ctx.domainPacks, ctx.agent));
    api.route('/rbac', createRBACRoutes());
    if (ctx.workflowEngine) {
        api.route('/workflows', createWorkflowRoutes(ctx.workflowEngine));
    }
    if (ctx.monitoring) {
        api.route('/monitoring', createMonitoringRoutes(ctx.monitoring));
    }
    if (ctx.pluginManager) {
        api.route('/plugins', createPluginRoutes(ctx.pluginManager));
    }
    api.route('/agents', createAgentsRoutes(ctx));
    if (ctx.domainPacks) {
        api.route('/marketplace', createMarketplaceRoutes(ctx.domainPacks));
    }
    api.route('/voice', createVoiceRoutes(ctx));
    api.route('/report', createReportRoutes(ctx));
    api.route('/handoff', createHandoffRoutes());
    api.route('/analytics', createAnalyticsRoutes());
    api.route('/api-keys', createApiKeyRoutes());
    api.route('/retention', createRetentionRoutes());
    api.route('/widget', createWidgetRoutes());
    if (ctx.sandboxManager && ctx.tenantSandboxManager) {
        api.route('/sandbox', createSandboxRoutes(ctx.sandboxManager, ctx.tenantSandboxManager));
    }
    api.route('/dev-docs', createDevDocsRoutes());
    if (ctx.multiAgentOrchestrator) {
        api.route('/multi-agent', createMultiAgentRoutes(ctx.multiAgentOrchestrator));
    }
    if (ctx.evalFramework) {
        api.route('/eval', createEvalRoutes(ctx.evalFramework, ctx.agentManager, ctx.agent));
    }
    if (ctx.approvalManager) {
        api.route('/approvals', createApprovalRoutes(ctx.approvalManager));
    }
    if (ctx.taskManager) {
        api.route('/tasks', createTaskRoutes(ctx.taskManager));
    }
    app.route('/api', api);
    return app;
}
export { createGateway as default };
//# sourceMappingURL=gateway.js.map