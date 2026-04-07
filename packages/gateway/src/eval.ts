import type { Agent, EvalFramework } from '@hitechclaw/core';
import type { EvalTestCase } from '@hitechclaw/shared';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AgentManager } from './agent-manager.js';

export function createEvalRoutes(evalFramework: EvalFramework, agentManager?: AgentManager, defaultAgent?: Agent) {
  const app = new Hono();

  // Run evaluation suite
  app.post('/run', async (c) => {
    try {
      const body = await c.req.json() as {
        suiteName: string;
        agentConfigId?: string;
        testCases: EvalTestCase[];
      };

      if (!body.testCases?.length) {
        return c.json({ error: 'testCases array is required' }, 400);
      }

      // Resolve agent
      let agent: Agent | undefined;
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

      const result = await evalFramework.runSuite(
        body.suiteName || 'default',
        agent,
        testCases,
      );

      return c.json({ ok: true, result });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // Quick single test evaluation
  app.post('/quick', async (c) => {
    try {
      const body = await c.req.json() as {
        input: string;
        expectedOutput?: string;
        agentConfigId?: string;
      };

      if (!body.input) {
        return c.json({ error: 'input is required' }, 400);
      }

      let agent: Agent | undefined;
      if (body.agentConfigId && agentManager) {
        agent = await agentManager.getAgent(body.agentConfigId);
      }
      agent = agent ?? defaultAgent;
      if (!agent) {
        return c.json({ error: 'No agent available' }, 400);
      }

      const testCase: EvalTestCase = {
        id: randomUUID(),
        input: body.input,
        expectedOutput: body.expectedOutput,
      };

      const result = await evalFramework.runSuite('quick-eval', agent, [testCase]);
      return c.json({ ok: true, result: result.results[0], summary: result.averageMetrics });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}
