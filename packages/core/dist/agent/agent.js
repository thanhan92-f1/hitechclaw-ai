import { randomUUID } from 'node:crypto';
import { LLMRouter } from '../llm/llm-router.js';
import { ConversationSummarizer } from '../memory/conversation-summarizer.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Tracer } from '../tracing/tracer.js';
import { EventBus } from './event-bus.js';
/** Default context window size when not specified (conservative estimate) */
const DEFAULT_CONTEXT_WINDOW = 128_000;
/** Default fraction of context at which auto-compact triggers */
const DEFAULT_COMPACT_THRESHOLD = 0.8;
export class Agent {
    config;
    events;
    llm;
    memory;
    tools;
    tracer;
    sandboxConfig;
    transferHandler;
    summarizer;
    /** Per-session token accumulator for auto-compact tracking */
    sessionTokens = new Map();
    /** Token budget config (defaults to conservative 128k window) */
    tokenBudget;
    constructor(config) {
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
        this.tokenBudget = { ...this.tokenBudget, ...budget };
    }
    /**
     * Check if auto-compact should trigger for a session.
     * Returns true when accumulated tokens have crossed the threshold.
     */
    shouldCompact(sessionId) {
        const used = this.sessionTokens.get(sessionId) ?? 0;
        return used / this.tokenBudget.contextWindow >= this.tokenBudget.compactThreshold;
    }
    /**
     * Accumulate token usage for a session and emit a compact event if needed.
     */
    trackTokens(sessionId, usage) {
        const prev = this.sessionTokens.get(sessionId) ?? 0;
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
            ...(additionalTools?.map((t) => t.definition) ?? []),
        ];
        // Tool-calling loop
        let response;
        let iterations = 0;
        while (iterations < this.config.maxToolIterations) {
            iterations++;
            response = await this.llm.chat(messages, allToolDefs, llmOptions);
            // Track token usage for auto-compact budget
            this.trackTokens(sessionId, response.usage);
            if (!response.toolCalls?.length) {
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
    async *chatStream(sessionId, userMessage, ragContext, images, additionalTools, llmOptions) {
        const span = this.tracer.startSpan('agent:chatStream', 'agent');
        await this.memory.addMessage(sessionId, {
            id: randomUUID(),
            sessionId,
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
        });
        await this.memory.loadHistory(sessionId, 20);
        const history = this.memory.getHistorySync(sessionId);
        let messages;
        if (this.shouldCompact(sessionId)) {
            messages = await this.summarizer.maybeSummarize(sessionId, history);
            this.resetTokens(sessionId);
            yield { type: 'meta', key: 'compact', data: { historyLength: history.length } };
        }
        else {
            messages = this.buildMessages(sessionId, userMessage, ragContext, images);
        }
        const allToolDefs = [
            ...this.tools.getDefinitions(),
            ...(additionalTools?.map((t) => t.definition) ?? []),
        ];
        let iterations = 0;
        while (iterations < this.config.maxToolIterations) {
            iterations++;
            const stream = this.llm.chatStream(messages, allToolDefs, llmOptions);
            let fullContent = '';
            const toolCalls = [];
            for await (const event of stream) {
                if (event.type === 'text-delta') {
                    fullContent += event.delta;
                    yield event;
                }
                else if (event.type === 'tool-call-start') {
                    toolCalls.push({ id: event.toolCallId, name: event.toolName, arguments: {} });
                    yield event;
                }
                else if (event.type === 'tool-call-args') {
                    yield event;
                }
                else if (event.type === 'tool-call-end') {
                    yield event;
                }
                else if (event.type === 'finish') {
                    // Track token usage from finish event
                    this.trackTokens(sessionId, event.usage);
                    if (toolCalls.length === 0) {
                        // Final response
                        await this.memory.addMessage(sessionId, {
                            id: randomUUID(),
                            sessionId,
                            role: 'assistant',
                            content: fullContent,
                            timestamp: new Date().toISOString(),
                        });
                        this.tracer.endSpan(span.id, { iterations });
                        yield event;
                        return;
                    }
                }
                else if (event.type === 'error') {
                    this.tracer.failSpan(span.id, event.error);
                    yield event;
                    return;
                }
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
                    yield { type: 'meta', key: 'agent-transfer', data: { targetAgent: transfer.targetAgentName, reason: transfer.reason } };
                    const transferResponse = await this.transferHandler(transfer, sessionId, userMessage);
                    yield { type: 'text-delta', delta: transferResponse };
                    yield { type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: 'transfer' };
                    this.tracer.endSpan(span.id, { iterations, transferred: true, target: transfer.targetAgentName });
                    return;
                }
                const results = await this.executeToolCalls(toolCalls, additionalTools);
                for (const result of results) {
                    yield { type: 'tool-result', toolCallId: result.toolCallId, result };
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
        yield { type: 'error', error: 'Max tool iterations reached' };
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
        if (images?.length) {
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
        const results = [];
        for (const call of toolCalls) {
            await this.events.emit({
                type: 'tool:started',
                payload: { name: call.name, arguments: call.arguments },
                source: this.config.id,
                timestamp: new Date().toISOString(),
            });
            // Check additional (per-request) tools first, fall back to shared registry
            const additionalTool = additionalTools?.find((t) => t.definition.name === call.name);
            let result;
            // Determine if this tool requires sandbox execution
            const definition = additionalTool?.definition ?? this.tools.getDefinition(call.name);
            const needsSandbox = this.sandboxConfig?.enabled && definition?.sandbox?.required;
            if (needsSandbox && this.sandboxConfig?.executor) {
                // Route through sandbox executor (OpenShell)
                const handler = additionalTool
                    ? additionalTool.handler
                    : (args) => this.tools.execute({ ...call, arguments: args }).then((r) => r.result);
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
//# sourceMappingURL=agent.js.map