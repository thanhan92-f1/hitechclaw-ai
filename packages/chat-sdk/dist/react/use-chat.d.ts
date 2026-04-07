import type { ChatMessage, TokenUsage } from '../types.js';
export interface UseChatOptions {
    /** Session ID (auto-generated if not provided) */
    sessionId?: string;
    /** Domain for specialization */
    domainId?: string;
    /** Enable web search */
    webSearch?: boolean;
    /** Initial messages to pre-populate */
    initialMessages?: ChatMessage[];
    /** Callback when a complete assistant response is received */
    onFinish?: (message: ChatMessage) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Callback on tool call */
    onToolCall?: (toolName: string, toolCallId: string) => void;
    /** Callback on meta event (RAG context, search results, etc.) */
    onMeta?: (key: string, data: unknown) => void;
}
export interface UseChatReturn {
    /** All messages in the conversation */
    messages: ChatMessage[];
    /** Whether a response is currently streaming */
    isStreaming: boolean;
    /** Send a message */
    send: (message: string) => void;
    /** Cancel the current stream */
    cancel: () => void;
    /** Clear all messages */
    clear: () => void;
    /** Set messages directly */
    setMessages: (messages: ChatMessage[]) => void;
    /** Current session ID */
    sessionId: string;
    /** Last token usage stats */
    usage: TokenUsage | null;
    /** Last error */
    error: Error | null;
}
/** Main hook for chat interactions — works with React and React Native */
export declare function useChat(options?: UseChatOptions): UseChatReturn;
//# sourceMappingURL=use-chat.d.ts.map