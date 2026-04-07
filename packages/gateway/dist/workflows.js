// ============================================================
// Workflow Routes — CRUD + execution
// ============================================================
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { getDB, workflows, workflowExecutions, eq, and, desc } from '@hitechclaw/db';
// Normalize API-format nodes/edges to full WorkflowNode/WorkflowEdge shapes
function normalizeNode(raw) {
    // If it already has data.label (React Flow format), return as-is
    if (raw.data && typeof raw.data.label === 'string')
        return raw;
    return {
        id: raw.id,
        type: raw.type,
        position: raw.position ?? { x: 0, y: 0 },
        data: {
            label: raw.name ?? raw.label ?? raw.id,
            description: raw.description,
            config: raw.config ?? raw.data?.config ?? {},
        },
        inputs: raw.inputs ?? [],
        outputs: raw.outputs ?? [],
    };
}
function normalizeEdge(raw) {
    // If it already has source/target (React Flow format), return as-is
    if (typeof raw.source === 'string' && typeof raw.target === 'string')
        return { id: raw.id ?? randomUUID(), sourcePort: raw.sourcePort ?? 'default', targetPort: raw.targetPort ?? 'default', ...raw };
    return {
        id: raw.id ?? randomUUID(),
        source: raw.from ?? raw.source,
        sourcePort: raw.sourcePort ?? 'default',
        target: raw.to ?? raw.target,
        targetPort: raw.targetPort ?? 'default',
        condition: raw.condition,
    };
}
function buildWorkflow(row) {
    const def = row.definition;
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        version: row.version,
        nodes: (def.nodes ?? []).map(normalizeNode),
        edges: (def.edges ?? []).map(normalizeEdge),
        variables: Array.isArray(def.variables) ? def.variables : [],
        trigger: def.trigger ?? { id: 'manual', type: 'manual', name: 'Manual', description: 'Manual trigger', config: {} },
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString(),
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt.toISOString(),
        enabled: row.enabled,
    };
}
export function createWorkflowRoutes(workflowEngine) {
    const app = new Hono();
    // List workflows for tenant
    app.get('/', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const rows = await db
                .select()
                .from(workflows)
                .where(eq(workflows.tenantId, tenantId))
                .orderBy(desc(workflows.updatedAt));
            return c.json({
                ok: true,
                workflows: rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    version: r.version,
                    enabled: r.enabled,
                    nodeCount: r.definition?.nodes?.length ?? 0,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                })),
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get workflow by ID
    app.get('/:id', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const [row] = await db
                .select()
                .from(workflows)
                .where(and(eq(workflows.id, c.req.param('id')), eq(workflows.tenantId, tenantId)));
            if (!row)
                return c.json({ error: 'Workflow not found' }, 404);
            return c.json({ ok: true, workflow: { ...row, definition: row.definition } });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Create workflow
    app.post('/', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const body = await c.req.json();
            if (!body.name || !body.definition) {
                return c.json({ error: 'name and definition are required' }, 400);
            }
            const id = randomUUID();
            const db = getDB();
            await db.insert(workflows).values({
                id,
                tenantId,
                name: body.name,
                description: body.description ?? '',
                version: 1,
                definition: body.definition,
                enabled: true,
            });
            return c.json({ ok: true, id }, 201);
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Update workflow
    app.put('/:id', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const body = await c.req.json();
            const [existing] = await db
                .select()
                .from(workflows)
                .where(and(eq(workflows.id, c.req.param('id')), eq(workflows.tenantId, tenantId)));
            if (!existing)
                return c.json({ error: 'Workflow not found' }, 404);
            const updates = { updatedAt: new Date() };
            if (body.name !== undefined)
                updates.name = body.name;
            if (body.description !== undefined)
                updates.description = body.description;
            if (body.enabled !== undefined)
                updates.enabled = body.enabled;
            if (body.definition !== undefined) {
                updates.definition = body.definition;
                updates.version = existing.version + 1;
            }
            await db.update(workflows).set(updates).where(eq(workflows.id, existing.id));
            return c.json({ ok: true, version: updates.version ?? existing.version });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Delete workflow
    app.delete('/:id', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const [existing] = await db
                .select()
                .from(workflows)
                .where(and(eq(workflows.id, c.req.param('id')), eq(workflows.tenantId, tenantId)));
            if (!existing)
                return c.json({ error: 'Workflow not found' }, 404);
            await db.delete(workflows).where(eq(workflows.id, existing.id));
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Validate workflow
    app.post('/:id/validate', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const [row] = await db
                .select()
                .from(workflows)
                .where(and(eq(workflows.id, c.req.param('id')), eq(workflows.tenantId, tenantId)));
            if (!row)
                return c.json({ error: 'Workflow not found' }, 404);
            const workflow = buildWorkflow(row);
            const errors = workflowEngine.validate(workflow);
            return c.json({ ok: true, valid: errors.filter((e) => e.severity === 'error').length === 0, errors });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Execute workflow
    app.post('/:id/execute', async (c) => {
        try {
            const tenantId = c.get('tenantId');
            const db = getDB();
            const [row] = await db
                .select()
                .from(workflows)
                .where(and(eq(workflows.id, c.req.param('id')), eq(workflows.tenantId, tenantId)));
            if (!row)
                return c.json({ error: 'Workflow not found' }, 404);
            if (!row.enabled)
                return c.json({ error: 'Workflow is disabled' }, 400);
            const body = await c.req.json().catch(() => ({ triggerData: undefined }));
            const workflow = buildWorkflow(row);
            // Validate before executing
            const validationErrors = workflowEngine.validate(workflow);
            const hasErrors = validationErrors.filter((e) => e.severity === 'error').length > 0;
            if (hasErrors) {
                return c.json({ error: 'Workflow has validation errors', validationErrors }, 400);
            }
            const execution = await workflowEngine.execute(workflow, body.triggerData);
            // Persist execution result
            const nodeResultsObj = {};
            execution.nodeResults.forEach((v, k) => { nodeResultsObj[k] = v; });
            await db.insert(workflowExecutions).values({
                id: execution.id,
                workflowId: row.id,
                status: execution.status,
                nodeResults: nodeResultsObj,
                variables: execution.variables,
                error: execution.error ?? null,
                startedAt: new Date(execution.startedAt),
                completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
            });
            return c.json({
                ok: true,
                execution: {
                    id: execution.id,
                    status: execution.status,
                    startedAt: execution.startedAt,
                    completedAt: execution.completedAt,
                    error: execution.error,
                    nodeResults: nodeResultsObj,
                },
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // List executions for a workflow
    app.get('/:id/executions', async (c) => {
        try {
            const db = getDB();
            const rows = await db
                .select()
                .from(workflowExecutions)
                .where(eq(workflowExecutions.workflowId, c.req.param('id')))
                .orderBy(desc(workflowExecutions.startedAt))
                .limit(50);
            return c.json({ ok: true, executions: rows });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Get single execution
    app.get('/executions/:execId', async (c) => {
        try {
            const db = getDB();
            const [row] = await db
                .select()
                .from(workflowExecutions)
                .where(eq(workflowExecutions.id, c.req.param('execId')));
            if (!row)
                return c.json({ error: 'Execution not found' }, 404);
            return c.json({ ok: true, execution: row });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
// ---------------------------------------------------------------------------
// Public webhook handler — mounts at /webhooks/workflow/:workflowId
// No auth middleware; optional secret validation via trigger config.
// ---------------------------------------------------------------------------
export function createWorkflowWebhookRoutes(workflowEngine) {
    const app = new Hono();
    app.post('/:workflowId', async (c) => {
        try {
            const db = getDB();
            const workflowId = c.req.param('workflowId');
            const [row] = await db
                .select()
                .from(workflows)
                .where(eq(workflows.id, workflowId));
            if (!row)
                return c.json({ error: 'Workflow not found' }, 404);
            if (!row.enabled)
                return c.json({ error: 'Workflow is disabled' }, 400);
            const def = row.definition;
            const trigger = def?.trigger;
            if (!trigger || trigger.type !== 'webhook') {
                return c.json({ error: 'Workflow does not have a webhook trigger' }, 400);
            }
            // Optional secret validation
            const expectedSecret = trigger.config?.secret;
            if (expectedSecret) {
                const incomingSecret = c.req.header('x-webhook-secret') ??
                    c.req.query('secret');
                if (incomingSecret !== expectedSecret) {
                    return c.json({ error: 'Invalid webhook secret' }, 401);
                }
            }
            const body = await c.req.json().catch(() => ({}));
            const workflow = buildWorkflow(row);
            const execution = await workflowEngine.execute(workflow, {
                triggeredBy: 'webhook',
                webhookPayload: body,
                receivedAt: new Date().toISOString(),
            });
            const nodeResultsObj = {};
            execution.nodeResults.forEach((v, k) => { nodeResultsObj[k] = v; });
            await db.insert(workflowExecutions).values({
                id: execution.id,
                workflowId: row.id,
                status: execution.status,
                nodeResults: nodeResultsObj,
                variables: execution.variables,
                error: execution.error ?? null,
                startedAt: new Date(execution.startedAt),
                completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
            });
            return c.json({
                ok: true,
                executionId: execution.id,
                status: execution.status,
            });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
//# sourceMappingURL=workflows.js.map