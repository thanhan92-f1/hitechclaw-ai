// ============================================================
// Monitoring Service — System logs, audit trail, metrics
// ============================================================
import { randomUUID } from 'node:crypto';
export class MonitoringService {
    eventBus;
    store;
    metrics;
    metricsInterval;
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.metrics = {
            requestCount: 0,
            requestCountByMinute: [],
            llmCallsTotal: 0,
            llmCallsFailed: 0,
            llmLatencies: [],
            workflowTotal: 0,
            workflowRunning: 0,
            workflowFailed: 0,
            activeConnections: 0,
            startedAt: Date.now(),
        };
        if (this.eventBus) {
            this.subscribeToEvents();
        }
        // Rotate per-minute request counter every 60s
        this.metricsInterval = setInterval(() => {
            this.metrics.requestCountByMinute.push(this.metrics.requestCount);
            if (this.metrics.requestCountByMinute.length > 60) {
                this.metrics.requestCountByMinute.shift();
            }
            this.metrics.requestCount = 0;
        }, 60_000);
    }
    setStore(store) {
        this.store = store;
    }
    // ─── Audit Logging ────────────────────────────────────────
    async audit(params) {
        const entry = {
            _id: randomUUID(),
            tenantId: params.tenantId,
            userId: params.userId,
            action: params.action,
            resource: params.resource,
            resourceId: params.resourceId,
            details: params.details,
            ip: params.ip,
            userAgent: params.userAgent,
            createdAt: new Date(),
        };
        if (this.store) {
            await this.store.writeAuditLog(entry);
        }
        // Also emit event for real-time listeners
        this.eventBus?.emit({
            type: 'audit:log',
            payload: entry,
            source: 'monitoring',
            timestamp: new Date().toISOString(),
        });
    }
    // ─── System Logging ───────────────────────────────────────
    async log(level, source, message, extra) {
        const entry = {
            _id: randomUUID(),
            level,
            source,
            message,
            metadata: extra?.metadata,
            error: extra?.error ? {
                name: extra.error.name,
                message: extra.error.message,
                stack: extra.error.stack,
            } : undefined,
            createdAt: new Date(),
        };
        // Always log to console
        const prefix = `[${level.toUpperCase()}] [${source}]`;
        switch (level) {
            case 'debug':
                console.debug(prefix, message);
                break;
            case 'info':
                console.info(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'error':
            case 'fatal':
                console.error(prefix, message, extra?.error ?? '');
                break;
        }
        if (this.store) {
            await this.store.writeSystemLog(entry);
        }
    }
    info(source, message, metadata) {
        return this.log('info', source, message, { metadata });
    }
    warn(source, message, metadata) {
        return this.log('warn', source, message, { metadata });
    }
    error(source, message, error, metadata) {
        return this.log('error', source, message, { error, metadata });
    }
    // ─── Metrics ──────────────────────────────────────────────
    trackRequest() {
        this.metrics.requestCount++;
    }
    trackLLMCall(durationMs, failed) {
        this.metrics.llmCallsTotal++;
        if (failed)
            this.metrics.llmCallsFailed++;
        this.metrics.llmLatencies.push(durationMs);
        // Keep last 1000 latencies for avg calculation
        if (this.metrics.llmLatencies.length > 1000) {
            this.metrics.llmLatencies.shift();
        }
    }
    trackWorkflowStart() {
        this.metrics.workflowTotal++;
        this.metrics.workflowRunning++;
    }
    trackWorkflowEnd(failed) {
        this.metrics.workflowRunning = Math.max(0, this.metrics.workflowRunning - 1);
        if (failed)
            this.metrics.workflowFailed++;
    }
    setActiveConnections(count) {
        this.metrics.activeConnections = count;
    }
    getMetrics() {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        const avgLatency = this.metrics.llmLatencies.length > 0
            ? this.metrics.llmLatencies.reduce((a, b) => a + b, 0) / this.metrics.llmLatencies.length
            : 0;
        const rpm = this.metrics.requestCountByMinute.length > 0
            ? this.metrics.requestCountByMinute[this.metrics.requestCountByMinute.length - 1] ?? 0
            : 0;
        return {
            uptime: Math.floor((Date.now() - this.metrics.startedAt) / 1000),
            memoryUsage: {
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                rss: mem.rss,
                external: mem.external,
            },
            cpuUsage: {
                user: cpu.user,
                system: cpu.system,
            },
            activeConnections: this.metrics.activeConnections,
            requestsPerMinute: rpm,
            llmCalls: {
                total: this.metrics.llmCallsTotal,
                failed: this.metrics.llmCallsFailed,
                avgLatency: Math.round(avgLatency),
            },
            workflowExecutions: {
                total: this.metrics.workflowTotal,
                running: this.metrics.workflowRunning,
                failed: this.metrics.workflowFailed,
            },
            timestamp: new Date().toISOString(),
        };
    }
    // ─── Queries ──────────────────────────────────────────────
    async getAuditLogs(filter) {
        if (!this.store)
            return { logs: [], total: 0 };
        const [logs, total] = await Promise.all([
            this.store.queryAuditLogs(filter),
            this.store.countAuditLogs(filter),
        ]);
        return { logs, total };
    }
    async getSystemLogs(filter) {
        if (!this.store)
            return { logs: [], total: 0 };
        const [logs, total] = await Promise.all([
            this.store.querySystemLogs(filter),
            this.store.countSystemLogs(filter),
        ]);
        return { logs, total };
    }
    // ─── Event Bus Integration ────────────────────────────────
    subscribeToEvents() {
        if (!this.eventBus)
            return;
        this.eventBus.on('workflow:started', async () => {
            this.trackWorkflowStart();
        });
        this.eventBus.on('workflow:completed', async (event) => {
            this.trackWorkflowEnd(event.payload.status === 'failed');
        });
        this.eventBus.on('llm:*', async (event) => {
            if (event.type === 'llm:completed' || event.type === 'llm:failed') {
                const duration = event.payload.duration ?? 0;
                this.trackLLMCall(duration, event.type === 'llm:failed');
            }
        });
    }
    destroy() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
    }
}
//# sourceMappingURL=monitoring-service.js.map