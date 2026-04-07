// ============================================================
// Workflow Engine — Execute visual workflows with node handlers
// ============================================================

import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import type {
  Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution,
  NodeExecutionResult, WorkflowNodeType, ToolCall, WorkflowSandboxConfig,
} from '@hitechclaw/shared';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { LLMAdapter } from '../llm/llm-router.js';
import type { LLMRouter } from '../llm/llm-router.js';
import type { EventBus } from '../agent/event-bus.js';

type NodeHandler = (
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  context: WorkflowContext,
) => Promise<Record<string, unknown>>;

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

// ─── Workflow Validator ─────────────────────────────────────

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateWorkflow(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  if (workflow.nodes.length === 0) {
    errors.push({ message: 'Workflow has no nodes', severity: 'error' });
    return errors;
  }

  const triggers = workflow.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) {
    errors.push({ message: 'Workflow has no trigger node', severity: 'error' });
  }
  if (triggers.length > 1) {
    errors.push({ message: 'Workflow has multiple trigger nodes — only the first will be used', severity: 'warning' });
  }

  // Orphan nodes
  const connectedIds = new Set<string>();
  for (const edge of workflow.edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }
  for (const node of workflow.nodes) {
    if (node.type === 'trigger') continue;
    if (!connectedIds.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Node "${node.data.label}" is not connected`, severity: 'warning' });
    }
  }

  // Cycle detection (loop nodes exempt)
  const adj = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(nodeId: string): boolean {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (node?.type === 'loop') return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const next of adj.get(nodeId) ?? []) {
      if (!visited.has(next)) {
        if (hasCycle(next)) return true;
      } else if (inStack.has(next)) {
        const target = workflow.nodes.find(n => n.id === next);
        if (target?.type !== 'loop') return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }
  for (const node of workflow.nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push({ message: 'Workflow contains a cycle (not in a loop node)', severity: 'error' });
      break;
    }
  }

  // Validate required config per node type
  for (const node of workflow.nodes) {
    switch (node.type) {
      case 'llm-call':
        if (!node.data.config.prompt) {
          errors.push({ nodeId: node.id, field: 'prompt', message: `"${node.data.label}" is missing a prompt`, severity: 'error' });
        }
        break;
      case 'tool-call':
        if (!node.data.config.toolName) {
          errors.push({ nodeId: node.id, field: 'toolName', message: `"${node.data.label}" is missing a tool name`, severity: 'error' });
        }
        break;
      case 'condition':
        if (!node.data.config.expression) {
          errors.push({ nodeId: node.id, field: 'expression', message: `"${node.data.label}" is missing a condition expression`, severity: 'error' });
        }
        break;
      case 'http-request':
        if (!node.data.config.url) {
          errors.push({ nodeId: node.id, field: 'url', message: `"${node.data.label}" is missing a URL`, severity: 'error' });
        }
        break;
      case 'code':
        if (!node.data.config.code) {
          errors.push({ nodeId: node.id, field: 'code', message: `"${node.data.label}" has no code`, severity: 'warning' });
        }
        break;
      case 'switch':
        if (!Array.isArray(node.data.config.cases) || (node.data.config.cases as unknown[]).length === 0) {
          errors.push({ nodeId: node.id, field: 'cases', message: `"${node.data.label}" has no cases defined`, severity: 'warning' });
        }
        break;
      case 'loop':
        if (!node.data.config.maxIterations) {
          errors.push({ nodeId: node.id, field: 'maxIterations', message: `"${node.data.label}" is missing maxIterations`, severity: 'warning' });
        }
        break;
    }

    if (node.type === 'merge') {
      const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
      if (incomingCount < 2) {
        errors.push({ nodeId: node.id, message: `"${node.data.label}" (merge) should have at least 2 incoming connections`, severity: 'warning' });
      }
    }
  }

  // Edge references
  const nodeIds = new Set(workflow.nodes.map(n => n.id));
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({ message: `Edge references unknown source node: ${edge.source}`, severity: 'error' });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({ message: `Edge references unknown target node: ${edge.target}`, severity: 'error' });
    }
  }

  return errors;
}

// ─── Workflow Engine ────────────────────────────────────────

export class WorkflowEngine {
  private nodeHandlers: Map<WorkflowNodeType, NodeHandler> = new Map();
  private sandboxConfig?: WorkflowSandboxConfig;

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

  async execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: randomUUID(),
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {
        ...Object.fromEntries((Array.isArray(workflow.variables) ? workflow.variables : []).map(v => [v.name, v.defaultValue])),
        _trigger: triggerData ?? {},
      },
    };

    const context: WorkflowContext = {
      execution,
      variables: execution.variables,
      toolRegistry: this.toolRegistry,
      llmAdapter: this.llmRouter.getAdapter(),
      eventBus: this.eventBus,
      mergeInputs: new Map(),
      mergeArrived: new Map(),
      executing: new Set(),
    };

    // Pre-compute merge node expected input counts
    for (const node of workflow.nodes) {
      if (node.type === 'merge') {
        const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
        context.mergeArrived.set(node.id, incomingCount);
        context.mergeInputs.set(node.id, []);
      }
    }

    await this.eventBus.emit({
      type: 'workflow:started',
      payload: { workflowId: workflow.id, executionId: execution.id },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    try {
      const startNodes = workflow.nodes.filter(n => n.type === 'trigger');
      if (startNodes.length === 0) throw new Error('Workflow has no trigger node');

      await this.executeFromNodes(startNodes, workflow, context);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
      execution.completedAt = new Date().toISOString();
    }

    await this.eventBus.emit({
      type: 'workflow:completed',
      payload: { workflowId: workflow.id, executionId: execution.id, status: execution.status },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    return execution;
  }

  registerNodeHandler(type: WorkflowNodeType, handler: NodeHandler): void {
    this.nodeHandlers.set(type, handler);
  }

  // ─── Execution ────────────────────────────────────────────

  private async executeFromNodes(
    nodes: WorkflowNode[],
    workflow: Workflow,
    context: WorkflowContext,
  ): Promise<void> {
    for (const node of nodes) {
      if (context.execution.status === 'cancelled') return;
      if (context.execution.nodeResults.has(node.id) && node.type !== 'loop') continue;

      // Merge synchronization
      if (node.type === 'merge') {
        const inputs = this.gatherInputs(node, workflow.edges, context);
        const arrived = context.mergeInputs.get(node.id)!;
        arrived.push(inputs);
        const expected = context.mergeArrived.get(node.id)!;
        if (arrived.length < expected) continue;
      }

      const inputs = node.type === 'merge'
        ? this.gatherMergeInputs(node, context)
        : this.gatherInputs(node, workflow.edges, context);

      const result = await this.executeNode(node, inputs, context);
      context.execution.nodeResults.set(node.id, result);

      if (result.status === 'failed') {
        throw new Error(`Node ${node.id} (${node.data.label}) failed: ${result.error}`);
      }

      for (const [key, value] of Object.entries(result.output)) {
        context.variables[`${node.id}.${key}`] = value;
      }

      if (node.type === 'loop') continue;

      // Follow edges
      const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
      const nextNodes: WorkflowNode[] = [];

      for (const edge of outgoingEdges) {
        if (edge.condition) {
          const conditionMet = this.evaluateCondition(edge.condition, context.variables);
          if (!conditionMet) continue;
        }
        const targetNode = workflow.nodes.find(n => n.id === edge.target);
        if (targetNode) nextNodes.push(targetNode);
      }

      if (nextNodes.length > 0) {
        await this.executeFromNodes(nextNodes, workflow, context);
      }
    }
  }

  private async executeNode(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<NodeExecutionResult> {
    const startedAt = new Date().toISOString();
    const handler = this.nodeHandlers.get(node.type);

    if (!handler) {
      return {
        nodeId: node.id, status: 'failed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output: {},
        error: `No handler for node type: ${node.type}`, duration: 0,
      };
    }

    const start = Date.now();

    await this.eventBus.emit({
      type: 'workflow:node:started',
      payload: { nodeId: node.id, nodeType: node.type, label: node.data.label },
      source: 'workflow-engine',
      timestamp: startedAt,
    });

    try {
      const output = await handler(node, inputs, context);
      const duration = Date.now() - start;

      await this.eventBus.emit({
        type: 'workflow:node:completed',
        payload: { nodeId: node.id, nodeType: node.type, duration, output },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id, status: 'completed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output, duration,
      };
    } catch (err) {
      await this.eventBus.emit({
        type: 'workflow:node:failed',
        payload: { nodeId: node.id, nodeType: node.type, error: err instanceof Error ? err.message : String(err) },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id, status: 'failed', startedAt,
        completedAt: new Date().toISOString(),
        input: inputs, output: {},
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  private gatherInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: WorkflowContext,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = edges.filter(e => e.target === node.id);
    for (const edge of incomingEdges) {
      const sourceOutput = context.variables[`${edge.source}.${edge.sourcePort}`];
      if (sourceOutput !== undefined) {
        inputs[edge.targetPort] = sourceOutput;
      }
    }
    return inputs;
  }

  private gatherMergeInputs(node: WorkflowNode, context: WorkflowContext): Record<string, unknown> {
    const allInputs = context.mergeInputs.get(node.id) ?? [];
    const merged: Record<string, unknown> = {};
    for (let i = 0; i < allInputs.length; i++) {
      for (const [key, value] of Object.entries(allInputs[i])) {
        merged[`branch_${i}_${key}`] = value;
      }
    }
    merged._branches = allInputs;
    return merged;
  }

  /** Build a nested sandbox from flat dotted keys, normalizing hyphens to underscores for valid JS identifiers */
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

  /** Normalize hyphens in identifier positions to underscores for valid JS */
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
      // Greedy prefix match: try longest dotted key first (handles flat keys like "trigger-1.data")
      for (let i = keys.length; i >= 1; i--) {
        const prefix = keys.slice(0, i).join('.');
        if (prefix in vars) {
          let value: unknown = vars[prefix];
          // Traverse remaining nested path
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
    this.nodeHandlers.set('trigger', async (_node, _inputs, context) => {
      return { data: context.variables._trigger ?? {} };
    });

    this.nodeHandlers.set('llm-call', async (node, inputs, context) => {
      const prompt = this.resolveTemplate(node.data.config.prompt as string, context.variables);
      const systemPrompt = node.data.config.systemPrompt as string | undefined;
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];
      const response = await context.llmAdapter.chat(messages);
      return { response: response.content, usage: response.usage };
    });

    this.nodeHandlers.set('tool-call', async (node, inputs, context) => {
      const toolName = node.data.config.toolName as string;
      const args = node.data.config.arguments as Record<string, unknown> ?? inputs;
      const resolvedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        resolvedArgs[key] = typeof value === 'string'
          ? this.resolveTemplate(value, context.variables) : value;
      }
      const call: ToolCall = { id: randomUUID(), name: toolName, arguments: resolvedArgs };
      const result = await context.toolRegistry.execute(call);
      return { result: result.result, success: result.success, error: result.error };
    });

    this.nodeHandlers.set('condition', async (node, inputs, context) => {
      const expression = node.data.config.expression as string;
      const result = this.evaluateCondition(expression, { ...context.variables, ...inputs });
      return { result, branch: result ? 'true' : 'false' };
    });

    this.nodeHandlers.set('switch', async (node, inputs, context) => {
      const expression = node.data.config.expression as string ?? '';
      const cases = (node.data.config.cases as { value: string; label: string }[]) ?? [];
      let matchValue: unknown;
      try {
        const sanitized = expression.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
        const normalized = this.normalizeExpression(sanitized);
        const sandbox = vm.createContext(Object.freeze(this.buildSandbox({ ...context.variables, ...inputs })));
        matchValue = vm.runInContext(`(${normalized})`, sandbox, { timeout: 1000 });
      } catch {
        matchValue = this.resolveTemplate(expression, context.variables);
      }
      let matchedCase = 'default';
      for (const c of cases) {
        if (String(matchValue) === c.value) { matchedCase = c.value; break; }
      }
      return { value: matchValue, matchedCase, branch: matchedCase };
    });

    this.nodeHandlers.set('loop', async (node, inputs, context) => {
      const maxIterations = (node.data.config.maxIterations as number) ?? 10;
      const condition = node.data.config.condition as string ?? '';
      const loopVar = (node.data.config.loopVariable as string) ?? 'i';
      const items = (node.data.config.items as unknown[]) ?? (inputs.items as unknown[]) ?? null;
      const results: Record<string, unknown>[] = [];
      const iterations = items ? Math.min(items.length, maxIterations) : maxIterations;

      for (let i = 0; i < iterations; i++) {
        context.variables[`${node.id}.index`] = i;
        context.variables[`${node.id}.${loopVar}`] = items ? items[i] : i;
        context.variables[loopVar] = items ? items[i] : i;
        if (condition) {
          const shouldContinue = this.evaluateCondition(condition, {
            ...context.variables, ...inputs, index: i, [loopVar]: items ? items[i] : i,
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

    this.nodeHandlers.set('sub-workflow', async (node, inputs, context) => {
      const subWorkflowId = node.data.config.workflowId as string;
      if (!subWorkflowId) return { error: 'No sub-workflow ID configured', success: false };
      await context.eventBus.emit({
        type: 'workflow:sub-workflow:requested',
        payload: { subWorkflowId, inputs, parentExecutionId: context.execution.id },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { subWorkflowId, delegated: true, inputs };
    });

    this.nodeHandlers.set('http-request', async (node, _inputs, context) => {
      const url = this.resolveTemplate(node.data.config.url as string, context.variables);
      const method = (node.data.config.method as string) ?? 'GET';
      const headers = (node.data.config.headers as Record<string, string>) ?? {};
      const body = node.data.config.body as string | undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? this.resolveTemplate(body, context.variables) : undefined,
      });
      const responseText = await res.text();
      let responseData: unknown;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }
      return { status: res.status, data: responseData, ok: res.ok };
    });

    this.nodeHandlers.set('transform', async (node, inputs, context) => {
      const template = node.data.config.template as string;
      if (template) {
        const result = this.resolveTemplate(template, { ...context.variables, ...inputs });
        return { result };
      }
      return inputs;
    });

    this.nodeHandlers.set('code', async (node, inputs, context) => {
      const code = node.data.config.code as string;
      const timeoutMs = this.sandboxConfig?.timeoutMs ?? 5000;
      const sandbox = vm.createContext({
        inputs: Object.freeze({ ...inputs }),
        variables: Object.freeze({ ...context.variables }),
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

    this.nodeHandlers.set('notification', async (node, _inputs, context) => {
      const message = this.resolveTemplate(node.data.config.message as string, context.variables);
      const channel = node.data.config.channel as string ?? 'default';
      await context.eventBus.emit({
        type: 'notification:send',
        payload: { message, channel },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { sent: true, message };
    });

    this.nodeHandlers.set('output', async (_node, inputs) => inputs);

    this.nodeHandlers.set('memory-read', async (node, _inputs, context) => {
      const query = this.resolveTemplate(node.data.config.query as string, context.variables);
      return { query, note: 'Memory operations delegated to agent' };
    });

    this.nodeHandlers.set('memory-write', async (node, inputs, context) => {
      const content = this.resolveTemplate(node.data.config.content as string, { ...context.variables, ...inputs });
      return { content, note: 'Memory operations delegated to agent' };
    });
  }
}
