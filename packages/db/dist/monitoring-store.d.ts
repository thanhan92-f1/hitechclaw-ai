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
export declare const mongoMonitoringStore: {
    writeAuditLog(entry: MongoAuditLog): Promise<void>;
    writeSystemLog(entry: MongoSystemLog): Promise<void>;
    queryAuditLogs(filter: AuditLogFilter): Promise<MongoAuditLog[]>;
    querySystemLogs(filter: SystemLogFilter): Promise<MongoSystemLog[]>;
    countAuditLogs(filter: AuditLogFilter): Promise<number>;
    countSystemLogs(filter: SystemLogFilter): Promise<number>;
    writeActivityLog(entry: MongoActivityLog): Promise<void>;
    queryActivityLogs(filter: ActivityLogFilter): Promise<MongoActivityLog[]>;
    countActivityLogs(filter: ActivityLogFilter): Promise<number>;
    writeLLMLog(entry: MongoLLMLog): Promise<void>;
    queryLLMLogs(filter: LLMLogFilter): Promise<MongoLLMLog[]>;
    countLLMLogs(filter: LLMLogFilter): Promise<number>;
    getLLMUsageStats(tenantId?: string, from?: Date, to?: Date): Promise<import("bson").Document[]>;
};
//# sourceMappingURL=monitoring-store.d.ts.map