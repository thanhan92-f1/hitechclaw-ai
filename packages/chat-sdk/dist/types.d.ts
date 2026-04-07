export type StreamEvent = {
    type: 'text-delta';
    delta: string;
} | {
    type: 'tool-call-start';
    toolCallId: string;
    toolName: string;
} | {
    type: 'tool-call-args';
    toolCallId: string;
    argsJson: string;
} | {
    type: 'tool-call-end';
    toolCallId: string;
} | {
    type: 'tool-result';
    toolCallId: string;
    result: ToolResult;
} | {
    type: 'meta';
    key: string;
    data: unknown;
} | {
    type: 'finish';
    usage: TokenUsage;
    finishReason: string;
} | {
    type: 'error';
    error: string;
};
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface ToolResult {
    toolCallId: string;
    success: boolean;
    output?: string;
    error?: string;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
    /** Tool calls that occurred during this message */
    toolCalls?: ToolCallInfo[];
    /** Usage stats (assistant messages only) */
    usage?: TokenUsage;
    /** Streaming state */
    isStreaming?: boolean;
}
export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: ToolResult;
}
export interface ChatSession {
    id: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface HiTechClawConfig {
    /** HiTechClaw server base URL (e.g., "https://api.hitechclaw.io") */
    baseUrl: string;
    /** Authentication token (Bearer) */
    token?: string;
    /** Default domain for specialization */
    defaultDomain?: string;
    /** Enable web search by default */
    webSearch?: boolean;
    /** Request timeout in ms (default: 60000) */
    timeout?: number;
    /** Custom fetch implementation (for React Native polyfills) */
    fetch?: typeof globalThis.fetch;
    /** Custom headers to include in all requests */
    headers?: Record<string, string>;
}
export interface ChatRequest {
    message: string;
    sessionId?: string;
    stream?: boolean;
    webSearch?: boolean;
    domainId?: string;
    agentConfigId?: string;
    attachmentIds?: string[];
}
export interface ChatResponse {
    sessionId: string;
    content: string;
    usage?: TokenUsage;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}
export interface SessionListResponse {
    sessions: ChatSession[];
}
export interface ConversationSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    lastMessage: string;
}
export type ConversationListResponse = ConversationSummary[];
export interface ConversationDetailResponse {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}
export interface MessageListResponse {
    messages: ChatMessage[];
}
export interface UploadResponse {
    id: string;
    filename: string;
    size: number;
}
export interface FeedbackRequest {
    originalQuestion: string;
    aiAnswer: string;
    feedback: 'positive' | 'negative';
    correction?: string;
}
export interface StreamCallbacks {
    onTextDelta?: (delta: string, accumulated: string) => void;
    onToolCallStart?: (toolCallId: string, toolName: string) => void;
    onToolCallArgs?: (toolCallId: string, argsJson: string) => void;
    onToolCallEnd?: (toolCallId: string) => void;
    onToolResult?: (toolCallId: string, result: ToolResult) => void;
    onMeta?: (key: string, data: unknown) => void;
    onFinish?: (usage: TokenUsage, finishReason: string) => void;
    onError?: (error: string) => void;
}
export interface StreamHandle {
    /** Cancel the ongoing stream */
    cancel: () => void;
    /** Promise that resolves with the full accumulated text */
    done: Promise<string>;
    /** Promise that resolves with all stream events */
    events: Promise<StreamEvent[]>;
}
//# sourceMappingURL=types.d.ts.map