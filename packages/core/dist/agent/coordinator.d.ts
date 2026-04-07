import type { AgentConfig, AgentDefinition, CoordinatorConfig } from '@hitechclaw/shared';
import type { ChatOptions } from '../llm/llm-router.js';
import { type AgentFactory } from '../tools/agent-spawn-tool.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Agent } from './agent.js';
import { TaskManager } from './task-manager.js';
/**
 * CoordinatorAgent — wraps a standard Agent with coordinator mode.
 *
 * When coordinator mode is active:
 * - The agent's system prompt is prepended with coordinator instructions
 * - The `spawn_agent` tool is automatically registered
 * - Workers are spawned via `AgentFactory` using child/inherited configs
 * - TaskManager tracks all spawned worker tasks
 *
 * Usage:
 *   const coordinator = new CoordinatorAgent(config, { enabled: true }, agentFactory);
 *   const result = await coordinator.coordinate('session-123', 'Research and code a solution for X');
 */
export declare class CoordinatorAgent {
    readonly inner: Agent;
    readonly taskManager: TaskManager;
    private readonly coordinatorConfig;
    private readonly agentFactory;
    private readonly definitions;
    constructor(config: AgentConfig, coordinatorConfig: CoordinatorConfig, agentFactory: AgentFactory, definitions?: AgentDefinition[]);
    /**
     * Initialize and register the spawn_agent tool with the coordinator's registry.
     * Call this once after construction (after the sessionId is known).
     */
    setupSpawnTool(sessionId: string): void;
    /**
     * Run a coordination session.
     * Automatically sets up the spawn_agent tool and runs the main loop.
     */
    coordinate(sessionId: string, userMessage: string, llmOptions?: ChatOptions): Promise<string>;
    /**
     * Expose task manager for observability (e.g. gateway routes showing task progress).
     */
    getActiveTasks(): import("@hitechclaw/shared").AgentTask[];
    /**
     * Get all tasks for a session (active + completed).
     */
    getSessionTasks(sessionId: string): import("@hitechclaw/shared").AgentTask[];
}
/**
 * Build a restricted tool registry for worker agents.
 * Workers should only access the tools listed in `coordinatorConfig.workerTools`.
 */
export declare function buildWorkerToolRegistry(parentRegistry: ToolRegistry, allowedTools?: string[]): ToolRegistry;
/**
 * Create an AgentFactory that inherits parent registry (respecting workerTools).
 * Pass this to CoordinatorAgent constructor.
 */
export declare function createInheritingAgentFactory(parentRegistry: ToolRegistry, coordinatorConfig: CoordinatorConfig): AgentFactory;
/**
 * Check whether coordinator mode should be active for a given config.
 * Reads HITECHCLAW_COORDINATOR_MODE env var if not explicitly set in config.
 */
export declare function isCoordinatorModeEnabled(config?: CoordinatorConfig): boolean;
//# sourceMappingURL=coordinator.d.ts.map