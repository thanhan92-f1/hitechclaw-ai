import type { Agent, EvalFramework } from '@hitechclaw/core';
import { Hono } from 'hono';
import type { AgentManager } from './agent-manager.js';
export declare function createEvalRoutes(evalFramework: EvalFramework, agentManager?: AgentManager, defaultAgent?: Agent): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=eval.d.ts.map