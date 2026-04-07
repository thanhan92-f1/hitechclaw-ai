import { randomUUID } from 'node:crypto';
import { memoryEntriesCollection } from '@hitechclaw/db';
const DEFAULT_CONFIG = {
    maxEntries: 200,
    autoExtract: true,
    minConfidence: 0.7,
};
/**
 * Persistent Memory Manager — MongoDB-backed.
 * Manages cross-session user knowledge that persists beyond individual conversations.
 */
export class PersistentMemory {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─── Helpers ───────────────────────────────────────────────────
    toEntry(doc) {
        return {
            id: doc._id,
            userId: doc.userId ?? '',
            tenantId: doc.tenantId,
            type: doc.type,
            key: doc.metadata?.key ?? '',
            value: doc.content,
            confidence: doc.metadata?.confidence ?? 1,
            source: doc.source ?? 'explicit',
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            expiresAt: doc.expiresAt,
        };
    }
    // ─── Read Operations ───────────────────────────────────────────
    /**
     * Get all persistent entries for a user.
     */
    async getEntries(userId, tenantId) {
        const col = memoryEntriesCollection();
        const now = new Date();
        const docs = await col.find({
            tenantId,
            userId,
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        }).toArray();
        return docs.map((d) => this.toEntry(d));
    }
    /**
     * Get entries by type.
     */
    async getByType(userId, tenantId, type) {
        const col = memoryEntriesCollection();
        const now = new Date();
        const docs = await col.find({
            tenantId,
            userId,
            type,
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        }).toArray();
        return docs.map((d) => this.toEntry(d));
    }
    // ─── Write Operations ──────────────────────────────────────────
    /**
     * Store a persistent entry. Updates if same (userId, type, key) already exists.
     */
    async store(entry) {
        const col = memoryEntriesCollection();
        const now = new Date();
        // Check for existing entry with same key+type for this user
        const existing = await col.findOne({
            tenantId: entry.tenantId,
            userId: entry.userId,
            type: entry.type,
            'metadata.key': entry.key,
        });
        if (existing) {
            const newConfidence = Math.max(existing.metadata?.confidence ?? 0, entry.confidence);
            await col.updateOne({ _id: existing._id }, {
                $set: {
                    content: entry.value,
                    source: entry.source,
                    updatedAt: now,
                    expiresAt: entry.expiresAt,
                    'metadata.confidence': newConfidence,
                },
            });
            return this.toEntry({ ...existing, content: entry.value, source: entry.source, updatedAt: now, expiresAt: entry.expiresAt, metadata: { ...existing.metadata, confidence: newConfidence } });
        }
        // Enforce max entries — remove lowest-confidence inferred entry if needed
        const count = await col.countDocuments({ tenantId: entry.tenantId, userId: entry.userId });
        if (count >= this.config.maxEntries) {
            const inferredEntry = await col.findOne({ tenantId: entry.tenantId, userId: entry.userId, source: 'inferred' }, { sort: { 'metadata.confidence': 1, createdAt: 1 } });
            if (inferredEntry) {
                await col.deleteOne({ _id: inferredEntry._id });
            }
            else {
                const oldest = await col.findOne({ tenantId: entry.tenantId, userId: entry.userId }, { sort: { createdAt: 1 } });
                if (oldest)
                    await col.deleteOne({ _id: oldest._id });
            }
        }
        const id = randomUUID();
        const doc = {
            _id: id,
            tenantId: entry.tenantId,
            userId: entry.userId,
            type: entry.type,
            content: entry.value,
            metadata: { key: entry.key, confidence: entry.confidence },
            source: entry.source,
            tags: [entry.type, entry.key],
            createdAt: now,
            updatedAt: now,
            expiresAt: entry.expiresAt,
        };
        await col.insertOne(doc);
        return this.toEntry(doc);
    }
    /**
     * Remove a persistent entry.
     */
    async remove(userId, tenantId, entryId) {
        const col = memoryEntriesCollection();
        const result = await col.deleteOne({ _id: entryId, tenantId, userId });
        return result.deletedCount > 0;
    }
    /**
     * Clear all persistent entries for a user.
     */
    async clear(userId, tenantId) {
        const col = memoryEntriesCollection();
        await col.deleteMany({ tenantId, userId });
    }
    // ─── Context Building ──────────────────────────────────────────
    /**
     * Build a system prompt fragment with user's persistent context.
     */
    async buildContextPrompt(userId, tenantId) {
        const entries = await this.getEntries(userId, tenantId);
        if (entries.length === 0)
            return '';
        const preferences = entries.filter((e) => e.type === 'preference');
        const facts = entries.filter((e) => e.type === 'fact');
        const instructions = entries.filter((e) => e.type === 'instruction');
        const parts = [];
        if (preferences.length > 0) {
            parts.push('User Preferences:\n' + preferences.map((p) => `- ${p.key}: ${p.value}`).join('\n'));
        }
        if (facts.length > 0) {
            parts.push('Known Facts:\n' + facts.map((f) => `- ${f.value}`).join('\n'));
        }
        if (instructions.length > 0) {
            parts.push('Standing Instructions:\n' + instructions.map((i) => `- ${i.value}`).join('\n'));
        }
        return parts.join('\n\n');
    }
    // ─── Auto Extraction ───────────────────────────────────────────
    /**
     * Extract facts from a conversation message (auto-extract mode).
     */
    async extractFromMessage(userId, tenantId, content) {
        if (!this.config.autoExtract)
            return [];
        const extracted = [];
        const patterns = [
            { regex: /(?:my name is|i(?:'m| am)) (\w+)/i, type: 'fact', key: 'user_name' },
            { regex: /i (?:work|am working) (?:at|for) ([^.!?,]+)/i, type: 'fact', key: 'workplace' },
            { regex: /i prefer (\w+) (?:language|mode)/i, type: 'preference', key: 'language' },
            { regex: /please (?:always|remember to) ([^.!]+)/i, type: 'instruction', key: 'instruction' },
            { regex: /i speak (\w+)/i, type: 'preference', key: 'spoken_language' },
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern.regex);
            if (match) {
                const entry = await this.store({
                    userId,
                    tenantId,
                    type: pattern.type,
                    key: pattern.key,
                    value: match[1].trim(),
                    confidence: 0.8,
                    source: 'inferred',
                });
                extracted.push(entry);
            }
        }
        return extracted;
    }
}
//# sourceMappingURL=persistent-memory.js.map