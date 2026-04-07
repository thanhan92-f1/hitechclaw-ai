import type { HiTechClawConfig, ChatRequest, ChatResponse, LoginRequest, LoginResponse, ConversationListResponse, ConversationDetailResponse, MessageListResponse, UploadResponse, FeedbackRequest, StreamCallbacks, StreamHandle } from './types.js';
export declare class HiTechClawClient {
    private config;
    private _fetch;
    constructor(config: HiTechClawConfig);
    /** Authenticate and store token */
    login(credentials: LoginRequest): Promise<LoginResponse>;
    /** Set authentication token directly */
    setToken(token: string): void;
    /** Get current token */
    getToken(): string | undefined;
    /** Send a chat message (non-streaming) */
    chat(message: string, options?: Partial<Omit<ChatRequest, 'message' | 'stream'>>): Promise<ChatResponse>;
    /** Send a chat message with streaming response */
    chatStream(message: string, callbacks?: StreamCallbacks, options?: Partial<Omit<ChatRequest, 'message' | 'stream'>>): StreamHandle;
    /** List chat conversations */
    listSessions(): Promise<ConversationListResponse>;
    /** Get a conversation with messages */
    getConversation(sessionId: string): Promise<ConversationDetailResponse>;
    /** Get messages for a session (alias for getConversation) */
    getMessages(sessionId: string): Promise<MessageListResponse>;
    /** Rename a conversation */
    renameSession(sessionId: string, title: string): Promise<void>;
    /** Delete a chat session */
    deleteSession(sessionId: string): Promise<void>;
    /** Save a completed assistant message */
    saveMessage(sessionId: string, content: string): Promise<void>;
    /** Upload a file attachment */
    uploadFile(file: Blob, filename: string): Promise<UploadResponse>;
    /** Submit correction feedback for self-learning */
    feedback(data: FeedbackRequest): Promise<void>;
    private authHeaders;
    private request;
    private executeStream;
    private dispatchEvent;
}
export declare class HiTechClawError extends Error {
    readonly status: number;
    readonly body: string;
    constructor(message: string, status: number, body: string);
}
//# sourceMappingURL=client.d.ts.map