import type { ChatMessage, ConversationSummary } from '../types.js';
export interface UseSessionsReturn {
    /** All sessions */
    sessions: ConversationSummary[];
    /** Currently loading */
    loading: boolean;
    /** Refresh session list */
    refresh: () => Promise<void>;
    /** Delete a session */
    deleteSession: (sessionId: string) => Promise<void>;
    /** Rename a session */
    renameSession: (sessionId: string, title: string) => Promise<void>;
    /** Get messages for a session */
    getMessages: (sessionId: string) => Promise<ChatMessage[]>;
}
/** Hook for managing chat sessions */
export declare function useSessions(): UseSessionsReturn;
//# sourceMappingURL=use-sessions.d.ts.map