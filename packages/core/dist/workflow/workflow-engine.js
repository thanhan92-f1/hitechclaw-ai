// ============================================================
// Workflow Engine — Execute visual workflows with node handlers
// ============================================================
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
export function validateWorkflow(workflow) {
    const errors = [];
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
    const connectedIds = new Set();
    for (const edge of workflow.edges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
    }
    for (const node of workflow.nodes) {
        if (node.type === 'trigger')
            continue;
        if (!connectedIds.has(node.id)) {
            errors.push({ nodeId: node.id, message: `Node "${node.data.label}" is not connected`, severity: 'warning' });
        }
    }
    // Cycle detection (loop nodes exempt)
    const adj = new Map();
    for (const edge of workflow.edges) {
        if (!adj.has(edge.source))
            adj.set(edge.source, []);
        adj.get(edge.source).push(edge.target);
    }
    const visited = new Set();
    const inStack = new Set();
    function hasCycle(nodeId) {
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (node?.type === 'loop')
            return false;
        visited.add(nodeId);
        inStack.add(nodeId);
        for (const next of adj.get(nodeId) ?? []) {
            if (!visited.has(next)) {
                if (hasCycle(next))
                    return true;
            }
            else if (inStack.has(next)) {
                const target = workflow.nodes.find(n => n.id === next);
                if (target?.type !== 'loop')
                    return true;
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
                if (!Array.isArray(node.data.config.cases) || node.data.config.cases.length === 0) {
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
    toolRegistry;
    llmRouter;
    eventBus;
    nodeHandlers = new Map();
    sandboxConfig;
    constructor(toolRegistry, llmRouter, eventBus) {
        this.toolRegistry = toolRegistry;
        this.llmRouter = llmRouter;
        this.eventBus = eventBus;
        this.registerBuiltinHandlers();
    }
    setSandboxConfig(config) {
        this.sandboxConfig = config;
    }
    validate(workflow) {
        return validateWorkflow(workflow);
    }
    async execute(workflow, triggerData) {
        const execution = {
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
        const context = {
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
            if (startNodes.length === 0)
                throw new Error('Workflow has no trigger node');
            await this.executeFromNodes(startNodes, workflow, context);
            execution.status = 'completed';
            execution.completedAt = new Date().toISOString();
        }
        catch (err) {
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
    registerNodeHandler(type, handler) {
        this.nodeHandlers.set(type, handler);
    }
    // ─── Execution ────────────────────────────────────────────
    async executeFromNodes(nodes, workflow, context) {
        for (const node of nodes) {
            if (context.execution.status === 'cancelled')
                return;
            if (context.execution.nodeResults.has(node.id) && node.type !== 'loop')
                continue;
            // Merge synchronization
            if (node.type === 'merge') {
                const inputs = this.gatherInputs(node, workflow.edges, context);
                const arrived = context.mergeInputs.get(node.id);
                arrived.push(inputs);
                const expected = context.mergeArrived.get(node.id);
                if (arrived.length < expected)
                    continue;
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
            if (node.type === 'loop')
                continue;
            // Follow edges
            const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
            const nextNodes = [];
            for (const edge of outgoingEdges) {
                if (edge.condition) {
                    const conditionMet = this.evaluateCondition(edge.condition, context.variables);
                    if (!conditionMet)
                        continue;
                }
                const targetNode = workflow.nodes.find(n => n.id === edge.target);
                if (targetNode)
                    nextNodes.push(targetNode);
            }
            if (nextNodes.length > 0) {
                await this.executeFromNodes(nextNodes, workflow, context);
            }
        }
    }
    async executeNode(node, inputs, context) {
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
        }
        catch (err) {
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
    gatherInputs(node, edges, context) {
        const inputs = {};
        const incomingEdges = edges.filter(e => e.target === node.id);
        for (const edge of incomingEdges) {
            const sourceOutput = context.variables[`${edge.source}.${edge.sourcePort}`];
            if (sourceOutput !== undefined) {
                inputs[edge.targetPort] = sourceOutput;
            }
        }
        return inputs;
    }
    gatherMergeInputs(node, context) {
        const allInputs = context.mergeInputs.get(node.id) ?? [];
        const merged = {};
        for (let i = 0; i < allInputs.length; i++) {
            for (const [key, value] of Object.entries(allInputs[i])) {
                merged[`branch_${i}_${key}`] = value;
            }
        }
        merged._branches = allInputs;
        return merged;
    }
    /** Build a nested sandbox from flat dotted keys, normalizing hyphens to underscores for valid JS identifiers */
    buildSandbox(variables) {
        const sandbox = {};
        for (const [key, value] of Object.entries(variables)) {
            const safeKey = key.replace(/-/g, '_');
            const parts = safeKey.split('.');
            if (parts.length === 1) {
                sandbox[parts[0]] = value;
            }
            else {
                let current = sandbox;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            }
        }
        return sandbox;
    }
    /** Normalize hyphens in identifier positions to underscores for valid JS */
    normalizeExpression(expression) {
        return expression.replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, '$1_$2');
    }
    evaluateCondition(condition, variables) {
        try {
            const sanitized = condition.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
            const normalized = this.normalizeExpression(sanitized);
            const sandbox = vm.createContext(Object.freeze(this.buildSandbox(variables)));
            const result = vm.runInContext(`!!(${normalized})`, sandbox, { timeout: 1000 });
            return !!result;
        }
        catch {
            return false;
        }
    }
    resolveTemplate(template, vars) {
        return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
            const keys = path.trim().split('.');
            // Greedy prefix match: try longest dotted key first (handles flat keys like "trigger-1.data")
            for (let i = keys.length; i >= 1; i--) {
                const prefix = keys.slice(0, i).join('.');
                if (prefix in vars) {
                    let value = vars[prefix];
                    // Traverse remaining nested path
                    for (let j = i; j < keys.length; j++) {
                        if (value == null || typeof value !== 'object')
                            return '';
                        value = value[keys[j]];
                    }
                    return value != null ? String(value) : '';
                }
            }
            return '';
        });
    }
    // ─── Built-in Node Handlers ─────────────────────────────
    registerBuiltinHandlers() {
        this.nodeHandlers.set('trigger', async (_node, _inputs, context) => {
            return { data: context.variables._trigger ?? {} };
        });
        this.nodeHandlers.set('llm-call', async (node, inputs, context) => {
            const prompt = this.resolveTemplate(node.data.config.prompt, context.variables);
            const systemPrompt = node.data.config.systemPrompt;
            const messages = [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt },
            ];
            const response = await context.llmAdapter.chat(messages);
            return { response: response.content, usage: response.usage };
        });
        this.nodeHandlers.set('tool-call', async (node, inputs, context) => {
            const toolName = node.data.config.toolName;
            const args = node.data.config.arguments ?? inputs;
            const resolvedArgs = {};
            for (const [key, value] of Object.entries(args)) {
                resolvedArgs[key] = typeof value === 'string'
                    ? this.resolveTemplate(value, context.variables) : value;
            }
            const call = { id: randomUUID(), name: toolName, arguments: resolvedArgs };
            const result = await context.toolRegistry.execute(call);
            return { result: result.result, success: result.success, error: result.error };
        });
        this.nodeHandlers.set('condition', async (node, inputs, context) => {
            const expression = node.data.config.expression;
            const result = this.evaluateCondition(expression, { ...context.variables, ...inputs });
            return { result, branch: result ? 'true' : 'false' };
        });
        this.nodeHandlers.set('switch', async (node, inputs, context) => {
            const expression = node.data.config.expression ?? '';
            const cases = node.data.config.cases ?? [];
            let matchValue;
            try {
                const sanitized = expression.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
                const normalized = this.normalizeExpression(sanitized);
                const sandbox = vm.createContext(Object.freeze(this.buildSandbox({ ...context.variables, ...inputs })));
                matchValue = vm.runInContext(`(${normalized})`, sandbox, { timeout: 1000 });
            }
            catch {
                matchValue = this.resolveTemplate(expression, context.variables);
            }
            let matchedCase = 'default';
            for (const c of cases) {
                if (String(matchValue) === c.value) {
                    matchedCase = c.value;
                    break;
                }
            }
            return { value: matchValue, matchedCase, branch: matchedCase };
        });
        this.nodeHandlers.set('loop', async (node, inputs, context) => {
            const maxIterations = node.data.config.maxIterations ?? 10;
            const condition = node.data.config.condition ?? '';
            const loopVar = node.data.config.loopVariable ?? 'i';
            const items = node.data.config.items ?? inputs.items ?? null;
            const results = [];
            const iterations = items ? Math.min(items.length, maxIterations) : maxIterations;
            for (let i = 0; i < iterations; i++) {
                context.variables[`${node.id}.index`] = i;
                context.variables[`${node.id}.${loopVar}`] = items ? items[i] : i;
                context.variables[loopVar] = items ? items[i] : i;
                if (condition) {
                    const shouldContinue = this.evaluateCondition(condition, {
                        ...context.variables, ...inputs, index: i, [loopVar]: items ? items[i] : i,
                    });
                    if (!shouldContinue)
                        break;
                }
                results.push({ index: i, item: items ? items[i] : i });
            }
            return { iterations: results.length, results, completed: true };
        });
        this.nodeHandlers.set('merge', async (_node, inputs) => {
            return { merged: true, ...inputs };
        });
        this.nodeHandlers.set('sub-workflow', async (node, inputs, context) => {
            const subWorkflowId = node.data.config.workflowId;
            if (!subWorkflowId)
                return { error: 'No sub-workflow ID configured', success: false };
            await context.eventBus.emit({
                type: 'workflow:sub-workflow:requested',
                payload: { subWorkflowId, inputs, parentExecutionId: context.execution.id },
                source: 'workflow-engine',
                timestamp: new Date().toISOString(),
            });
            return { subWorkflowId, delegated: true, inputs };
        });
        this.nodeHandlers.set('http-request', async (node, _inputs, context) => {
            const url = this.resolveTemplate(node.data.config.url, context.variables);
            const method = node.data.config.method ?? 'GET';
            const headers = node.data.config.headers ?? {};
            const body = node.data.config.body;
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', ...headers },
                body: body ? this.resolveTemplate(body, context.variables) : undefined,
            });
            const responseText = await res.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            }
            catch {
                responseData = responseText;
            }
            return { status: res.status, data: responseData, ok: res.ok };
        });
        this.nodeHandlers.set('transform', async (node, inputs, context) => {
            const template = node.data.config.template;
            if (template) {
                const result = this.resolveTemplate(template, { ...context.variables, ...inputs });
                return { result };
            }
            return inputs;
        });
        this.nodeHandlers.set('code', async (node, inputs, context) => {
            const code = node.data.config.code;
            const timeoutMs = this.sandboxConfig?.timeoutMs ?? 5000;
            const sandbox = vm.createContext({
                inputs: Object.freeze({ ...inputs }),
                variables: Object.freeze({ ...context.variables }),
                JSON, Math, Date, Array, Object, String, Number, Boolean,
                parseInt, parseFloat, isNaN, isFinite,
                console: { log: () => { }, warn: () => { }, error: () => { } },
            });
            const wrappedCode = `(async function() { "use strict"; ${code} })()`;
            const result = await vm.runInContext(wrappedCode, sandbox, { timeout: timeoutMs });
            return { result };
        });
        this.nodeHandlers.set('wait', async (node) => {
            const ms = (node.data.config.seconds ?? 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, ms));
            return { waited: ms };
        });
        this.nodeHandlers.set('notification', async (node, _inputs, context) => {
            const message = this.resolveTemplate(node.data.config.message, context.variables);
            const channel = node.data.config.channel ?? 'default';
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
            const query = this.resolveTemplate(node.data.config.query, context.variables);
            return { query, note: 'Memory operations delegated to agent' };
        });
        this.nodeHandlers.set('memory-write', async (node, inputs, context) => {
            const content = this.resolveTemplate(node.data.config.content, { ...context.variables, ...inputs });
            return { content, note: 'Memory operations delegated to agent' };
        });
    }
}
//# sourceMappingURL=workflow-engine.js.map