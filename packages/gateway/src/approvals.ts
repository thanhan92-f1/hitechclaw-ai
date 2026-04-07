import type { ApprovalManager } from '@hitechclaw/core';
import { Hono } from 'hono';

export function createApprovalRoutes(approvalManager: ApprovalManager) {
  const app = new Hono();

  // List pending approvals
  app.get('/pending', (c) => {
    try {
      const pending = approvalManager.getPending();
      return c.json({ ok: true, approvals: pending });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // List all approvals (pending + resolved)
  app.get('/', (c) => {
    try {
      const all = approvalManager.getAll();
      return c.json({ ok: true, approvals: all });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // Approve a pending request
  app.post('/:id/approve', async (c) => {
    try {
      const id = c.req.param('id');
      const approval = approvalManager.getById(id);
      if (!approval) {
        return c.json({ error: 'Approval request not found' }, 404);
      }
      if (approval.status !== 'pending') {
        return c.json({ error: `Request already ${approval.status}` }, 400);
      }

      const userId = c.get('userId' as never) as string | undefined;
      await approvalManager.approve(id, userId);
      return c.json({ ok: true, status: 'approved' });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // Reject a pending request
  app.post('/:id/reject', async (c) => {
    try {
      const id = c.req.param('id');
      const approval = approvalManager.getById(id);
      if (!approval) {
        return c.json({ error: 'Approval request not found' }, 404);
      }
      if (approval.status !== 'pending') {
        return c.json({ error: `Request already ${approval.status}` }, 400);
      }

      const userId = c.get('userId' as never) as string | undefined;
      await approvalManager.reject(id, userId);
      return c.json({ ok: true, status: 'rejected' });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}
