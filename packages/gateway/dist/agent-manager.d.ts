import type { LLMAdapter } from '@hitechclaw/core';
import { Agent, CoordinatorAgent, TaskManager } from '@hitechclaw/core';
import type { AgentConfig, CoordinatorConfig } from '@hitechclaw/shared';
/**
 * AgentManager — converts MongoAgentConfig → Agent instances with caching.
 * Shares LLM adapters across all agents. Falls back to the default global agent.
 */
export declare class AgentManager {
    private agents;
    private adapters;
    private defaultAgent;
    constructor(defaultAgent: Agent);
    /** Register an LLM adapter that will be shared with all dynamically created agents */
    registerAdapter(adapter: LLMAdapter): void;
    /** Get the default/global agent */
    getDefault(): Agent;
    /** Get an agent by config ID, loading from MongoDB if needed */
    getAgent(configId: string | undefined, tenantId?: string): Promise<Agent>;
    /** Get the default agent for a tenant */
    getDefaultForTenant(tenantId: string): Promise<Agent>;
    /** Invalidate cached agent (call after config update/delete) */
    invalidate(configId: string): void;
    /** Convert MongoAgentConfig → AgentConfig */
    private toRuntimeConfig;
    /** Create an Agent from MongoAgentConfig, register adapters, and cache it */
    private createAgentFromConfig;
    /** Create an LLM adapter from provider name and config */
    private createAdapterForProvider;
    /** Extract model name from an adapter (best-effort) */
    private getAdapterModel;
    /**
     * Create a CoordinatorAgent that wraps the given base agent config.
     * The coordinator uses the same LLM but has the spawn_agent tool pre-registered.
     * Returns both the coordinator and its TaskManager for observability.
     */
    createCoordinator(baseConfig: AgentConfig, coordinatorConfig?: CoordinatorConfig): {
        coordinator: CoordinatorAgent;
        taskManager: TaskManager;
    };
}
//# sourceMappingURL=agent-manager.d.ts.map