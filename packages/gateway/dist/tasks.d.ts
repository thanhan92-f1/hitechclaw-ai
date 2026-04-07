import type { TaskManager } from '@hitechclaw/core';
import { Hono } from 'hono';
/**
 * Task monitoring routes — expose in-process TaskManager state over HTTP.
 * Mounted at /api/tasks (protected by auth middleware).
 *
 * GET  /api/tasks              — list all tasks, optionally filtered by sessionId or agentId
 * GET  /api/tasks/active       — list currently running / pending tasks
 * GET  /api/tasks/:id          — single task detail
 * POST /api/tasks/:id/cancel   — request cancellation of a task
 */
export declare function createTaskRoutes(taskManager: TaskManager): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=tasks.d.ts.map