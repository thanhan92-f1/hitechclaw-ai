import { Hono } from 'hono';
import type { IWorkflowEngine } from '@hitechclaw/shared';
export declare function createWorkflowRoutes(workflowEngine: IWorkflowEngine): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function createWorkflowWebhookRoutes(workflowEngine: IWorkflowEngine): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=workflows.d.ts.map