// ============================================================
// TaskManager — Agent task lifecycle tracking
// Inspired by claude-code Task.ts + tasks/ pattern
// ============================================================

import type { AgentTask, AgentTaskStatus, AgentTaskType } from '@hitechclaw/shared';
import { randomUUID } from 'node:crypto';

export function isTerminalTaskStatus(status: AgentTaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

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
export class TaskManager {
  private tasks = new Map<string, AgentTask>();

  /**
   * Register a pre-built AgentTask (used by AgentSpawnTool where the caller
   * constructs the full task object before the async operation starts).
   */
  register(task: AgentTask): AgentTask {
    this.tasks.set(task.id, { ...task });
    return task;
  }

  /**
   * Create and register a new task in 'pending' status.
   */
  create(input: TaskCreateInput): AgentTask {
    const task: AgentTask = {
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
  transition(taskId: string, newStatus: AgentTaskStatus): AgentTask {
    const task = this.getOrThrow(taskId);

    if (isTerminalTaskStatus(task.status)) {
      throw new Error(
        `TaskManager: cannot transition task "${taskId}" from terminal status "${task.status}" to "${newStatus}"`,
      );
    }

    const updated: AgentTask = { ...task, status: newStatus };
    this.tasks.set(taskId, updated);
    return updated;
  }

  /**
   * Mark a task as completed with an optional result string.
   */
  complete(taskId: string, result?: string): AgentTask {
    const task = this.getOrThrow(taskId);
    if (isTerminalTaskStatus(task.status)) {
      throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
    }
    const updated: AgentTask = {
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
  fail(taskId: string, error: string): AgentTask {
    const task = this.getOrThrow(taskId);
    if (isTerminalTaskStatus(task.status)) {
      throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
    }
    const updated: AgentTask = {
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
  cancel(taskId: string): AgentTask {
    const task = this.getOrThrow(taskId);
    if (isTerminalTaskStatus(task.status)) {
      throw new Error(`TaskManager: task "${taskId}" is already in terminal status "${task.status}"`);
    }
    const updated: AgentTask = {
      ...task,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, updated);
    return updated;
  }

  get(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  getOrThrow(taskId: string): AgentTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`TaskManager: task "${taskId}" not found`);
    }
    return task;
  }

  getBySession(sessionId: string): AgentTask[] {
    return [...this.tasks.values()].filter((t) => t.sessionId === sessionId);
  }

  getByAgent(agentId: string): AgentTask[] {
    return [...this.tasks.values()].filter((t) => t.agentId === agentId);
  }

  getChildren(parentTaskId: string): AgentTask[] {
    return [...this.tasks.values()].filter((t) => t.parentTaskId === parentTaskId);
  }

  getActiveTasks(): AgentTask[] {
    return [...this.tasks.values()].filter((t) => !isTerminalTaskStatus(t.status));
  }

  /**
   * Remove all terminal tasks for a session (cleanup after session ends).
   */
  purgeSession(sessionId: string): number {
    let count = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.sessionId === sessionId && isTerminalTaskStatus(task.status)) {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }

  snapshot(): AgentTask[] {
    return [...this.tasks.values()];
  }
}
