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
export function createTaskRoutes(taskManager: TaskManager) {
  const app = new Hono();

  // GET /api/tasks?sessionId=&agentId=
  app.get('/', (c) => {
    const sessionId = c.req.query('sessionId');
    const agentId = c.req.query('agentId');

    let tasks;
    if (sessionId) {
      tasks = taskManager.getBySession(sessionId);
    } else if (agentId) {
      tasks = taskManager.getByAgent(agentId);
    } else {
      tasks = taskManager.snapshot();
    }

    return c.json({ tasks });
  });

  // GET /api/tasks/active
  app.get('/active', (c) => {
    const tasks = taskManager.getActiveTasks();
    return c.json({ tasks });
  });

  // GET /api/tasks/:id
  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const task = taskManager.get(id);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json({ task });
  });

  // POST /api/tasks/:id/cancel
  app.post('/:id/cancel', (c) => {
    const id = c.req.param('id');
    try {
      taskManager.cancel(id);
      return c.json({ ok: true, id });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to cancel task' }, 400);
    }
  });

  return app;
}
