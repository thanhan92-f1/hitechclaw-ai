import { randomUUID } from 'node:crypto';
/**
 * In-memory store for development / testing.
 */
class InMemoryStore {
    constructor() {
        this.history = new Map();
        this.entries = [];
    }
    async getHistory(sessionId, limit = 50) {
        var _a;
        const msgs = (_a = this.history.get(sessionId)) !== null && _a !== void 0 ? _a : [];
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
        var _a;
        const q = query.toLowerCase();
        const results = this.entries.filter((e) => e.content.toLowerCase().includes(q));
        return results.slice(0, (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 10);
    }
    async store(entry) {
        const full = Object.assign(Object.assign({}, entry), { id: randomUUID() });
        this.entries.push(full);
        return full;
    }
}
export class MemoryManager {
    constructor(store) {
        this.historyCache = new Map();
        this.store = store !== null && store !== void 0 ? store : new InMemoryStore();
    }
    async getHistory(sessionId, limit) {
        return this.store.getHistory(sessionId, limit);
    }
    /** Sync helper — returns cached history for building LLM messages */
    getHistorySync(sessionId) {
        var _a;
        return (_a = this.historyCache.get(sessionId)) !== null && _a !== void 0 ? _a : [];
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
