import type { MultiAgentResult, MultiAgentTask } from '@hitechclaw/shared';
import { Agent } from './agent.js';
import { EventBus } from './event-bus.js';
/**
 * Multi-Agent Collaboration — Orchestrates multiple agents working together
 * on complex tasks using different coordination patterns.
 *
 * Modes:
 * - `sequential`: Agents process in order, each building on previous output
 * - `parallel`: All agents process simultaneously, results merged
 * - `debate`: Agents debate and refine answers across rounds
 * - `supervisor`: A supervisor agent delegates and synthesizes sub-results
 */
export declare class MultiAgentOrchestrator {
    private agents;
    readonly events: EventBus;
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): void;
    getAgents(): Agent[];
    execute(task: MultiAgentTask): Promise<MultiAgentResult>;
    /**
     * Sequential: Each agent processes in order, receiving the previous agent's output.
     */
    private executeSequential;
    /**
     * Parallel: All agents process simultaneously, results are merged.
     */
    private executeParallel;
    /**
     * Debate: Agents take turns refining the answer across multiple rounds.
     */
    private executeDebate;
    /**
     * Supervisor: A designated supervisor agent delegates subtasks and synthesizes.
     */
    private executeSupervisor;
    private selectAgents;
}
//# sourceMappingURL=multi-agent.d.ts.map