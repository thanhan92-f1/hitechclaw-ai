import { randomUUID } from 'node:crypto';
/**
 * In-memory store for development / testing.
 */
class InMemoryStore {
    history = new Map();
    entries = [];
    async getHistory(sessionId, limit = 50) {
        const msgs = this.history.get(sessionId) ?? [];
        return msgs.slice(-limit);
    }
    async addMessage(sessionId, message) {
        if (!this.history.has(sessionId)) {
            this.history.set(sessionId, []);
        }
        this.history.get(sessionId).push(message);
    }
    async clearHistory(sessionId) {
        this.history.delete(sessionId);
    }
    async search(query, options) {
        const q = query.toLowerCase();
        const results = this.entries.filter((e) => e.content.toLowerCase().includes(q));
        return results.slice(0, options?.limit ?? 10);
    }
    async store(entry) {
        const full = {
            ...entry,
            id: randomUUID(),
        };
        this.entries.push(full);
        return full;
    }
}
export class MemoryManager {
    store;
    historyCache = new Map();
    constructor(store) {
        this.store = store ?? new InMemoryStore();
    }
    async getHistory(sessionId, limit) {
        return this.store.getHistory(sessionId, limit);
    }
    /** Sync helper — returns cached history for building LLM messages */
    getHistorySync(sessionId) {
        return this.historyCache.get(sessionId) ?? [];
    }
    async loadHistory(sessionId, limit) {
        const history = await this.store.getHistory(sessionId, limit);
        this.historyCache.set(sessionId, history);
        return history;
    }
    async addMessage(sessionId, message) {
        await this.store.addMessage(sessionId, message);
        // Update cache
        if (!this.historyCache.has(sessionId)) {
            this.historyCache.set(sessionId, []);
        }
        this.historyCache.get(sessionId).push(message);
    }
    async clearHistory(sessionId) {
        await this.store.clearHistory(sessionId);
        this.historyCache.delete(sessionId);
    }
    async search(query, options) {
        return this.store.search(query, options);
    }
    async storeEntry(entry) {
        return this.store.store(entry);
    }
}
//# sourceMappingURL=memory-manager.js.map