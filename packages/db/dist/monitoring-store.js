// ============================================================
// MongoDB-backed Monitoring Store
// ============================================================
import { auditLogsCollection, systemLogsCollection, activityLogsCollection, llmLogsCollection } from './mongo.js';
function buildAuditFilter(filter) {
    const q = {};
    if (filter.tenantId)
        q.tenantId = filter.tenantId;
    if (filter.userId)
        q.userId = filter.userId;
    if (filter.action)
        q.action = filter.action;
    if (filter.resource)
        q.resource = filter.resource;
    if (filter.from || filter.to) {
        q.createdAt = {};
        if (filter.from)
            q.createdAt.$gte = filter.from;
        if (filter.to)
            q.createdAt.$lte = filter.to;
    }
    return q;
}
function buildSystemFilter(filter) {
    const q = {};
    if (filter.level) {
        q.level = Array.isArray(filter.level) ? { $in: filter.level } : filter.level;
    }
    if (filter.source)
        q.source = filter.source;
    if (filter.search)
        q.$text = { $search: filter.search };
    if (filter.from || filter.to) {
        q.createdAt = {};
        if (filter.from)
            q.createdAt.$gte = filter.from;
        if (filter.to)
            q.createdAt.$lte = filter.to;
    }
    return q;
}
function buildActivityFilter(filter) {
    const q = {};
    if (filter.tenantId)
        q.tenantId = filter.tenantId;
    if (filter.userId)
        q.userId = filter.userId;
    if (filter.method)
        q.method = filter.method;
    if (filter.path)
        q.path = { $regex: filter.path };
    if (filter.from || filter.to) {
        q.createdAt = {};
        if (filter.from)
            q.createdAt.$gte = filter.from;
        if (filter.to)
            q.createdAt.$lte = filter.to;
    }
    return q;
}
function buildLLMFilter(filter) {
    const q = {};
    if (filter.tenantId)
        q.tenantId = filter.tenantId;
    if (filter.userId)
        q.userId = filter.userId;
    if (filter.provider)
        q.provider = filter.provider;
    if (filter.model)
        q.model = filter.model;
    if (filter.sessionId)
        q.sessionId = filter.sessionId;
    if (filter.success !== undefined)
        q.success = filter.success;
    if (filter.from || filter.to) {
        q.createdAt = {};
        if (filter.from)
            q.createdAt.$gte = filter.from;
        if (filter.to)
            q.createdAt.$lte = filter.to;
    }
    return q;
}
export const mongoMonitoringStore = {
    async writeAuditLog(entry) {
        await auditLogsCollection().insertOne(entry);
    },
    async writeSystemLog(entry) {
        await systemLogsCollection().insertOne(entry);
    },
    async queryAuditLogs(filter) {
        const q = buildAuditFilter(filter);
        return auditLogsCollection()
            .find(q)
            .sort({ createdAt: -1 })
            .skip(filter.offset ?? 0)
            .limit(filter.limit ?? 50)
            .toArray();
    },
    async querySystemLogs(filter) {
        const q = buildSystemFilter(filter);
        return systemLogsCollection()
            .find(q)
            .sort({ createdAt: -1 })
            .skip(filter.offset ?? 0)
            .limit(filter.limit ?? 100)
            .toArray();
    },
    async countAuditLogs(filter) {
        return auditLogsCollection().countDocuments(buildAuditFilter(filter));
    },
    async countSystemLogs(filter) {
        return systemLogsCollection().countDocuments(buildSystemFilter(filter));
    },
    // ─── Activity Logs ─────────────────────────────────────────
    async writeActivityLog(entry) {
        await activityLogsCollection().insertOne(entry);
    },
    async queryActivityLogs(filter) {
        const q = buildActivityFilter(filter);
        return activityLogsCollection()
            .find(q)
            .sort({ createdAt: -1 })
            .skip(filter.offset ?? 0)
            .limit(filter.limit ?? 50)
            .toArray();
    },
    async countActivityLogs(filter) {
        return activityLogsCollection().countDocuments(buildActivityFilter(filter));
    },
    // ─── LLM Logs ─────────────────────────────────────────────
    async writeLLMLog(entry) {
        await llmLogsCollection().insertOne(entry);
    },
    async queryLLMLogs(filter) {
        const q = buildLLMFilter(filter);
        return llmLogsCollection()
            .find(q)
            .sort({ createdAt: -1 })
            .skip(filter.offset ?? 0)
            .limit(filter.limit ?? 50)
            .toArray();
    },
    async countLLMLogs(filter) {
        return llmLogsCollection().countDocuments(buildLLMFilter(filter));
    },
    async getLLMUsageStats(tenantId, from, to) {
        const match = {};
        if (tenantId)
            match.tenantId = tenantId;
        if (from || to) {
            match.createdAt = {};
            if (from)
                match.createdAt.$gte = from;
            if (to)
                match.createdAt.$lte = to;
        }
        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: { provider: '$provider', model: '$model' },
                    totalCalls: { $sum: 1 },
                    successCalls: { $sum: { $cond: ['$success', 1, 0] } },
                    failedCalls: { $sum: { $cond: ['$success', 0, 1] } },
                    totalTokens: { $sum: '$totalTokens' },
                    totalPromptTokens: { $sum: '$promptTokens' },
                    totalCompletionTokens: { $sum: '$completionTokens' },
                    totalCostUsd: { $sum: { $ifNull: ['$costUsd', 0] } },
                    avgDuration: { $avg: '$duration' },
                    totalDuration: { $sum: '$duration' },
                },
            },
            { $sort: { totalCalls: -1 } },
        ];
        return llmLogsCollection().aggregate(pipeline).toArray();
    },
};
//# sourceMappingURL=monitoring-store.js.map