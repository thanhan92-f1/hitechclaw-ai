import type { Agent, ApprovalManager, CoordinatorAgent, EvalFramework, MonitoringService, MultiAgentOrchestrator, OllamaAdapter, PluginManager, RagEngine, TaskManager } from '@hitechclaw/core';
import type { DomainPack } from '@hitechclaw/domains';
import type { IntegrationRegistry } from '@hitechclaw/integrations';
import type { MLEngine } from '@hitechclaw/ml';
import type { SandboxManager, TenantSandboxManager } from '@hitechclaw/sandbox';
import type { GatewayConfig, IWorkflowEngine } from '@hitechclaw/shared';
import { Hono } from 'hono';
import type { AgentManager } from './agent-manager.js';
export interface GatewayContext {
    agent: Agent;
    agentManager?: AgentManager;
    rag: RagEngine;
    config: GatewayConfig;
    ollamaAdapter?: OllamaAdapter;
    integrationRegistry?: IntegrationRegistry;
    domainPacks?: DomainPack[];
    mlEngine?: MLEngine;
    workflowEngine?: IWorkflowEngine;
    monitoring?: MonitoringService;
    pluginManager?: PluginManager;
    sandboxManager?: SandboxManager;
    tenantSandboxManager?: TenantSandboxManager;
    channelManager?: {
        startChannel(conn: any): Promise<void>;
        stopChannel(id: string): Promise<void>;
        isRunning(id: string): boolean;
        getInstance?(id: string): unknown;
    };
    multiAgentOrchestrator?: MultiAgentOrchestrator;
    evalFramework?: EvalFramework;
    approvalManager?: ApprovalManager;
    coordinatorAgent?: CoordinatorAgent;
    taskManager?: TaskManager;
}
export declare function createGateway(ctx: GatewayContext): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export { createGateway as default };
//# sourceMappingURL=gateway.d.ts.map