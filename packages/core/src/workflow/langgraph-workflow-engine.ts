// ============================================================
// LangGraph Workflow Engine — Execute visual workflows via LangGraph
// ============================================================
// Converts HiTechClaw Workflow definitions into LangGraph StateGraphs.
// Drop-in replacement for the legacy WorkflowEngine with the same
// execute() / validate() contract, plus LangGraph benefits:
// - Checkpointing/resumability
// - Parallel branch execution
// - Built-in cycle & recursion limits
// - Stream-able execution events
// ============================================================

import {
    Annotation,
    END,
    MemorySaver,
    START,
    StateGraph,
} from '@langchain/langgraph';
import type {
    NodeExecutionResult,
    ToolCall,
    Workflow,
    WorkflowEdge, WorkflowExecution,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowSandboxConfig,
} from '@hitechclaw/shared';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import type { EventBus } from '../agent/event-bus.js';
import type { LLMAdapter, LLMRouter } from '../llm/llm-router.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { ValidationError } from './workflow-engine.js';
import { validateWorkflow } from './workflow-engine.js';

// ─── LangGraph State Annotation ────────────────────────────

/** Shared state that flows through every node in the graph */
const WorkflowState = Annotation.Root({
  /** Accumulated variables (flat key→value) */
  variables: Annotation<Record<string, unknown>>({
    reducer: (_prev: Record<string, unknown>, next: Record<string, unknown>) => next,
    default: () => ({}),
  }),
  /** Per-node execution results */
  nodeResults: Annotation<Record<string, NodeExecutionResult>>({
    reducer: (prev: Record<string, NodeExecutionResult>, next: Record<string, NodeExecutionResult>) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  /** Current execution status */
  status: Annotation<'running' | 'completed' | 'failed'>({
    reducer: (_prev: 'running' | 'completed' | 'failed', next: 'running' | 'completed' | 'failed') => next,
    default: () => 'running' as const,
  }),
  /** Error message if failed */
  error: Annotation<string | undefined>({
    reducer: (_prev: string | undefined, next: string | undefined) => next,
    default: () => undefined,
  }),
  /** Merge synchronization counters: nodeId → arrived count */
  mergeArrived: Annotation<Record<string, number>>({
    reducer: (_prev: Record<string, number>, next: Record<string, number>) => next,
    default: () => ({}),
  }),
  /** Merge input accumulator: nodeId → inputs[] */
  mergeInputs: Annotation<Record<string, Record<string, unknown>[]>>({
    reducer: (_prev: Record<string, Record<string, unknown>[]>, next: Record<string, Record<string, unknown>[]>) => next,
    default: () => ({}),
  }),
});

type WorkflowStateType = typeof WorkflowState.State;

// ─── Node handler function type (internal) ──────────────────

type NodeHandlerFn = (
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  vars: Record<string, unknown>,
  deps: WorkflowDeps,
) => Promise<Record<string, unknown>>;

interface WorkflowDeps {
  toolRegistry: ToolRegistry;
  llmAdapter: LLMAdapter;
  eventBus: EventBus;
  sandboxConfig?: WorkflowSandboxConfig;
}

// ─── LangGraph Workflow Engine ──────────────────────────────

export class LangGraphWorkflowEngine {
  private nodeHandlers: Map<WorkflowNodeType, NodeHandlerFn> = new Map();
  private sandboxConfig?: WorkflowSandboxConfig;
  private checkpointer = new MemorySaver();

  constructor(
    private toolRegistry: ToolRegistry,
    private llmRouter: LLMRouter,
    private eventBus: EventBus,
  ) {
    this.registerBuiltinHandlers();
  }

  setSandboxConfig(config: WorkflowSandboxConfig): void {
    this.sandboxConfig = config;
  }

  validate(workflow: Workflow): ValidationError[] {
    return validateWorkflow(workflow);
  }

  registerNodeHandler(type: WorkflowNodeType, handler: NodeHandlerFn): void {
    this.nodeHandlers.set(type, handler);
  }

  // ─── Main Execute ───────────────────────────────────────

  async execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution> {
    const executionId = randomUUID();
    const startedAt = new Date().toISOString();

    await this.eventBus.emit({
      type: 'workflow:started',
      payload: { workflowId: workflow.id, executionId },
      source: 'workflow-engine',
      timestamp: startedAt,
    });

    try {
      const graph = this.compileGraph(workflow);

      // Build initial variables from workflow variable defaults + trigger data
      const initialVars: Record<string, unknown> = {
        ...Object.fromEntries(
          (Array.isArray(workflow.variables) ? workflow.variables : [])
            .map(v => [v.name, v.defaultValue]),
        ),
        _trigger: triggerData ?? {},
      };

      // Pre-compute merge node expected counts
      const mergeArrived: Record<string, number> = {};
      const mergeInputs: Record<string, Record<string, unknown>[]> = {};
      for (const node of workflow.nodes) {
        if (node.type === 'merge') {
          const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
          mergeArrived[node.id] = incomingCount;
          mergeInputs[node.id] = [];
        }
      }

      const result = await graph.invoke(
        {
          variables: initialVars,
          nodeResults: {},
          status: 'running' as const,
          error: undefined,
          mergeArrived,
          mergeInputs,
        },
        {
          configurable: { thread_id: executionId },
          recursionLimit: 100,
        },
      );

      const finalState = result as WorkflowStateType;

      const execution: WorkflowExecution = {
        id: executionId,
        workflowId: workflow.id,
        status: finalState.status === 'failed' ? 'failed' : 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        nodeResults: new Map(Object.entries(finalState.nodeResults)),
        variables: finalState.variables,
        error: finalState.error,
      };

      await this.eventBus.emit({
        type: 'workflow:completed',
        payload: { workflowId: workflow.id, executionId, status: execution.status },
        source: 'workflow-engine',
        timestamp: execution.completedAt!,
      });

      return execution;
    } catch (err) {
      const execution: WorkflowExecution = {
        id: executionId,
        workflowId: workflow.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        nodeResults: new Map(),
        variables: {},
        error: err instanceof Error ? err.message : String(err),
      };

      await this.eventBus.emit({
        type: 'workflow:completed',
        payload: { workflowId: workflow.id, executionId, status: 'failed' },
        source: 'workflow-engine',
        timestamp: execution.completedAt!,
      });

      return execution;
    }
  }

  // ─── Stream Execute (LangGraph bonus) ───────────────────

  async *executeStream(
    workflow: Workflow,
    triggerData?: Record<string, unknown>,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    const executionId = randomUUID();
    const graph = this.compileGraph(workflow);

    const initialVars: Record<string, unknown> = {
      ...Object.fromEntries(
        (Array.isArray(workflow.variables) ? workflow.variables : [])
          .map(v => [v.name, v.defaultValue]),
      ),
      _trigger: triggerData ?? {},
    };

    const mergeArrived: Record<string, number> = {};
    const mergeInputs: Record<string, Record<string, unknown>[]> = {};
    for (const node of workflow.nodes) {
      if (node.type === 'merge') {
        mergeArrived[node.id] = workflow.edges.filter(e => e.target === node.id).length;
        mergeInputs[node.id] = [];
      }
    }

    const stream = await graph.stream(
      {
        variables: initialVars,
        nodeResults: {},
        status: 'running' as const,
        error: undefined,
        mergeArrived,
        mergeInputs,
      },
      {
        configurable: { thread_id: executionId },
        recursionLimit: 100,
        streamMode: 'updates',
      },
    );

    for await (const chunk of stream) {
      yield { event: 'node-update', data: chunk as Record<string, unknown> };
    }

    yield { event: 'done', data: { executionId } };
  }

  // ─── Graph Compilation ──────────────────────────────────

  private compileGraph(workflow: Workflow) {
    const builder = new StateGraph(WorkflowState);
    const deps: WorkflowDeps = {
      toolRegistry: this.toolRegistry,
      llmAdapter: this.llmRouter.getAdapter(),
      eventBus: this.eventBus,
      sandboxConfig: this.sandboxConfig,
    };

    // Map of nodeId → node for quick lookups
    const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));

    // Outgoing edges per node
    const outgoing = new Map<string, WorkflowEdge[]>();
    for (const edge of workflow.edges) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      outgoing.get(edge.source)!.push(edge);
    }

    // Incoming edges per node
    const incoming = new Map<string, WorkflowEdge[]>();
    for (const edge of workflow.edges) {
      if (!incoming.has(edge.target)) incoming.set(edge.target, []);
      incoming.get(edge.target)!.push(edge);
    }

    // Register each workflow node as a LangGraph node
    for (const node of workflow.nodes) {
      const nodeId = this.sanitizeNodeId(node.id);

      builder.addNode(nodeId, async (state: WorkflowStateType) => {
        // Bail if already failed
        if (state.status === 'failed') {
          return { status: 'failed' as const };
        }

        const startedAt = new Date().toISOString();

        await this.eventBus.emit({
          type: 'workflow:node:started',
          payload: { nodeId: node.id, nodeType: node.type, label: node.data.label },
          source: 'workflow-engine',
          timestamp: startedAt,
        });

        // Gather inputs from predecessor edges
        const inputs = this.gatherInputs(node, workflow.edges, state.variables);

        // Handle merge synchronization
        if (node.type === 'merge') {
          const newMergeInputs = { ...state.mergeInputs };
          const newMergeArrived = { ...state.mergeArrived };
          const arrived = [...(newMergeInputs[node.id] ?? []), inputs];
          newMergeInputs[node.id] = arrived;
          const expected = newMergeArrived[node.id] ?? 2;

          if (arrived.length < expected) {
            // Not all branches arrived yet — update merge state but don't execute
            return {
              mergeInputs: newMergeInputs,
              mergeArrived: newMergeArrived,
            };
          }

          // All branches arrived — merge and continue
          const mergedInputs = this.gatherMergeInputs(node, arrived);
          return await this.runNodeHandler(node, mergedInputs, state, deps, startedAt);
        }

        return await this.runNodeHandler(node, inputs, state, deps, startedAt);
      });
    }

    // Wire edges: START → trigger nodes
    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      throw new Error('Workflow has no trigger node');
    }

    // Connect START to first trigger
    builder.addEdge(START, this.sanitizeNodeId(triggerNodes[0].id) as any);

    // Wire up edges between nodes
    for (const node of workflow.nodes) {
      const nodeId = this.sanitizeNodeId(node.id);
      const edges = outgoing.get(node.id) ?? [];

      if (edges.length === 0) {
        // Terminal node → END
        builder.addEdge(nodeId as any, END);
        continue;
      }

      // Condition/switch nodes or edges with conditions → conditional edges
      const hasConditionalEdges = edges.some(e => e.condition) ||
        node.type === 'condition' || node.type === 'switch';

      if (hasConditionalEdges || edges.length > 1) {
        // Use conditional routing
        const targetNodeIds = edges.map(e => this.sanitizeNodeId(e.target));
        const routeMap: Record<string, string> = {};

        for (const edge of edges) {
          const targetId = this.sanitizeNodeId(edge.target);
          const routeKey = edge.condition || edge.sourcePort || targetId;
          routeMap[routeKey] = targetId;
        }

        builder.addConditionalEdges(
          nodeId as any,
          (state: WorkflowStateType) => {
            if (state.status === 'failed') return END;

            const lastResult = state.nodeResults[node.id];

            if (node.type === 'condition') {
              const branch = lastResult?.output?.branch as string;
              // Find edge matching true/false branch
              for (const edge of edges) {
                if (edge.condition === branch || edge.sourcePort === branch) {
                  return this.sanitizeNodeId(edge.target);
                }
              }
              // Default: first edge
              return targetNodeIds[0] ?? END;
            }

            if (node.type === 'switch') {
              const matchedCase = lastResult?.output?.matchedCase as string;
              for (const edge of edges) {
                if (edge.condition === matchedCase || edge.sourcePort === matchedCase) {
                  return this.sanitizeNodeId(edge.target);
                }
              }
              // Default case
              const defaultEdge = edges.find(e => e.condition === 'default' || e.sourcePort === 'default');
              if (defaultEdge) return this.sanitizeNodeId(defaultEdge.target);
              return targetNodeIds[0] ?? END;
            }

            // Generic conditional edges
            for (const edge of edges) {
              if (edge.condition) {
                const met = this.evaluateCondition(edge.condition, state.variables);
                if (met) return this.sanitizeNodeId(edge.target);
              }
            }

            // Fallback: follow all unconditional edges (first one for deterministic routing)
            const unconditional = edges.filter(e => !e.condition);
            if (unconditional.length > 0) {
              return unconditional.map(e => this.sanitizeNodeId(e.target));
            }

            return END;
          },
          [...targetNodeIds, END] as any,
        );
      } else {
        // Single unconditional edge
        builder.addEdge(nodeId as any, this.sanitizeNodeId(edges[0].target) as any);
      }
    }

    return builder.compile({ checkpointer: this.checkpointer });
  }

  // ─── Node Execution ─────────────────────────────────────

  private async runNodeHandler(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    state: WorkflowStateType,
    deps: WorkflowDeps,
    startedAt: string,
  ): Promise<Partial<WorkflowStateType>> {
    const handler = this.nodeHandlers.get(node.type);

    if (!handler) {
      const result: NodeExecutionResult = {
        nodeId: node.id, status: 'failed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output: {},
        error: `No handler for node type: ${node.type}`, duration: 0,
      };

      await this.eventBus.emit({
        type: 'workflow:node:failed',
        payload: { nodeId: node.id, nodeType: node.type, error: result.error },
        source: 'workflow-engine',
        timestamp: result.completedAt!,
      });

      return {
        nodeResults: { [node.id]: result },
        status: 'failed' as const,
        error: result.error,
      };
    }

    const start = Date.now();

    try {
      const output = await handler(node, inputs, state.variables, deps);
      const duration = Date.now() - start;

      const result: NodeExecutionResult = {
        nodeId: node.id, status: 'completed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output, duration,
      };

      // Update variables with node outputs
      const newVars = { ...state.variables };
      for (const [key, value] of Object.entries(output)) {
        newVars[`${node.id}.${key}`] = value;
      }

      await this.eventBus.emit({
        type: 'workflow:node:completed',
        payload: { nodeId: node.id, nodeType: node.type, duration, output },
        source: 'workflow-engine',
        timestamp: result.completedAt!,
      });

      return {
        variables: newVars,
        nodeResults: { [node.id]: result },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await this.eventBus.emit({
        type: 'workflow:node:failed',
        payload: { nodeId: node.id, nodeType: node.type, error: errorMsg },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });

      const result: NodeExecutionResult = {
        nodeId: node.id, status: 'failed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output: {},
        error: errorMsg,
        duration: Date.now() - start,
      };

      return {
        nodeResults: { [node.id]: result },
        status: 'failed' as const,
        error: `Node ${node.id} (${node.data.label}) failed: ${errorMsg}`,
      };
    }
  }

  // ─── Input Gathering ────────────────────────────────────

  private gatherInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = edges.filter(e => e.target === node.id);
    for (const edge of incomingEdges) {
      const sourceOutput = variables[`${edge.source}.${edge.sourcePort}`];
      if (sourceOutput !== undefined) {
        inputs[edge.targetPort] = sourceOutput;
      }
    }
    return inputs;
  }

  private gatherMergeInputs(
    _node: WorkflowNode,
    allInputs: Record<string, unknown>[],
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (let i = 0; i < allInputs.length; i++) {
      for (const [key, value] of Object.entries(allInputs[i])) {
        merged[`branch_${i}_${key}`] = value;
      }
    }
    merged._branches = allInputs;
    return merged;
  }

  // ─── Utilities ──────────────────────────────────────────

  /** LangGraph node IDs cannot contain hyphens in some contexts, sanitize */
  private sanitizeNodeId(id: string): string {
    return id.replace(/-/g, '_');
  }

  private buildSandbox(variables: Record<string, unknown>): Record<string, unknown> {
    const sandbox: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variables)) {
      const safeKey = key.replace(/-/g, '_');
      const parts = safeKey.split('.');
      if (parts.length === 1) {
        sandbox[parts[0]] = value;
      } else {
        let current: Record<string, unknown> = sandbox;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current) || typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
      }
    }
    return sandbox;
  }

  private normalizeExpression(expression: string): string {
    return expression.replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, '$1_$2');
  }

  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      const sanitized = condition.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
      const normalized = this.normalizeExpression(sanitized);
      const sandbox = vm.createContext(Object.freeze(this.buildSandbox(variables)));
      const result = vm.runInContext(`!!(${normalized})`, sandbox, { timeout: 1000 });
      return !!result;
    } catch {
      return false;
    }
  }

  private resolveTemplate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const keys = path.trim().split('.');
      for (let i = keys.length; i >= 1; i--) {
        const prefix = keys.slice(0, i).join('.');
        if (prefix in vars) {
          let value: unknown = vars[prefix];
          for (let j = i; j < keys.length; j++) {
            if (value == null || typeof value !== 'object') return '';
            value = (value as Record<string, unknown>)[keys[j]];
          }
          return value != null ? String(value) : '';
        }
      }
      return '';
    });
  }

  // ─── Built-in Node Handlers ─────────────────────────────

  private registerBuiltinHandlers(): void {
    this.nodeHandlers.set('trigger', async (_node, _inputs, vars) => {
      return { data: vars._trigger ?? {} };
    });

    this.nodeHandlers.set('llm-call', async (node, _inputs, vars, deps) => {
      const prompt = this.resolveTemplate(node.data.config.prompt as string, vars);
      const systemPrompt = node.data.config.systemPrompt as string | undefined;
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];
      const response = await deps.llmAdapter.chat(messages);
      return { response: response.content, usage: response.usage };
    });

    this.nodeHandlers.set('tool-call', async (node, inputs, vars, deps) => {
      const toolName = node.data.config.toolName as string;
      const args = node.data.config.arguments as Record<string, unknown> ?? inputs;
      const resolvedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        resolvedArgs[key] = typeof value === 'string'
          ? this.resolveTemplate(value, vars) : value;
      }
      const call: ToolCall = { id: randomUUID(), name: toolName, arguments: resolvedArgs };
      const result = await deps.toolRegistry.execute(call);
      return { result: result.result, success: result.success, error: result.error };
    });

    this.nodeHandlers.set('condition', async (node, inputs, vars) => {
      const expression = node.data.config.expression as string;
      const result = this.evaluateCondition(expression, { ...vars, ...inputs });
      return { result, branch: result ? 'true' : 'false' };
    });

    this.nodeHandlers.set('switch', async (node, inputs, vars) => {
      const expression = node.data.config.expression as string ?? '';
      const cases = (node.data.config.cases as { value: string; label: string }[]) ?? [];
      let matchValue: unknown;
      try {
        const sanitized = expression.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
        const normalized = this.normalizeExpression(sanitized);
        const sandbox = vm.createContext(Object.freeze(this.buildSandbox({ ...vars, ...inputs })));
        matchValue = vm.runInContext(`(${normalized})`, sandbox, { timeout: 1000 });
      } catch {
        matchValue = this.resolveTemplate(expression, vars);
      }
      let matchedCase = 'default';
      for (const c of cases) {
        if (String(matchValue) === c.value) { matchedCase = c.value; break; }
      }
      return { value: matchValue, matchedCase, branch: matchedCase };
    });

    this.nodeHandlers.set('loop', async (node, inputs, vars) => {
      const maxIterations = (node.data.config.maxIterations as number) ?? 10;
      const condition = node.data.config.condition as string ?? '';
      const loopVar = (node.data.config.loopVariable as string) ?? 'i';
      const items = (node.data.config.items as unknown[]) ?? (inputs.items as unknown[]) ?? null;
      const results: Record<string, unknown>[] = [];
      const iterations = items ? Math.min(items.length, maxIterations) : maxIterations;

      for (let i = 0; i < iterations; i++) {
        vars[`${node.id}.index`] = i;
        vars[`${node.id}.${loopVar}`] = items ? items[i] : i;
        vars[loopVar] = items ? items[i] : i;
        if (condition) {
          const shouldContinue = this.evaluateCondition(condition, {
            ...vars, ...inputs, index: i, [loopVar]: items ? items[i] : i,
          });
          if (!shouldContinue) break;
        }
        results.push({ index: i, item: items ? items[i] : i });
      }
      return { iterations: results.length, results, completed: true };
    });

    this.nodeHandlers.set('merge', async (_node, inputs) => {
      return { merged: true, ...inputs };
    });

    this.nodeHandlers.set('sub-workflow', async (node, inputs, _vars, deps) => {
      const subWorkflowId = node.data.config.workflowId as string;
      if (!subWorkflowId) return { error: 'No sub-workflow ID configured', success: false };
      await deps.eventBus.emit({
        type: 'workflow:sub-workflow:requested',
        payload: { subWorkflowId, inputs },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { subWorkflowId, delegated: true, inputs };
    });

    this.nodeHandlers.set('http-request', async (node, _inputs, vars) => {
      const url = this.resolveTemplate(node.data.config.url as string, vars);
      const method = (node.data.config.method as string) ?? 'GET';
      const headers = (node.data.config.headers as Record<string, string>) ?? {};
      const body = node.data.config.body as string | undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? this.resolveTemplate(body, vars) : undefined,
      });
      const responseText = await res.text();
      let responseData: unknown;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }
      return { status: res.status, data: responseData, ok: res.ok };
    });

    this.nodeHandlers.set('transform', async (node, inputs, vars) => {
      const template = node.data.config.template as string;
      if (template) {
        const result = this.resolveTemplate(template, { ...vars, ...inputs });
        return { result };
      }
      return inputs;
    });

    this.nodeHandlers.set('code', async (node, inputs, vars, deps) => {
      const code = node.data.config.code as string;
      const timeoutMs = deps.sandboxConfig?.timeoutMs ?? 5000;
      const sandbox = vm.createContext({
        inputs: Object.freeze({ ...inputs }),
        variables: Object.freeze({ ...vars }),
        JSON, Math, Date, Array, Object, String, Number, Boolean,
        parseInt, parseFloat, isNaN, isFinite,
        console: { log: () => {}, warn: () => {}, error: () => {} },
      });
      const wrappedCode = `(async function() { "use strict"; ${code} })()`;
      const result = await vm.runInContext(wrappedCode, sandbox, { timeout: timeoutMs });
      return { result };
    });

    this.nodeHandlers.set('wait', async (node) => {
      const ms = (node.data.config.seconds as number ?? 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return { waited: ms };
    });

    this.nodeHandlers.set('notification', async (node, _inputs, vars, deps) => {
      const message = this.resolveTemplate(node.data.config.message as string, vars);
      const channel = node.data.config.channel as string ?? 'default';
      await deps.eventBus.emit({
        type: 'notification:send',
        payload: { message, channel },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { sent: true, message };
    });

    this.nodeHandlers.set('output', async (_node, inputs) => inputs);

    this.nodeHandlers.set('memory-read', async (node, _inputs, vars) => {
      const query = this.resolveTemplate(node.data.config.query as string, vars);
      return { query, note: 'Memory operations delegated to agent' };
    });

    this.nodeHandlers.set('memory-write', async (node, inputs, vars) => {
      const content = this.resolveTemplate(node.data.config.content as string, { ...vars, ...inputs });
      return { content, note: 'Memory operations delegated to agent' };
    });
  }
}
