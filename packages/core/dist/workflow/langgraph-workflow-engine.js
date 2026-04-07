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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { Annotation, END, MemorySaver, START, StateGraph, } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { validateWorkflow } from './workflow-engine.js';
// ─── LangGraph State Annotation ────────────────────────────
/** Shared state that flows through every node in the graph */
const WorkflowState = Annotation.Root({
    /** Accumulated variables (flat key→value) */
    variables: Annotation({
        reducer: (_prev, next) => next,
        default: () => ({}),
    }),
    /** Per-node execution results */
    nodeResults: Annotation({
        reducer: (prev, next) => (Object.assign(Object.assign({}, prev), next)),
        default: () => ({}),
    }),
    /** Current execution status */
    status: Annotation({
        reducer: (_prev, next) => next,
        default: () => 'running',
    }),
    /** Error message if failed */
    error: Annotation({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
    /** Merge synchronization counters: nodeId → arrived count */
    mergeArrived: Annotation({
        reducer: (_prev, next) => next,
        default: () => ({}),
    }),
    /** Merge input accumulator: nodeId → inputs[] */
    mergeInputs: Annotation({
        reducer: (_prev, next) => next,
        default: () => ({}),
    }),
});
// ─── LangGraph Workflow Engine ──────────────────────────────
export class LangGraphWorkflowEngine {
    constructor(toolRegistry, llmRouter, eventBus) {
        this.toolRegistry = toolRegistry;
        this.llmRouter = llmRouter;
        this.eventBus = eventBus;
        this.nodeHandlers = new Map();
        this.checkpointer = new MemorySaver();
        this.registerBuiltinHandlers();
    }
    setSandboxConfig(config) {
        this.sandboxConfig = config;
    }
    validate(workflow) {
        return validateWorkflow(workflow);
    }
    registerNodeHandler(type, handler) {
        this.nodeHandlers.set(type, handler);
    }
    // ─── Main Execute ───────────────────────────────────────
    async execute(workflow, triggerData) {
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
            const initialVars = Object.assign(Object.assign({}, Object.fromEntries((Array.isArray(workflow.variables) ? workflow.variables : [])
                .map(v => [v.name, v.defaultValue]))), { _trigger: triggerData !== null && triggerData !== void 0 ? triggerData : {} });
            // Pre-compute merge node expected counts
            const mergeArrived = {};
            const mergeInputs = {};
            for (const node of workflow.nodes) {
                if (node.type === 'merge') {
                    const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
                    mergeArrived[node.id] = incomingCount;
                    mergeInputs[node.id] = [];
                }
            }
            const result = await graph.invoke({
                variables: initialVars,
                nodeResults: {},
                status: 'running',
                error: undefined,
                mergeArrived,
                mergeInputs,
            }, {
                configurable: { thread_id: executionId },
                recursionLimit: 100,
            });
            const finalState = result;
            const execution = {
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
                timestamp: execution.completedAt,
            });
            return execution;
        }
        catch (err) {
            const execution = {
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
                timestamp: execution.completedAt,
            });
            return execution;
        }
    }
    // ─── Stream Execute (LangGraph bonus) ───────────────────
    executeStream(workflow, triggerData) {
        return __asyncGenerator(this, arguments, function* executeStream_1() {
            var _a, e_1, _b, _c;
            const executionId = randomUUID();
            const graph = this.compileGraph(workflow);
            const initialVars = Object.assign(Object.assign({}, Object.fromEntries((Array.isArray(workflow.variables) ? workflow.variables : [])
                .map(v => [v.name, v.defaultValue]))), { _trigger: triggerData !== null && triggerData !== void 0 ? triggerData : {} });
            const mergeArrived = {};
            const mergeInputs = {};
            for (const node of workflow.nodes) {
                if (node.type === 'merge') {
                    mergeArrived[node.id] = workflow.edges.filter(e => e.target === node.id).length;
                    mergeInputs[node.id] = [];
                }
            }
            const stream = yield __await(graph.stream({
                variables: initialVars,
                nodeResults: {},
                status: 'running',
                error: undefined,
                mergeArrived,
                mergeInputs,
            }, {
                configurable: { thread_id: executionId },
                recursionLimit: 100,
                streamMode: 'updates',
            }));
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    yield yield __await({ event: 'node-update', data: chunk });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
            yield yield __await({ event: 'done', data: { executionId } });
        });
    }
    // ─── Graph Compilation ──────────────────────────────────
    compileGraph(workflow) {
        var _a;
        const builder = new StateGraph(WorkflowState);
        const deps = {
            toolRegistry: this.toolRegistry,
            llmAdapter: this.llmRouter.getAdapter(),
            eventBus: this.eventBus,
            sandboxConfig: this.sandboxConfig,
        };
        // Map of nodeId → node for quick lookups
        const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
        // Outgoing edges per node
        const outgoing = new Map();
        for (const edge of workflow.edges) {
            if (!outgoing.has(edge.source))
                outgoing.set(edge.source, []);
            outgoing.get(edge.source).push(edge);
        }
        // Incoming edges per node
        const incoming = new Map();
        for (const edge of workflow.edges) {
            if (!incoming.has(edge.target))
                incoming.set(edge.target, []);
            incoming.get(edge.target).push(edge);
        }
        // Register each workflow node as a LangGraph node
        for (const node of workflow.nodes) {
            const nodeId = this.sanitizeNodeId(node.id);
            builder.addNode(nodeId, async (state) => {
                var _a, _b;
                // Bail if already failed
                if (state.status === 'failed') {
                    return { status: 'failed' };
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
                    const newMergeInputs = Object.assign({}, state.mergeInputs);
                    const newMergeArrived = Object.assign({}, state.mergeArrived);
                    const arrived = [...((_a = newMergeInputs[node.id]) !== null && _a !== void 0 ? _a : []), inputs];
                    newMergeInputs[node.id] = arrived;
                    const expected = (_b = newMergeArrived[node.id]) !== null && _b !== void 0 ? _b : 2;
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
        builder.addEdge(START, this.sanitizeNodeId(triggerNodes[0].id));
        // Wire up edges between nodes
        for (const node of workflow.nodes) {
            const nodeId = this.sanitizeNodeId(node.id);
            const edges = (_a = outgoing.get(node.id)) !== null && _a !== void 0 ? _a : [];
            if (edges.length === 0) {
                // Terminal node → END
                builder.addEdge(nodeId, END);
                continue;
            }
            // Condition/switch nodes or edges with conditions → conditional edges
            const hasConditionalEdges = edges.some(e => e.condition) ||
                node.type === 'condition' || node.type === 'switch';
            if (hasConditionalEdges || edges.length > 1) {
                // Use conditional routing
                const targetNodeIds = edges.map(e => this.sanitizeNodeId(e.target));
                const routeMap = {};
                for (const edge of edges) {
                    const targetId = this.sanitizeNodeId(edge.target);
                    const routeKey = edge.condition || edge.sourcePort || targetId;
                    routeMap[routeKey] = targetId;
                }
                builder.addConditionalEdges(nodeId, (state) => {
                    var _a, _b, _c, _d;
                    if (state.status === 'failed')
                        return END;
                    const lastResult = state.nodeResults[node.id];
                    if (node.type === 'condition') {
                        const branch = (_a = lastResult === null || lastResult === void 0 ? void 0 : lastResult.output) === null || _a === void 0 ? void 0 : _a.branch;
                        // Find edge matching true/false branch
                        for (const edge of edges) {
                            if (edge.condition === branch || edge.sourcePort === branch) {
                                return this.sanitizeNodeId(edge.target);
                            }
                        }
                        // Default: first edge
                        return (_b = targetNodeIds[0]) !== null && _b !== void 0 ? _b : END;
                    }
                    if (node.type === 'switch') {
                        const matchedCase = (_c = lastResult === null || lastResult === void 0 ? void 0 : lastResult.output) === null || _c === void 0 ? void 0 : _c.matchedCase;
                        for (const edge of edges) {
                            if (edge.condition === matchedCase || edge.sourcePort === matchedCase) {
                                return this.sanitizeNodeId(edge.target);
                            }
                        }
                        // Default case
                        const defaultEdge = edges.find(e => e.condition === 'default' || e.sourcePort === 'default');
                        if (defaultEdge)
                            return this.sanitizeNodeId(defaultEdge.target);
                        return (_d = targetNodeIds[0]) !== null && _d !== void 0 ? _d : END;
                    }
                    // Generic conditional edges
                    for (const edge of edges) {
                        if (edge.condition) {
                            const met = this.evaluateCondition(edge.condition, state.variables);
                            if (met)
                                return this.sanitizeNodeId(edge.target);
                        }
                    }
                    // Fallback: follow all unconditional edges (first one for deterministic routing)
                    const unconditional = edges.filter(e => !e.condition);
                    if (unconditional.length > 0) {
                        return unconditional.map(e => this.sanitizeNodeId(e.target));
                    }
                    return END;
                }, [...targetNodeIds, END]);
            }
            else {
                // Single unconditional edge
                builder.addEdge(nodeId, this.sanitizeNodeId(edges[0].target));
            }
        }
        return builder.compile({ checkpointer: this.checkpointer });
    }
    // ─── Node Execution ─────────────────────────────────────
    async runNodeHandler(node, inputs, state, deps, startedAt) {
        const handler = this.nodeHandlers.get(node.type);
        if (!handler) {
            const result = {
                nodeId: node.id, status: 'failed', startedAt,
                completedAt: new Date().toISOString(),
                input: inputs, output: {},
                error: `No handler for node type: ${node.type}`, duration: 0,
            };
            await this.eventBus.emit({
                type: 'workflow:node:failed',
                payload: { nodeId: node.id, nodeType: node.type, error: result.error },
                source: 'workflow-engine',
                timestamp: result.completedAt,
            });
            return {
                nodeResults: { [node.id]: result },
                status: 'failed',
                error: result.error,
            };
        }
        const start = Date.now();
        try {
            const output = await handler(node, inputs, state.variables, deps);
            const duration = Date.now() - start;
            const result = {
                nodeId: node.id, status: 'completed', startedAt,
                completedAt: new Date().toISOString(),
                input: inputs, output, duration,
            };
            // Update variables with node outputs
            const newVars = Object.assign({}, state.variables);
            for (const [key, value] of Object.entries(output)) {
                newVars[`${node.id}.${key}`] = value;
            }
            await this.eventBus.emit({
                type: 'workflow:node:completed',
                payload: { nodeId: node.id, nodeType: node.type, duration, output },
                source: 'workflow-engine',
                timestamp: result.completedAt,
            });
            return {
                variables: newVars,
                nodeResults: { [node.id]: result },
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            await this.eventBus.emit({
                type: 'workflow:node:failed',
                payload: { nodeId: node.id, nodeType: node.type, error: errorMsg },
                source: 'workflow-engine',
                timestamp: new Date().toISOString(),
            });
            const result = {
                nodeId: node.id, status: 'failed', startedAt,
                completedAt: new Date().toISOString(),
                input: inputs, output: {},
                error: errorMsg,
                duration: Date.now() - start,
            };
            return {
                nodeResults: { [node.id]: result },
                status: 'failed',
                error: `Node ${node.id} (${node.data.label}) failed: ${errorMsg}`,
            };
        }
    }
    // ─── Input Gathering ────────────────────────────────────
    gatherInputs(node, edges, variables) {
        const inputs = {};
        const incomingEdges = edges.filter(e => e.target === node.id);
        for (const edge of incomingEdges) {
            const sourceOutput = variables[`${edge.source}.${edge.sourcePort}`];
            if (sourceOutput !== undefined) {
                inputs[edge.targetPort] = sourceOutput;
            }
        }
        return inputs;
    }
    gatherMergeInputs(_node, allInputs) {
        const merged = {};
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
    sanitizeNodeId(id) {
        return id.replace(/-/g, '_');
    }
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
        catch (_a) {
            return false;
        }
    }
    resolveTemplate(template, vars) {
        return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
            const keys = path.trim().split('.');
            for (let i = keys.length; i >= 1; i--) {
                const prefix = keys.slice(0, i).join('.');
                if (prefix in vars) {
                    let value = vars[prefix];
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
        this.nodeHandlers.set('trigger', async (_node, _inputs, vars) => {
            var _a;
            return { data: (_a = vars._trigger) !== null && _a !== void 0 ? _a : {} };
        });
        this.nodeHandlers.set('llm-call', async (node, _inputs, vars, deps) => {
            const prompt = this.resolveTemplate(node.data.config.prompt, vars);
            const systemPrompt = node.data.config.systemPrompt;
            const messages = [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt },
            ];
            const response = await deps.llmAdapter.chat(messages);
            return { response: response.content, usage: response.usage };
        });
        this.nodeHandlers.set('tool-call', async (node, inputs, vars, deps) => {
            var _a;
            const toolName = node.data.config.toolName;
            const args = (_a = node.data.config.arguments) !== null && _a !== void 0 ? _a : inputs;
            const resolvedArgs = {};
            for (const [key, value] of Object.entries(args)) {
                resolvedArgs[key] = typeof value === 'string'
                    ? this.resolveTemplate(value, vars) : value;
            }
            const call = { id: randomUUID(), name: toolName, arguments: resolvedArgs };
            const result = await deps.toolRegistry.execute(call);
            return { result: result.result, success: result.success, error: result.error };
        });
        this.nodeHandlers.set('condition', async (node, inputs, vars) => {
            const expression = node.data.config.expression;
            const result = this.evaluateCondition(expression, Object.assign(Object.assign({}, vars), inputs));
            return { result, branch: result ? 'true' : 'false' };
        });
        this.nodeHandlers.set('switch', async (node, inputs, vars) => {
            var _a, _b;
            const expression = (_a = node.data.config.expression) !== null && _a !== void 0 ? _a : '';
            const cases = (_b = node.data.config.cases) !== null && _b !== void 0 ? _b : [];
            let matchValue;
            try {
                const sanitized = expression.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
                const normalized = this.normalizeExpression(sanitized);
                const sandbox = vm.createContext(Object.freeze(this.buildSandbox(Object.assign(Object.assign({}, vars), inputs))));
                matchValue = vm.runInContext(`(${normalized})`, sandbox, { timeout: 1000 });
            }
            catch (_c) {
                matchValue = this.resolveTemplate(expression, vars);
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
        this.nodeHandlers.set('loop', async (node, inputs, vars) => {
            var _a, _b, _c, _d, _e;
            const maxIterations = (_a = node.data.config.maxIterations) !== null && _a !== void 0 ? _a : 10;
            const condition = (_b = node.data.config.condition) !== null && _b !== void 0 ? _b : '';
            const loopVar = (_c = node.data.config.loopVariable) !== null && _c !== void 0 ? _c : 'i';
            const items = (_e = (_d = node.data.config.items) !== null && _d !== void 0 ? _d : inputs.items) !== null && _e !== void 0 ? _e : null;
            const results = [];
            const iterations = items ? Math.min(items.length, maxIterations) : maxIterations;
            for (let i = 0; i < iterations; i++) {
                vars[`${node.id}.index`] = i;
                vars[`${node.id}.${loopVar}`] = items ? items[i] : i;
                vars[loopVar] = items ? items[i] : i;
                if (condition) {
                    const shouldContinue = this.evaluateCondition(condition, Object.assign(Object.assign(Object.assign({}, vars), inputs), { index: i, [loopVar]: items ? items[i] : i }));
                    if (!shouldContinue)
                        break;
                }
                results.push({ index: i, item: items ? items[i] : i });
            }
            return { iterations: results.length, results, completed: true };
        });
        this.nodeHandlers.set('merge', async (_node, inputs) => {
            return Object.assign({ merged: true }, inputs);
        });
        this.nodeHandlers.set('sub-workflow', async (node, inputs, _vars, deps) => {
            const subWorkflowId = node.data.config.workflowId;
            if (!subWorkflowId)
                return { error: 'No sub-workflow ID configured', success: false };
            await deps.eventBus.emit({
                type: 'workflow:sub-workflow:requested',
                payload: { subWorkflowId, inputs },
                source: 'workflow-engine',
                timestamp: new Date().toISOString(),
            });
            return { subWorkflowId, delegated: true, inputs };
        });
        this.nodeHandlers.set('http-request', async (node, _inputs, vars) => {
            var _a, _b;
            const url = this.resolveTemplate(node.data.config.url, vars);
            const method = (_a = node.data.config.method) !== null && _a !== void 0 ? _a : 'GET';
            const headers = (_b = node.data.config.headers) !== null && _b !== void 0 ? _b : {};
            const body = node.data.config.body;
            const res = await fetch(url, {
                method,
                headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                body: body ? this.resolveTemplate(body, vars) : undefined,
            });
            const responseText = await res.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            }
            catch (_c) {
                responseData = responseText;
            }
            return { status: res.status, data: responseData, ok: res.ok };
        });
        this.nodeHandlers.set('transform', async (node, inputs, vars) => {
            const template = node.data.config.template;
            if (template) {
                const result = this.resolveTemplate(template, Object.assign(Object.assign({}, vars), inputs));
                return { result };
            }
            return inputs;
        });
        this.nodeHandlers.set('code', async (node, inputs, vars, deps) => {
            var _a, _b;
            const code = node.data.config.code;
            const timeoutMs = (_b = (_a = deps.sandboxConfig) === null || _a === void 0 ? void 0 : _a.timeoutMs) !== null && _b !== void 0 ? _b : 5000;
            const sandbox = vm.createContext({
                inputs: Object.freeze(Object.assign({}, inputs)),
                variables: Object.freeze(Object.assign({}, vars)),
                JSON, Math, Date, Array, Object, String, Number, Boolean,
                parseInt, parseFloat, isNaN, isFinite,
                console: { log: () => { }, warn: () => { }, error: () => { } },
            });
            const wrappedCode = `(async function() { "use strict"; ${code} })()`;
            const result = await vm.runInContext(wrappedCode, sandbox, { timeout: timeoutMs });
            return { result };
        });
        this.nodeHandlers.set('wait', async (node) => {
            var _a;
            const ms = ((_a = node.data.config.seconds) !== null && _a !== void 0 ? _a : 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, ms));
            return { waited: ms };
        });
        this.nodeHandlers.set('notification', async (node, _inputs, vars, deps) => {
            var _a;
            const message = this.resolveTemplate(node.data.config.message, vars);
            const channel = (_a = node.data.config.channel) !== null && _a !== void 0 ? _a : 'default';
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
            const query = this.resolveTemplate(node.data.config.query, vars);
            return { query, note: 'Memory operations delegated to agent' };
        });
        this.nodeHandlers.set('memory-write', async (node, inputs, vars) => {
            const content = this.resolveTemplate(node.data.config.content, Object.assign(Object.assign({}, vars), inputs));
            return { content, note: 'Memory operations delegated to agent' };
        });
    }
}
