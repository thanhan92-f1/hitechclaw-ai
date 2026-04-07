import type { ConversationMessage, ConversationSummary, LLMMessage } from '@hitechclaw/shared';
import type { LLMRouter } from '../llm/llm-router.js';
/**
 * Automatically summarizes long conversations to reduce context window usage.
 * When history exceeds `threshold`, older messages are compressed into a summary.
 */
export declare class ConversationSummarizer {
    private llm;
    private threshold;
    private keepRecent;
    private summaryCache;
    constructor(llm: LLMRouter, threshold?: number, keepRecent?: number);
    /**
     * Check if a session's history needs summarization and apply if needed.
     * Returns the compacted message list (summary + recent messages).
     */
    maybeSummarize(sessionId: string, history: ConversationMessage[]): Promise<LLMMessage[]>;
    private summarize;
    getSummary(sessionId: string): ConversationSummary | undefined;
    clearSummary(sessionId: string): void;
}
//# sourceMappingURL=conversation-summarizer.d.ts.map