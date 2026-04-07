const SUMMARIZE_PROMPT = `You are a conversation summarizer. Condense the following conversation into a concise summary that preserves all key facts, decisions, user preferences, and action items. Output ONLY the summary, no preamble.`;
/**
 * Automatically summarizes long conversations to reduce context window usage.
 * When history exceeds `threshold`, older messages are compressed into a summary.
 */
export class ConversationSummarizer {
    constructor(llm, threshold = 15, keepRecent = 6) {
        this.llm = llm;
        this.threshold = threshold;
        this.keepRecent = keepRecent;
        this.summaryCache = new Map();
    }
    /**
     * Check if a session's history needs summarization and apply if needed.
     * Returns the compacted message list (summary + recent messages).
     */
    async maybeSummarize(sessionId, history) {
        if (history.length <= this.threshold) {
            return history.map((m) => ({
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls,
            }));
        }
        const olderMessages = history.slice(0, -this.keepRecent);
        const recentMessages = history.slice(-this.keepRecent);
        const summary = await this.summarize(sessionId, olderMessages);
        const compacted = [
            {
                role: 'system',
                content: `## Previous Conversation Summary\n${summary.summary}`,
            },
            ...recentMessages.map((m) => ({
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls,
            })),
        ];
        return compacted;
    }
    async summarize(sessionId, messages) {
        const cached = this.summaryCache.get(sessionId);
        if (cached && cached.messageCount === messages.length) {
            return cached;
        }
        const conversationText = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');
        const summaryMessages = [
            { role: 'system', content: SUMMARIZE_PROMPT },
            { role: 'user', content: conversationText },
        ];
        const response = await this.llm.chat(summaryMessages, [], {
            taskComplexity: 'fast',
        });
        const estimatedTokensSaved = Math.max(0, conversationText.length / 4 - response.content.length / 4);
        const summary = {
            sessionId,
            summary: response.content,
            messageCount: messages.length,
            summarizedAt: new Date().toISOString(),
            tokensSaved: Math.round(estimatedTokensSaved),
        };
        this.summaryCache.set(sessionId, summary);
        return summary;
    }
    getSummary(sessionId) {
        return this.summaryCache.get(sessionId);
    }
    clearSummary(sessionId) {
        this.summaryCache.delete(sessionId);
    }
}
