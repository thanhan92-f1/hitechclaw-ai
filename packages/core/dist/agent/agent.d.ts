import type { AgentConfig, AgentTransferRequest, StreamEvent, TokenBudget, ToolCall, ToolDefinition, ToolResult } from '@hitechclaw/shared';
import type { ChatOptions } from '../llm/llm-router.js';
import { LLMRouter } from '../llm/llm-router.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Tracer } from '../tracing/tracer.js';
import { EventBus } from './event-bus.js';
/** In-request tool: a tool definition + its handler, passed directly to chat/chatStream */
export interface AdditionalTool {
    definition: ToolDefinition;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
}
/** Sandbox executor interface — decoupled from @hitechclaw/sandbox to avoid circular deps */
export interface SandboxToolExecutor {
    execute(call: ToolCall, definition: ToolDefinition, handler: (args: Record<string, unknown>) => Promise<unknown>, options: {
        tenantId: string;
    }): Promise<ToolResult>;
}
/** Configuration for the Agent's sandbox integration */
export interface AgentSandboxConfig {
    /** Sandbox executor instance */
    executor: SandboxToolExecutor;
    /** Tenant ID for sandbox scoping */
    tenantId: string;
    /** Whether sandbox is enabled */
    enabled: boolean;
}
/** Callback invoked when the LLM decides to transfer to another agent (Google ADK-inspired) */
export type TransferHandler = (transfer: AgentTransferRequest, sessionId: string, originalMessage: string) => Promise<string>;
export declare class Agent {
    readonly config: AgentConfig;
    readonly events: EventBus;
    readonly llm: LLMRouter;
    readonly memory: MemoryManager;
    readonly tools: ToolRegistry;
    readonly tracer: Tracer;
    private sandboxConfig?;
    private transferHandler?;
    private summarizer;
    /** Per-session token accumulator for auto-compact tracking */
    private sessionTokens;
    /** Token budget config (defaults to conservative 128k window) */
    private tokenBudget;
    constructor(config: AgentConfig);
    /**
     * Configure the token budget for this agent.
     * Call this after instantiation when you know the model's context window.
     */
    configureTokenBudget(budget: Partial<TokenBudget>): void;
    /**
     * Check if auto-compact should trigger for a session.
     * Returns true when accumulated tokens have crossed the threshold.
     */
    private shouldCompact;
    /**
     * Accumulate token usage for a session and emit a compact event if needed.
     */
    private trackTokens;
    /**
     * Reset token counter for a session (called after successful compact).
     */
    private resetTokens;
    /**
     * Configure sandbox execution for this agent.
     * When enabled, tools with sandbox requirements will be routed
     * through the OpenShell sandbox executor.
     */
    configureSandbox(sandboxConfig: AgentSandboxConfig): void;
    /**
     * Set a handler for agent transfer requests (Google ADK-inspired delegation).
     * When the LLM calls `transfer_to_agent`, this handler is invoked.
     */
    onTransfer(handler: TransferHandler): void;
    /**
     * Chat with the agent (non-streaming). Returns full response.
     * Pass `additionalTools` to inject per-request tools (e.g. domain skill tools) without mutating shared state.
     * Pass `llmOptions` to override provider/model for this call (e.g. force vision model).
     */
    chat(sessionId: string, userMessage: string, ragContext?: string, images?: string[], additionalTools?: AdditionalTool[], llmOptions?: ChatOptions): Promise<string>;
    /**
     * Stream chat response via async generator.
     * Pass `additionalTools` to inject per-request tools (e.g. domain skill tools) without mutating shared state.
     * Pass `llmOptions` to override provider/model for this call (e.g. force vision model).
     */
    chatStream(sessionId: string, userMessage: string, ragContext?: string, images?: string[], additionalTools?: AdditionalTool[], llmOptions?: ChatOptions): AsyncGenerator<StreamEvent>;
    private buildMessages;
    private executeToolCalls;
}
//# sourceMappingURL=agent.d.ts.map