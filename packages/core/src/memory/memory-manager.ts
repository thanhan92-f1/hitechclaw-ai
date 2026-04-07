import { randomUUID } from 'node:crypto';
import type { MemoryEntry, ConversationMessage } from '@hitechclaw/shared';

export interface MemoryStore {
  getHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]>;
  addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
  clearHistory(sessionId: string): Promise<void>;
  search(query: string, options?: { limit?: number }): Promise<MemoryEntry[]>;
  store(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry>;
}

/**
 * In-memory store for development / testing.
 */
class InMemoryStore implements MemoryStore {
  private history = new Map<string, ConversationMessage[]>();
  private entries: MemoryEntry[] = [];

  async getHistory(sessionId: string, limit = 50): Promise<ConversationMessage[]> {
    const msgs = this.history.get(sessionId) ?? [];
    return msgs.slice(-limit);
  }

  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    if (!this.history.has(sessionId)) {
      this.history.set(sessionId, []);
    }
    this.history.get(sessionId)!.push(message);
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.history.delete(sessionId);
  }

  async search(query: string, options?: { limit?: number }): Promise<MemoryEntry[]> {
    const q = query.toLowerCase();
    const results = this.entries.filter((e) => e.content.toLowerCase().includes(q));
    return results.slice(0, options?.limit ?? 10);
  }

  async store(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry> {
    const full: MemoryEntry = {
      ...entry,
      id: randomUUID(),
    };
    this.entries.push(full);
    return full;
  }
}

export class MemoryManager {
  private store: MemoryStore;
  private historyCache = new Map<string, ConversationMessage[]>();

  constructor(store?: MemoryStore) {
    this.store = store ?? new InMemoryStore();
  }

  async getHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]> {
    return this.store.getHistory(sessionId, limit);
  }

  /** Sync helper — returns cached history for building LLM messages */
  getHistorySync(sessionId: string): ConversationMessage[] {
    return this.historyCache.get(sessionId) ?? [];
  }

  async loadHistory(sessionId: string, limit?: number): Promise<ConversationMessage[]> {
    const history = await this.store.getHistory(sessionId, limit);
    this.historyCache.set(sessionId, history);
    return history;
  }

  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    await this.store.addMessage(sessionId, message);
    // Update cache
    if (!this.historyCache.has(sessionId)) {
      this.historyCache.set(sessionId, []);
    }
    this.historyCache.get(sessionId)!.push(message);
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.store.clearHistory(sessionId);
    this.historyCache.delete(sessionId);
  }

  async search(query: string, options?: { limit?: number }): Promise<MemoryEntry[]> {
    return this.store.search(query, options);
  }

  async storeEntry(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry> {
    return this.store.store(entry);
  }
}
