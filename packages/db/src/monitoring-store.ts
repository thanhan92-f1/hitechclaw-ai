// ============================================================
// MongoDB-backed Monitoring Store
// ============================================================

import type { Filter } from 'mongodb';
import { auditLogsCollection, systemLogsCollection, activityLogsCollection, llmLogsCollection } from './mongo.js';
import type { MongoAuditLog, MongoSystemLog, MongoActivityLog, MongoLLMLog } from './mongo.js';

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface SystemLogFilter {
  level?: string | string[];
  source?: string;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLogFilter {
  tenantId?: string;
  userId?: string;
  method?: string;
  path?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface LLMLogFilter {
  tenantId?: string;
  userId?: string;
  provider?: string;
  model?: string;
  sessionId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

function buildAuditFilter(filter: AuditLogFilter): Filter<MongoAuditLog> {
  const q: Filter<MongoAuditLog> = {};
  if (filter.tenantId) q.tenantId = filter.tenantId;
  if (filter.userId) q.userId = filter.userId;
  if (filter.action) q.action = filter.action;
  if (filter.resource) q.resource = filter.resource;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

function buildSystemFilter(filter: SystemLogFilter): Filter<MongoSystemLog> {
  const q: Filter<MongoSystemLog> = {};
  if (filter.level) {
    q.level = Array.isArray(filter.level) ? { $in: filter.level } : filter.level;
  }
  if (filter.source) q.source = filter.source;
  if (filter.search) q.$text = { $search: filter.search };
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

function buildActivityFilter(filter: ActivityLogFilter): Filter<MongoActivityLog> {
  const q: Filter<MongoActivityLog> = {};
  if (filter.tenantId) q.tenantId = filter.tenantId;
  if (filter.userId) q.userId = filter.userId;
  if (filter.method) q.method = filter.method;
  if (filter.path) q.path = { $regex: filter.path } as any;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

function buildLLMFilter(filter: LLMLogFilter): Filter<MongoLLMLog> {
  const q: Filter<MongoLLMLog> = {};
  if (filter.tenantId) q.tenantId = filter.tenantId;
  if (filter.userId) q.userId = filter.userId;
  if (filter.provider) q.provider = filter.provider;
  if (filter.model) q.model = filter.model;
  if (filter.sessionId) q.sessionId = filter.sessionId;
  if (filter.success !== undefined) q.success = filter.success;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) (q.createdAt as any).$gte = filter.from;
    if (filter.to) (q.createdAt as any).$lte = filter.to;
  }
  return q;
}

export const mongoMonitoringStore = {
  async writeAuditLog(entry: MongoAuditLog): Promise<void> {
    await auditLogsCollection().insertOne(entry as any);
  },

  async writeSystemLog(entry: MongoSystemLog): Promise<void> {
    await systemLogsCollection().insertOne(entry as any);
  },

  async queryAuditLogs(filter: AuditLogFilter): Promise<MongoAuditLog[]> {
    const q = buildAuditFilter(filter);
    return auditLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 50)
      .toArray();
  },

  async querySystemLogs(filter: SystemLogFilter): Promise<MongoSystemLog[]> {
    const q = buildSystemFilter(filter);
    return systemLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 100)
      .toArray();
  },

  async countAuditLogs(filter: AuditLogFilter): Promise<number> {
    return auditLogsCollection().countDocuments(buildAuditFilter(filter));
  },

  async countSystemLogs(filter: SystemLogFilter): Promise<number> {
    return systemLogsCollection().countDocuments(buildSystemFilter(filter));
  },

  // ─── Activity Logs ─────────────────────────────────────────

  async writeActivityLog(entry: MongoActivityLog): Promise<void> {
    await activityLogsCollection().insertOne(entry as any);
  },

  async queryActivityLogs(filter: ActivityLogFilter): Promise<MongoActivityLog[]> {
    const q = buildActivityFilter(filter);
    return activityLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 50)
      .toArray();
  },

  async countActivityLogs(filter: ActivityLogFilter): Promise<number> {
    return activityLogsCollection().countDocuments(buildActivityFilter(filter));
  },

  // ─── LLM Logs ─────────────────────────────────────────────

  async writeLLMLog(entry: MongoLLMLog): Promise<void> {
    await llmLogsCollection().insertOne(entry as any);
  },

  async queryLLMLogs(filter: LLMLogFilter): Promise<MongoLLMLog[]> {
    const q = buildLLMFilter(filter);
    return llmLogsCollection()
      .find(q)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 50)
      .toArray();
  },

  async countLLMLogs(filter: LLMLogFilter): Promise<number> {
    return llmLogsCollection().countDocuments(buildLLMFilter(filter));
  },

  async getLLMUsageStats(tenantId?: string, from?: Date, to?: Date) {
    const match: Record<string, any> = {};
    if (tenantId) match.tenantId = tenantId;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
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
      { $sort: { totalCalls: -1 as const } },
    ];

    return llmLogsCollection().aggregate(pipeline).toArray();
  },
};
