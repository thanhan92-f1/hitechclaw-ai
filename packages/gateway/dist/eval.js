import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
export function createEvalRoutes(evalFramework, agentManager, defaultAgent) {
    const app = new Hono();
    // Run evaluation suite
    app.post('/run', async (c) => {
        try {
            const body = await c.req.json();
            if (!body.testCases?.length) {
                return c.json({ error: 'testCases array is required' }, 400);
            }
            // Resolve agent
            let agent;
            if (body.agentConfigId && agentManager) {
                agent = await agentManager.getAgent(body.agentConfigId);
            }
            agent = agent ?? defaultAgent;
            if (!agent) {
                return c.json({ error: 'No agent available' }, 400);
            }
            // Ensure test case IDs
            const testCases = body.testCases.map((tc) => ({
                ...tc,
                id: tc.id || randomUUID(),
            }));
            const result = await evalFramework.runSuite(body.suiteName || 'default', agent, testCases);
            return c.json({ ok: true, result });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    // Quick single test evaluation
    app.post('/quick', async (c) => {
        try {
            const body = await c.req.json();
            if (!body.input) {
                return c.json({ error: 'input is required' }, 400);
            }
            let agent;
            if (body.agentConfigId && agentManager) {
                agent = await agentManager.getAgent(body.agentConfigId);
            }
            agent = agent ?? defaultAgent;
            if (!agent) {
                return c.json({ error: 'No agent available' }, 400);
            }
            const testCase = {
                id: randomUUID(),
                input: body.input,
                expectedOutput: body.expectedOutput,
            };
            const result = await evalFramework.runSuite('quick-eval', agent, [testCase]);
            return c.json({ ok: true, result: result.results[0], summary: result.averageMetrics });
        }
        catch (err) {
            return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
        }
    });
    return app;
}
//# sourceMappingURL=eval.js.map