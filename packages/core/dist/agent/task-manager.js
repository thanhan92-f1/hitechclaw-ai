// ============================================================
// TaskManager — Agent task lifecycle tracking
// Inspired by claude-code Task.ts + tasks/ pattern
// ============================================================
import { randomUUID } from 'node:crypto';
export function isTerminalTaskStatus(status) {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
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
export class TaskManager {
    tasks = new Map();
    /**
     * Register a pre-built AgentTask (used by AgentSpawnTool where the caller
     * constructs the full task object before the async operation starts).
     */
    register(task) {
        this.tasks.set(task.id, { ...task });
        return task;
    }
    /**
     * Create and register a new task in 'pending' status.
     */
    create(input) {
        const task = {
            id: randomUUID(),
            type: input.type,
            status: 'pending',
            description: input.description,
            agentId: input.agentId,
            sessionId: input.sessionId,
            parentTaskId: input.parentTaskId,
            startedAt: new Date().toISOString(),
            metadata: input.metadata,
        };
        this.tasks.set(task.id, task);
        return task;
    }
    /**
     * Transition a task to a new status.
     * Guards against illegal transitions (e.g. moving out of terminal state).
     */
    transition(taskId, newStatus) {
        const task = this.getOrThrow(taskId);
        if (isTerminalTaskStatus(task.status)) {
            throw new Error(`TaskManager: cannot transition task "${taskId}" from terminal status "${task.status}" to "${newStatus}"`);
        }
        const updated = { ...task, status: newStatus };
        this.tasks.set(taskId, updated);
        return updated;
    }
    /**
     * Mark a task as completed with an optional result string.
     */
    complete(taskId, result) {
        const task = this.getOrThrow(taskId);
        if (isTerminalTaskStatus(task.status)) {
            throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
        }
        const updated = {
            ...task,
            status: 'completed',
            completedAt: new Date().toISOString(),
            result,
        };
        this.tasks.set(taskId, updated);
        return updated;
    }
    /**
     * Mark a task as failed with an error message.
     */
    fail(taskId, error) {
        const task = this.getOrThrow(taskId);
        if (isTerminalTaskStatus(task.status)) {
            throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
        }
        const updated = {
            ...task,
            status: 'failed',
            completedAt: new Date().toISOString(),
            error,
        };
        this.tasks.set(taskId, updated);
        return updated;
    }
    /**
     * Cancel a running or pending task.
     */
    cancel(taskId) {
        const task = this.getOrThrow(taskId);
        if (isTerminalTaskStatus(task.status)) {
            throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
        }
        const updated = {
            ...task,
            status: 'cancelled',
            completedAt: new Date().toISOString(),
        };
        this.tasks.set(taskId, updated);
        return updated;
    }
    get(taskId) {
        return this.tasks.get(taskId);
    }
    getOrThrow(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`TaskManager: task "${taskId}" not found`);
        }
        return task;
    }
    getBySession(sessionId) {
        return [...this.tasks.values()].filter((t) => t.sessionId === sessionId);
    }
    getByAgent(agentId) {
        return [...this.tasks.values()].filter((t) => t.agentId === agentId);
    }
    getChildren(parentTaskId) {
        return [...this.tasks.values()].filter((t) => t.parentTaskId === parentTaskId);
    }
    getActiveTasks() {
        return [...this.tasks.values()].filter((t) => !isTerminalTaskStatus(t.status));
    }
    /**
     * Remove all terminal tasks for a session (cleanup after session ends).
     */
    purgeSession(sessionId) {
        let count = 0;
        for (const [id, task] of this.tasks.entries()) {
            if (task.sessionId === sessionId && isTerminalTaskStatus(task.status)) {
                this.tasks.delete(id);
                count++;
            }
        }
        return count;
    }
    snapshot() {
        return [...this.tasks.values()];
    }
}
//# sourceMappingURL=task-manager.js.map