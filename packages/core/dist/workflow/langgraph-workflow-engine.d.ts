import type { Workflow, WorkflowExecution, WorkflowNode, WorkflowNodeType, WorkflowSandboxConfig } from '@hitechclaw/shared';
import type { EventBus } from '../agent/event-bus.js';
import type { LLMAdapter, LLMRouter } from '../llm/llm-router.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { ValidationError } from './workflow-engine.js';
type NodeHandlerFn = (node: WorkflowNode, inputs: Record<string, unknown>, vars: Record<string, unknown>, deps: WorkflowDeps) => Promise<Record<string, unknown>>;
interface WorkflowDeps {
    toolRegistry: ToolRegistry;
    llmAdapter: LLMAdapter;
    eventBus: EventBus;
    sandboxConfig?: WorkflowSandboxConfig;
}
export declare class LangGraphWorkflowEngine {
    private toolRegistry;
    private llmRouter;
    private eventBus;
    private nodeHandlers;
    private sandboxConfig?;
    private checkpointer;
    constructor(toolRegistry: ToolRegistry, llmRouter: LLMRouter, eventBus: EventBus);
    setSandboxConfig(config: WorkflowSandboxConfig): void;
    validate(workflow: Workflow): ValidationError[];
    registerNodeHandler(type: WorkflowNodeType, handler: NodeHandlerFn): void;
    execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution>;
    executeStream(workflow: Workflow, triggerData?: Record<string, unknown>): AsyncGenerator<{
        event: string;
        data: Record<string, unknown>;
    }>;
    private compileGraph;
    private runNodeHandler;
    private gatherInputs;
    private gatherMergeInputs;
    /** LangGraph node IDs cannot contain hyphens in some contexts, sanitize */
    private sanitizeNodeId;
    private buildSandbox;
    private normalizeExpression;
    private evaluateCondition;
    private resolveTemplate;
    private registerBuiltinHandlers;
}
export {};
//# sourceMappingURL=langgraph-workflow-engine.d.ts.map