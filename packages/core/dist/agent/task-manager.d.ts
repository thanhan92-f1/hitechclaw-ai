import type { AgentTask, AgentTaskStatus, AgentTaskType } from '@hitechclaw/shared';
export declare function isTerminalTaskStatus(status: AgentTaskStatus): boolean;
export type { AgentTask, AgentTaskStatus, AgentTaskType };
export interface TaskCreateInput {
    type: AgentTaskType;
    description: string;
    agentId: string;
    sessionId: string;
    parentTaskId?: string;
    metadata?: Record<string, unknown>;
}
/**
 * TaskManager — in-process task lifecycle registry.
 *
 * Tracks all agent tasks (subagent spawns, shell calls, workflows, remote A2A calls)
 * with status transitions: pending → running → completed | failed | cancelled.
 *
 * Designed for single-process use; for multi-process/distributed scenarios,
 * persist tasks to PostgreSQL workflowExecutions table.
 */
export declare class TaskManager {
    private tasks;
    /**
     * Register a pre-built AgentTask (used by AgentSpawnTool where the caller
     * constructs the full task object before the async operation starts).
     */
    register(task: AgentTask): AgentTask;
    /**
     * Create and register a new task in 'pending' status.
     */
    create(input: TaskCreateInput): AgentTask;
    /**
     * Transition a task to a new status.
     * Guards against illegal transitions (e.g. moving out of terminal state).
     */
    transition(taskId: string, newStatus: AgentTaskStatus): AgentTask;
    /**
     * Mark a task as completed with an optional result string.
     */
    complete(taskId: string, result?: string): AgentTask;
    /**
     * Mark a task as failed with an error message.
     */
    fail(taskId: string, error: string): AgentTask;
    /**
     * Cancel a running or pending task.
     */
    cancel(taskId: string): AgentTask;
    get(taskId: string): AgentTask | undefined;
    getOrThrow(taskId: string): AgentTask;
    getBySession(sessionId: string): AgentTask[];
    getByAgent(agentId: string): AgentTask[];
    getChildren(parentTaskId: string): AgentTask[];
    getActiveTasks(): AgentTask[];
    /**
     * Remove all terminal tasks for a session (cleanup after session ends).
     */
    purgeSession(sessionId: string): number;
    snapshot(): AgentTask[];
}
//# sourceMappingURL=task-manager.d.ts.map