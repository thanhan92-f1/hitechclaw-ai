/**
 * Persistent Memory — Cross-session user preferences, facts, and learned context.
 *
 * Stores structured entries that persist across sessions to MongoDB, enabling:
 * - User preferences (language, tone, domain interests)
 * - Learned facts ("User works at company X", "User prefers concise answers")
 * - Context carryover ("We discussed project Y last time")
 */
export interface PersistentEntry {
    id: string;
    userId: string;
    tenantId: string;
    type: 'preference' | 'fact' | 'context' | 'instruction';
    key: string;
    value: string;
    confidence: number;
    source: 'explicit' | 'inferred';
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}
export interface PersistentMemoryConfig {
    maxEntries: number;
    autoExtract: boolean;
    minConfidence: number;
}
/**
 * Persistent Memory Manager — MongoDB-backed.
 * Manages cross-session user knowledge that persists beyond individual conversations.
 */
export declare class PersistentMemory {
    private config;
    constructor(config?: Partial<PersistentMemoryConfig>);
    private toEntry;
    /**
     * Get all persistent entries for a user.
     */
    getEntries(userId: string, tenantId: string): Promise<PersistentEntry[]>;
    /**
     * Get entries by type.
     */
    getByType(userId: string, tenantId: string, type: PersistentEntry['type']): Promise<PersistentEntry[]>;
    /**
     * Store a persistent entry. Updates if same (userId, type, key) already exists.
     */
    store(entry: Omit<PersistentEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersistentEntry>;
    /**
     * Remove a persistent entry.
     */
    remove(userId: string, tenantId: string, entryId: string): Promise<boolean>;
    /**
     * Clear all persistent entries for a user.
     */
    clear(userId: string, tenantId: string): Promise<void>;
    /**
     * Build a system prompt fragment with user's persistent context.
     */
    buildContextPrompt(userId: string, tenantId: string): Promise<string>;
    /**
     * Extract facts from a conversation message (auto-extract mode).
     */
    extractFromMessage(userId: string, tenantId: string, content: string): Promise<PersistentEntry[]>;
}
//# sourceMappingURL=persistent-memory.d.ts.map