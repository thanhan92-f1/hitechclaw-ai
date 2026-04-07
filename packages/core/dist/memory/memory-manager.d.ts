import type { MemoryEntry, ConversationMessage } from '@hitechclaw/shared';
export interface MemoryStore {
    getHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]>;
    addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
    clearHistory(sessionId: string): Promise<void>;
    search(query: string, options?: {
        limit?: number;
    }): Promise<MemoryEntry[]>;
    store(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry>;
}
export declare class MemoryManager {
    private store;
    private historyCache;
    constructor(store?: MemoryStore);
    getHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]>;
    /** Sync helper — returns cached history for building LLM messages */
    getHistorySync(sessionId: string): ConversationMessage[];
    loadHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]>;
    addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
    clearHistory(sessionId: string): Promise<void>;
    search(query: string, options?: {
        limit?: number;
    }): Promise<MemoryEntry[]>;
    storeEntry(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry>;
}
//# sourceMappingURL=memory-manager.d.ts.map