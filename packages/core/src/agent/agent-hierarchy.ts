import type {
    AgentTransferRequest,
    SubAgentRef,
    ToolDefinition
} from '@hitechclaw/shared';
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
export class AgentHierarchy {
  private agents = new Map<string, Agent>();
  private children = new Map<string, Set<string>>(); // parentId → childIds
  private parents = new Map<string, string>(); // childId → parentId
  readonly events = new EventBus();

  /**
   * Register an agent in the hierarchy.
   */
  registerAgent(agent: Agent, parentId?: string): void {
    const id = agent.config.id;
    this.agents.set(id, agent);

    if (parentId) {
      if (!this.children.has(parentId)) {
        this.children.set(parentId, new Set());
      }
      this.children.get(parentId)!.add(id);
      this.parents.set(id, parentId);
    }

    // Register sub-agents from config
    if (agent.config.subAgents?.length) {
      if (!this.children.has(id)) {
        this.children.set(id, new Set());
      }
      for (const ref of agent.config.subAgents) {
        this.children.get(id)!.add(ref.agentConfigId);
      }
    }
  }

  /**
   * Find an agent by name anywhere in the hierarchy.
   */
  findAgentByName(name: string): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.config.name === name) return agent;
    }
    return undefined;
  }

  /**
   * Find an agent by ID.
   */
  findAgentById(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all sub-agents of a given agent.
   */
  getSubAgents(agentId: string): Agent[] {
    const childIds = this.children.get(agentId);
    if (!childIds) return [];
    return [...childIds]
      .map((id) => this.agents.get(id))
      .filter((a): a is Agent => a !== undefined);
  }

  /**
   * Get the parent agent of a given agent.
   */
  getParent(agentId: string): Agent | undefined {
    const parentId = this.parents.get(agentId);
    return parentId ? this.agents.get(parentId) : undefined;
  }

  /**
   * Get sibling agents (same parent).
   */
  getSiblings(agentId: string): Agent[] {
    const parentId = this.parents.get(agentId);
    if (!parentId) return [];
    const childIds = this.children.get(parentId);
    if (!childIds) return [];
    return [...childIds]
      .filter((id) => id !== agentId)
      .map((id) => this.agents.get(id))
      .filter((a): a is Agent => a !== undefined);
  }

  /**
   * Get the transfer_to_agent tool definition for an agent.
   * The tool description includes available target agents.
   */
  getTransferToolDefinition(agentId: string): ToolDefinition {
    const targets = this.getTransferTargets(agentId);
    const targetList = targets.map((t) => `- ${t.name}: ${t.description}`).join('\n');

    return {
      name: 'transfer_to_agent',
      description: `Transfer the conversation to another specialized agent. Available agents:\n${targetList}\n\nCall this when the user's request is better handled by a different agent.`,
      category: 'agent-transfer',
      parameters: [
        {
          name: 'agent_name',
          type: 'string',
          description: `Name of the agent to transfer to. Must be one of: ${targets.map((t) => t.name).join(', ')}`,
          required: true,
        },
        {
          name: 'reason',
          type: 'string',
          description: 'Brief reason for the transfer',
          required: false,
        },
        {
          name: 'context',
          type: 'string',
          description: 'Additional context to pass to the target agent',
          required: false,
        },
      ],
    };
  }

  /**
   * Get available transfer targets for an agent.
   * Targets include: sub-agents, siblings, and parent.
   */
  getTransferTargets(agentId: string): SubAgentRef[] {
    const targets: SubAgentRef[] = [];
    const agent = this.agents.get(agentId);
    if (!agent) return targets;

    // Sub-agents
    const subAgents = this.getSubAgents(agentId);
    for (const sub of subAgents) {
      targets.push({
        agentConfigId: sub.config.id,
        name: sub.config.name,
        description: sub.config.description ?? sub.config.persona.slice(0, 100),
      });
    }

    // Also include refs from config (may not be instantiated yet)
    if (agent.config.subAgents) {
      for (const ref of agent.config.subAgents) {
        if (!targets.some((t) => t.agentConfigId === ref.agentConfigId)) {
          targets.push(ref);
        }
      }
    }

    // Siblings
    const siblings = this.getSiblings(agentId);
    for (const sib of siblings) {
      if (!targets.some((t) => t.agentConfigId === sib.config.id)) {
        targets.push({
          agentConfigId: sib.config.id,
          name: sib.config.name,
          description: sib.config.description ?? sib.config.persona.slice(0, 100),
        });
      }
    }

    // Parent
    const parent = this.getParent(agentId);
    if (parent && !targets.some((t) => t.agentConfigId === parent.config.id)) {
      targets.push({
        agentConfigId: parent.config.id,
        name: parent.config.name,
        description: parent.config.description ?? 'Parent coordinator agent',
      });
    }

    return targets;
  }

  /**
   * Execute a transfer: route the conversation to the target agent.
   * Returns the target agent's response.
   */
  async executeTransfer(
    transfer: AgentTransferRequest,
    sessionId: string,
    originalMessage: string,
  ): Promise<{ agent: Agent; response: string }> {
    const targetAgent = this.findAgentByName(transfer.targetAgentName);
    if (!targetAgent) {
      throw new Error(`Transfer target agent "${transfer.targetAgentName}" not found in hierarchy`);
    }

    await this.events.emit({
      type: 'agent:transfer',
      payload: {
        targetAgent: transfer.targetAgentName,
        reason: transfer.reason,
        sessionId,
      },
      source: 'hierarchy',
      timestamp: new Date().toISOString(),
    });

    // Build context-enriched message for the target agent
    const contextMessage = transfer.context
      ? `[Transferred from another agent. Reason: ${transfer.reason ?? 'delegation'}]\n\nContext: ${transfer.context}\n\nUser message: ${originalMessage}`
      : `[Transferred from another agent. Reason: ${transfer.reason ?? 'delegation'}]\n\nUser message: ${originalMessage}`;

    const response = await targetAgent.chat(sessionId, contextMessage);
    return { agent: targetAgent, response };
  }

  /**
   * List all agents in the hierarchy.
   */
  listAgents(): Array<{ id: string; name: string; parentId?: string; childCount: number }> {
    return [...this.agents.values()].map((agent) => ({
      id: agent.config.id,
      name: agent.config.name,
      parentId: this.parents.get(agent.config.id),
      childCount: this.children.get(agent.config.id)?.size ?? 0,
    }));
  }

  /**
   * Clear all agents from the hierarchy.
   */
  clear(): void {
    this.agents.clear();
    this.children.clear();
    this.parents.clear();
  }
}
