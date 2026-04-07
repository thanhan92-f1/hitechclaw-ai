// ============================================================
// @hitechclaw/chat-sdk — Main Entry Point
// ============================================================

// Core client
export { HiTechClawClient, HiTechClawError } from './client.js';

// All types
export type {
    // Config
    HiTechClawConfig,

    // Chat
    ChatRequest,
    ChatResponse,
    ChatMessage,
    ChatSession,

    // Streaming
    StreamEvent,
    StreamCallbacks,
    StreamHandle,
    TokenUsage,

    // Tools
    ToolResult,
    ToolCallInfo,

    // Auth
    LoginRequest,
    LoginResponse,

    // Sessions
    SessionListResponse,
    ConversationSummary,
    ConversationListResponse,
    ConversationDetailResponse,
    MessageListResponse,

    // Attachments
    UploadResponse,

    // Feedback
    FeedbackRequest,
} from './types.js';
