import type { AgentTransferRequest, SubAgentRef, ToolDefinition } from '@hitechclaw/shared';
import { Agent } from './agent.js';
import { EventBus } from './event-bus.js';
/**
 * AgentHierarchy — Manages a tree of agents with parent/child relationships.
 *
 * Supports:
 * - Building agent trees from AgentConfig.subAgents references
 * - Finding agents by name anywhere in the hierarchy
 * - LLM-driven delegation via transfer_to_agent tool
 * - Registering the transfer tool into agent's ToolRegistry
 *
 * Inspired by Google ADK's Agent Hierarchy & AutoFlow.
 */
export declare class AgentHierarchy {
    private agents;
    private children;
    private parents;
    readonly events: EventBus;
    /**
     * Register an agent in the hierarchy.
     */
    registerAgent(agent: Agent, parentId?: string): void;
    /**
     * Find an agent by name anywhere in the hierarchy.
     */
    findAgentByName(name: string): Agent | undefined;
    /**
     * Find an agent by ID.
     */
    findAgentById(id: string): Agent | undefined;
    /**
     * Get all sub-agents of a given agent.
     */
    getSubAgents(agentId: string): Agent[];
    /**
     * Get the parent agent of a given agent.
     */
    getParent(agentId: string): Agent | undefined;
    /**
     * Get sibling agents (same parent).
     */
    getSiblings(agentId: string): Agent[];
    /**
     * Get the transfer_to_agent tool definition for an agent.
     * The tool description includes available target agents.
     */
    getTransferToolDefinition(agentId: string): ToolDefinition;
    /**
     * Get available transfer targets for an agent.
     * Targets include: sub-agents, siblings, and parent.
     */
    getTransferTargets(agentId: string): SubAgentRef[];
    /**
     * Execute a transfer: route the conversation to the target agent.
     * Returns the target agent's response.
     */
    executeTransfer(transfer: AgentTransferRequest, sessionId: string, originalMessage: string): Promise<{
        agent: Agent;
        response: string;
    }>;
    /**
     * List all agents in the hierarchy.
     */
    listAgents(): Array<{
        id: string;
        name: string;
        parentId?: string;
        childCount: number;
    }>;
    /**
     * Clear all agents from the hierarchy.
     */
    clear(): void;
}
//# sourceMappingURL=agent-hierarchy.d.ts.map