import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
export function createMultiAgentRoutes(orchestrator) {
    const app = new Hono();
    // List registered agents
    app.get('/agents', (c) => {
        try {
            const agents = orchestrator.getAgents().map((a) => ({
                id: a.config.id,
                name: a.config.name,
                persona: a.config.persona,
                model: a.config.llm.model,
            }));
            return c.json({ ok: true, agents });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Execute a multi-agent task
    app.post('/execute', async (c) => {
        try {
            const body = await c.req.json();
            if (!body.input) {
                return c.json({ error: 'input is required' }, 400);
            }
            const task = {
                id: randomUUID(),
                description: body.input.slice(0, 100),
                input: body.input,
                orchestrationMode: body.mode ?? 'parallel',
                requiredAgentIds: body.agentIds,
                maxRounds: body.maxRounds,
                supervisorAgentId: body.supervisorAgentId,
            };
            const result = await orchestrator.execute(task);
            return c.json({ ok: true, result });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
//# sourceMappingURL=multi-agent.js.map