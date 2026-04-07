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
import { randomUUID } from 'node:crypto';
import { LLMRouter } from '../llm/llm-router.js';
import { ConversationSummarizer } from '../memory/conversation-summarizer.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Tracer } from '../tracing/tracer.js';
import { EventBus } from './event-bus.js';
/** Default context window size when not specified (conservative estimate) */
const DEFAULT_CONTEXT_WINDOW = 128000;
/** Default fraction of context at which auto-compact triggers */
const DEFAULT_COMPACT_THRESHOLD = 0.8;
export class Agent {
    constructor(config) {
        /** Per-session token accumulator for auto-compact tracking */
        this.sessionTokens = new Map();
        this.config = config;
        this.events = new EventBus();
        this.llm = new LLMRouter(config.llm);
        this.memory = new MemoryManager();
        this.tools = new ToolRegistry();
        this.tracer = new Tracer();
        this.summarizer = new ConversationSummarizer(this.llm);
        this.tokenBudget = {
            contextWindow: DEFAULT_CONTEXT_WINDOW,
            compactThreshold: DEFAULT_COMPACT_THRESHOLD,
            usedTokens: 0,
        };
    }
    /**
     * Configure the token budget for this agent.
     * Call this after instantiation when you know the model's context window.
     */
    configureTokenBudget(budget) {
        this.tokenBudget = Object.assign(Object.assign({}, this.tokenBudget), budget);
    }
    /**
     * Check if auto-compact should trigger for a session.
     * Returns true when accumulated tokens have crossed the threshold.
     */
    shouldCompact(sessionId) {
        var _a;
        const used = (_a = this.sessionTokens.get(sessionId)) !== null && _a !== void 0 ? _a : 0;
        return used / this.tokenBudget.contextWindow >= this.tokenBudget.compactThreshold;
    }
    /**
     * Accumulate token usage for a session and emit a compact event if needed.
     */
    trackTokens(sessionId, usage) {
        var _a;
        const prev = (_a = this.sessionTokens.get(sessionId)) !== null && _a !== void 0 ? _a : 0;
        this.sessionTokens.set(sessionId, prev + usage.totalTokens);
    }
    /**
     * Reset token counter for a session (called after successful compact).
     */
    resetTokens(sessionId) {
        this.sessionTokens.set(sessionId, 0);
    }
    /**
     * Configure sandbox execution for this agent.
     * When enabled, tools with sandbox requirements will be routed
     * through the OpenShell sandbox executor.
     */
    configureSandbox(sandboxConfig) {
        this.sandboxConfig = sandboxConfig;
    }
    /**
     * Set a handler for agent transfer requests (Google ADK-inspired delegation).
     * When the LLM calls `transfer_to_agent`, this handler is invoked.
     */
    onTransfer(handler) {
        this.transferHandler = handler;
    }
    /**
     * Chat with the agent (non-streaming). Returns full response.
     * Pass `additionalTools` to inject per-request tools (e.g. domain skill tools) without mutating shared state.
     * Pass `llmOptions` to override provider/model for this call (e.g. force vision model).
     */
    async chat(sessionId, userMessage, ragContext, images, additionalTools, llmOptions) {
        var _a, _b;
        const span = this.tracer.startSpan('agent:chat', 'agent');
        // Save user message to history
        await this.memory.addMessage(sessionId, {
            id: randomUUID(),
            sessionId,
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
        });
        // Build messages — auto-compact if token budget exceeded
        const history = await this.memory.loadHistory(sessionId, 20);
        let messages;
        if (this.shouldCompact(sessionId)) {
            messages = await this.summarizer.maybeSummarize(sessionId, history);
            this.resetTokens(sessionId);
            await this.events.emit({
                type: 'agent:compact',
                payload: { sessionId, historyLength: history.length },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
        }
        else {
            messages = this.buildMessages(sessionId, userMessage, ragContext, images);
        }
        // Merge registered tools + per-request additional tools
        const allToolDefs = [
            ...this.tools.getDefinitions(),
            ...((_a = additionalTools === null || additionalTools === void 0 ? void 0 : additionalTools.map((t) => t.definition)) !== null && _a !== void 0 ? _a : []),
        ];
        // Tool-calling loop
        let response;
        let iterations = 0;
        while (iterations < this.config.maxToolIterations) {
            iterations++;
            response = await this.llm.chat(messages, allToolDefs, llmOptions);
            // Track token usage for auto-compact budget
            this.trackTokens(sessionId, response.usage);
            if (!((_b = response.toolCalls) === null || _b === void 0 ? void 0 : _b.length)) {
                // No tool calls — we have the final answer
                await this.memory.addMessage(sessionId, {
                    id: randomUUID(),
                    sessionId,
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date().toISOString(),
                });
                this.tracer.endSpan(span.id, { iterations, usage: response.usage });
                await this.events.emit({
                    type: 'agent:response',
                    payload: { sessionId, content: response.content, usage: response.usage },
                    source: this.config.id,
                    timestamp: new Date().toISOString(),
                });
                return response.content;
            }
            // Check for transfer_to_agent tool call (Google ADK-inspired delegation)
            const transferCall = response.toolCalls.find((tc) => tc.name === 'transfer_to_agent');
            if (transferCall && this.transferHandler) {
                const transfer = {
                    targetAgentName: transferCall.arguments.agent_name,
                    reason: transferCall.arguments.reason,
                    context: transferCall.arguments.context,
                };
                await this.events.emit({
                    type: 'agent:transfer',
                    payload: { sessionId, targetAgent: transfer.targetAgentName, reason: transfer.reason },
                    source: this.config.id,
                    timestamp: new Date().toISOString(),
                });
                const transferResponse = await this.transferHandler(transfer, sessionId, userMessage);
                await this.memory.addMessage(sessionId, {
                    id: randomUUID(),
                    sessionId,
                    role: 'assistant',
                    content: transferResponse,
                    timestamp: new Date().toISOString(),
                    metadata: { transferredTo: transfer.targetAgentName },
                });
                this.tracer.endSpan(span.id, { iterations, transferred: true, target: transfer.targetAgentName });
                return transferResponse;
            }
            // Execute tool calls (additional tools take priority over registry)
            const toolResults = await this.executeToolCalls(response.toolCalls, additionalTools);
            // Add assistant message with tool calls + results to context
            messages.push({
                role: 'assistant',
                content: response.content || '',
                toolCalls: response.toolCalls,
            });
            for (const result of toolResults) {
                messages.push({
                    role: 'tool',
                    content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
                    toolCallId: result.toolCallId,
                });
            }
        }
        // Max iterations reached
        this.tracer.endSpan(span.id, { iterations, maxReached: true });
        return 'I reached the maximum number of tool iterations. Here is what I have so far.';
    }
    /**
     * Stream chat response via async generator.
     * Pass `additionalTools` to inject per-request tools (e.g. domain skill tools) without mutating shared state.
     * Pass `llmOptions` to override provider/model for this call (e.g. force vision model).
     */
    chatStream(sessionId, userMessage, ragContext, images, additionalTools, llmOptions) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            var _a, e_1, _b, _c;
            var _d;
            const span = this.tracer.startSpan('agent:chatStream', 'agent');
            yield __await(this.memory.addMessage(sessionId, {
                id: randomUUID(),
                sessionId,
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString(),
            }));
            yield __await(this.memory.loadHistory(sessionId, 20));
            const history = this.memory.getHistorySync(sessionId);
            let messages;
            if (this.shouldCompact(sessionId)) {
                messages = yield __await(this.summarizer.maybeSummarize(sessionId, history));
                this.resetTokens(sessionId);
                yield yield __await({ type: 'meta', key: 'compact', data: { historyLength: history.length } });
            }
            else {
                messages = this.buildMessages(sessionId, userMessage, ragContext, images);
            }
            const allToolDefs = [
                ...this.tools.getDefinitions(),
                ...((_d = additionalTools === null || additionalTools === void 0 ? void 0 : additionalTools.map((t) => t.definition)) !== null && _d !== void 0 ? _d : []),
            ];
            let iterations = 0;
            while (iterations < this.config.maxToolIterations) {
                iterations++;
                const stream = this.llm.chatStream(messages, allToolDefs, llmOptions);
                let fullContent = '';
                const toolCalls = [];
                try {
                    for (var _e = true, stream_1 = (e_1 = void 0, __asyncValues(stream)), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _e = true) {
                        _c = stream_1_1.value;
                        _e = false;
                        const event = _c;
                        if (event.type === 'text-delta') {
                            fullContent += event.delta;
                            yield yield __await(event);
                        }
                        else if (event.type === 'tool-call-start') {
                            toolCalls.push({ id: event.toolCallId, name: event.toolName, arguments: {} });
                            yield yield __await(event);
                        }
                        else if (event.type === 'tool-call-args') {
                            yield yield __await(event);
                        }
                        else if (event.type === 'tool-call-end') {
                            yield yield __await(event);
                        }
                        else if (event.type === 'finish') {
                            // Track token usage from finish event
                            this.trackTokens(sessionId, event.usage);
                            if (toolCalls.length === 0) {
                                // Final response
                                yield __await(this.memory.addMessage(sessionId, {
                                    id: randomUUID(),
                                    sessionId,
                                    role: 'assistant',
                                    content: fullContent,
                                    timestamp: new Date().toISOString(),
                                }));
                                this.tracer.endSpan(span.id, { iterations });
                                yield yield __await(event);
                                return yield __await(void 0);
                            }
                        }
                        else if (event.type === 'error') {
                            this.tracer.failSpan(span.id, event.error);
                            yield yield __await(event);
                            return yield __await(void 0);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_e && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                // Execute tool calls if any
                if (toolCalls.length > 0) {
                    // Check for transfer_to_agent in streaming mode
                    const transferCall = toolCalls.find((tc) => tc.name === 'transfer_to_agent');
                    if (transferCall && this.transferHandler) {
                        const transfer = {
                            targetAgentName: transferCall.arguments.agent_name,
                            reason: transferCall.arguments.reason,
                            context: transferCall.arguments.context,
                        };
                        yield yield __await({ type: 'meta', key: 'agent-transfer', data: { targetAgent: transfer.targetAgentName, reason: transfer.reason } });
                        const transferResponse = yield __await(this.transferHandler(transfer, sessionId, userMessage));
                        yield yield __await({ type: 'text-delta', delta: transferResponse });
                        yield yield __await({ type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: 'transfer' });
                        this.tracer.endSpan(span.id, { iterations, transferred: true, target: transfer.targetAgentName });
                        return yield __await(void 0);
                    }
                    const results = yield __await(this.executeToolCalls(toolCalls, additionalTools));
                    for (const result of results) {
                        yield yield __await({ type: 'tool-result', toolCallId: result.toolCallId, result });
                    }
                    // Feed results back
                    messages.push({
                        role: 'assistant',
                        content: fullContent,
                        toolCalls,
                    });
                    for (const result of results) {
                        messages.push({
                            role: 'tool',
                            content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
                            toolCallId: result.toolCallId,
                        });
                    }
                }
            }
            yield yield __await({ type: 'error', error: 'Max tool iterations reached' });
        });
    }
    buildMessages(sessionId, userMessage, ragContext, images) {
        const messages = [];
        // System prompt (augmented with RAG context if available)
        let systemPrompt = this.config.systemPrompt || this.config.persona;
        if (ragContext) {
            systemPrompt = `${systemPrompt}\n\n## Knowledge Base Context\nThe following information was retrieved from the knowledge base. Use it to answer accurately. Cite sources when possible.\n\n${ragContext}`;
        }
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        // Conversation history (from cache)
        const history = this.memory.getHistorySync(sessionId);
        for (const msg of history) {
            messages.push({
                role: msg.role,
                content: msg.content,
                toolCalls: msg.toolCalls,
            });
        }
        // Attach images to the last user message (current message) — don't rely on content matching
        if (images === null || images === void 0 ? void 0 : images.length) {
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    messages[i].images = images;
                    console.log(`[Agent] 🖼️ Attached ${images.length} image(s) to user message: "${messages[i].content.slice(0, 50)}"`);
                    break;
                }
            }
        }
        return messages;
    }
    async executeToolCalls(toolCalls, additionalTools) {
        var _a, _b, _c, _d;
        const results = [];
        for (const call of toolCalls) {
            await this.events.emit({
                type: 'tool:started',
                payload: { name: call.name, arguments: call.arguments },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
            // Check additional (per-request) tools first, fall back to shared registry
            const additionalTool = additionalTools === null || additionalTools === void 0 ? void 0 : additionalTools.find((t) => t.definition.name === call.name);
            let result;
            // Determine if this tool requires sandbox execution
            const definition = (_a = additionalTool === null || additionalTool === void 0 ? void 0 : additionalTool.definition) !== null && _a !== void 0 ? _a : this.tools.getDefinition(call.name);
            const needsSandbox = ((_b = this.sandboxConfig) === null || _b === void 0 ? void 0 : _b.enabled) && ((_c = definition === null || definition === void 0 ? void 0 : definition.sandbox) === null || _c === void 0 ? void 0 : _c.required);
            if (needsSandbox && ((_d = this.sandboxConfig) === null || _d === void 0 ? void 0 : _d.executor)) {
                // Route through sandbox executor (OpenShell)
                const handler = additionalTool
                    ? additionalTool.handler
                    : (args) => this.tools.execute(Object.assign(Object.assign({}, call), { arguments: args })).then((r) => r.result);
                result = await this.sandboxConfig.executor.execute(call, definition, handler, { tenantId: this.sandboxConfig.tenantId });
            }
            else if (additionalTool) {
                // Direct execution for non-sandboxed additional tools
                const start = Date.now();
                try {
                    const res = await additionalTool.handler(call.arguments);
                    result = { toolCallId: call.id, success: true, result: res, duration: Date.now() - start };
                }
                catch (err) {
                    result = { toolCallId: call.id, success: false, result: null, error: err instanceof Error ? err.message : String(err), duration: Date.now() - start };
                }
            }
            else {
                // Direct execution for registered tools
                result = await this.tools.execute(call);
            }
            results.push(result);
            await this.events.emit({
                type: result.success ? 'tool:completed' : 'tool:failed',
                payload: { name: call.name, result: result.result, duration: result.duration },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
        }
        return results;
    }
}
