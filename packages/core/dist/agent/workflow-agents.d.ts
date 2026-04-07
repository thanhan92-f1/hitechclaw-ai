import type { WorkflowAgentConfig, WorkflowAgentResult } from '@hitechclaw/shared';
import { Agent } from './agent.js';
import { EventBus } from './event-bus.js';
/**
 * Shared state container passed between sub-agents during workflow execution.
 * Agents write to `output_key` and subsequent agents read from it.
 */
export interface WorkflowState {
    [key: string]: unknown;
}
/**
 * SequentialWorkflowAgent — Executes sub-agents one after another.
 *
 * Each agent receives the previous agent's output via shared state.
 * The final agent's output becomes the workflow result.
 *
 * Inspired by Google ADK's SequentialAgent.
 */
export declare class SequentialWorkflowAgent {
    readonly config: WorkflowAgentConfig;
    readonly events: EventBus;
    private agents;
    constructor(config: WorkflowAgentConfig);
    setAgents(agents: Agent[]): void;
    execute(input: string, state?: WorkflowState): Promise<WorkflowAgentResult>;
}
/**
 * ParallelWorkflowAgent — Executes sub-agents concurrently.
 *
 * All agents receive the same input and run in parallel.
 * Results are gathered and optionally synthesized by the first agent.
 *
 * Inspired by Google ADK's ParallelAgent.
 */
export declare class ParallelWorkflowAgent {
    readonly config: WorkflowAgentConfig;
    readonly events: EventBus;
    private agents;
    constructor(config: WorkflowAgentConfig);
    setAgents(agents: Agent[]): void;
    execute(input: string, state?: WorkflowState): Promise<WorkflowAgentResult>;
}
/**
 * LoopWorkflowAgent — Executes sub-agents in a loop until escalation or max iterations.
 *
 * Each iteration runs all sub-agents sequentially.
 * The loop stops when:
 * - `maxIterations` is reached
 * - A sub-agent sets `state[escalationKey]` to `true`
 *
 * Inspired by Google ADK's LoopAgent.
 */
export declare class LoopWorkflowAgent {
    readonly config: WorkflowAgentConfig;
    readonly events: EventBus;
    private agents;
    constructor(config: WorkflowAgentConfig);
    setAgents(agents: Agent[]): void;
    execute(input: string, state?: WorkflowState): Promise<WorkflowAgentResult>;
}
/**
 * Factory function to create the appropriate workflow agent based on config type.
 */
export declare function createWorkflowAgent(config: WorkflowAgentConfig): SequentialWorkflowAgent | ParallelWorkflowAgent | LoopWorkflowAgent;
//# sourceMappingURL=workflow-agents.d.ts.map