import type { Workflow, WorkflowNode, WorkflowExecution, WorkflowNodeType, WorkflowSandboxConfig } from '@hitechclaw/shared';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { LLMAdapter } from '../llm/llm-router.js';
import type { LLMRouter } from '../llm/llm-router.js';
import type { EventBus } from '../agent/event-bus.js';
type NodeHandler = (node: WorkflowNode, inputs: Record<string, unknown>, context: WorkflowContext) => Promise<Record<string, unknown>>;
interface WorkflowContext {
    execution: WorkflowExecution;
    variables: Record<string, unknown>;
    toolRegistry: ToolRegistry;
    llmAdapter: LLMAdapter;
    eventBus: EventBus;
    mergeInputs: Map<string, Record<string, unknown>[]>;
    mergeArrived: Map<string, number>;
    executing: Set<string>;
}
export interface ValidationError {
    nodeId?: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
}
export declare function validateWorkflow(workflow: Workflow): ValidationError[];
export declare class WorkflowEngine {
    private toolRegistry;
    private llmRouter;
    private eventBus;
    private nodeHandlers;
    private sandboxConfig?;
    constructor(toolRegistry: ToolRegistry, llmRouter: LLMRouter, eventBus: EventBus);
    setSandboxConfig(config: WorkflowSandboxConfig): void;
    validate(workflow: Workflow): ValidationError[];
    execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution>;
    registerNodeHandler(type: WorkflowNodeType, handler: NodeHandler): void;
    private executeFromNodes;
    private executeNode;
    private gatherInputs;
    private gatherMergeInputs;
    /** Build a nested sandbox from flat dotted keys, normalizing hyphens to underscores for valid JS identifiers */
    private buildSandbox;
    /** Normalize hyphens in identifier positions to underscores for valid JS */
    private normalizeExpression;
    private evaluateCondition;
    private resolveTemplate;
    private registerBuiltinHandlers;
}
export {};
//# sourceMappingURL=workflow-engine.d.ts.map