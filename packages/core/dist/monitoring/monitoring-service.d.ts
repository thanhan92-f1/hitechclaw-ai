import type { LogLevel, AuditAction, SystemMetrics } from '@hitechclaw/shared';
import type { EventBus } from '../agent/event-bus.js';
export interface MonitoringStore {
    writeAuditLog(entry: MongoAuditLog): Promise<void>;
    writeSystemLog(entry: MongoSystemLog): Promise<void>;
    queryAuditLogs(filter: AuditLogFilter): Promise<MongoAuditLog[]>;
    querySystemLogs(filter: SystemLogFilter): Promise<MongoSystemLog[]>;
    countAuditLogs(filter: AuditLogFilter): Promise<number>;
    countSystemLogs(filter: SystemLogFilter): Promise<number>;
}
export interface MongoAuditLog {
    _id: string;
    tenantId: string;
    userId: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
}
export interface MongoSystemLog {
    _id: string;
    level: LogLevel;
    source: string;
    message: string;
    metadata?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    createdAt: Date;
}
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
    level?: LogLevel | LogLevel[];
    source?: string;
    search?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}
export declare class MonitoringService {
    private eventBus?;
    private store?;
    private metrics;
    private metricsInterval?;
    constructor(eventBus?: EventBus | undefined);
    setStore(store: MonitoringStore): void;
    audit(params: {
        tenantId: string;
        userId: string;
        action: AuditAction;
        resource: string;
        resourceId?: string;
        details?: Record<string, unknown>;
        ip?: string;
        userAgent?: string;
    }): Promise<void>;
    log(level: LogLevel, source: string, message: string, extra?: {
        metadata?: Record<string, unknown>;
        error?: Error;
    }): Promise<void>;
    info(source: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
    warn(source: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
    error(source: string, message: string, error?: Error, metadata?: Record<string, unknown>): Promise<void>;
    trackRequest(): void;
    trackLLMCall(durationMs: number, failed: boolean): void;
    trackWorkflowStart(): void;
    trackWorkflowEnd(failed: boolean): void;
    setActiveConnections(count: number): void;
    getMetrics(): SystemMetrics;
    getAuditLogs(filter: AuditLogFilter): Promise<{
        logs: MongoAuditLog[];
        total: number;
    }>;
    getSystemLogs(filter: SystemLogFilter): Promise<{
        logs: MongoSystemLog[];
        total: number;
    }>;
    private subscribeToEvents;
    destroy(): void;
}
//# sourceMappingURL=monitoring-service.d.ts.map