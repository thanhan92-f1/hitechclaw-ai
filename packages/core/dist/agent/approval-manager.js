import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus.js';
const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Approval Manager — Human-in-the-Loop (HITL) for high-risk tool calls.
 * Queues tool executions that require human approval before proceeding.
 */
export class ApprovalManager {
    expiryMs;
    pendingApprovals = new Map();
    resolvers = new Map();
    events = new EventBus();
    constructor(expiryMs = DEFAULT_EXPIRY_MS) {
        this.expiryMs = expiryMs;
    }
    /**
     * Check if a tool call requires approval based on the tool definition
     * and agent security config.
     */
    requiresApproval(toolDef, securityConfig) {
        if (toolDef.requiresApproval)
            return true;
        if (!securityConfig)
            return false;
        const isShellTool = toolDef.category === 'system' || toolDef.name.includes('shell') || toolDef.name.includes('exec');
        const isNetworkTool = toolDef.category === 'network' || toolDef.name.includes('http') || toolDef.name.includes('fetch');
        if (securityConfig.requireApprovalForShell && isShellTool)
            return true;
        if (securityConfig.requireApprovalForNetwork && isNetworkTool)
            return true;
        return false;
    }
    /**
     * Request approval for a tool call. Returns a promise that resolves
     * when the request is approved/rejected/expired.
     */
    async requestApproval(sessionId, toolCall, toolDefinition, reason) {
        const id = randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.expiryMs);
        const request = {
            id,
            sessionId,
            toolCall,
            toolDefinition,
            reason,
            status: 'pending',
            requestedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        this.pendingApprovals.set(id, request);
        await this.events.emit({
            type: 'approval:requested',
            payload: {
                approvalId: id,
                sessionId,
                toolName: toolCall.name,
                reason,
                expiresAt: expiresAt.toISOString(),
            },
            source: 'approval-manager',
            timestamp: now.toISOString(),
        });
        return new Promise((resolve) => {
            this.resolvers.set(id, resolve);
            // Auto-expire after timeout
            setTimeout(() => {
                if (this.pendingApprovals.get(id)?.status === 'pending') {
                    this.resolve(id, 'expired');
                }
            }, this.expiryMs);
        });
    }
    /**
     * Approve a pending request.
     */
    async approve(approvalId, userId) {
        await this.resolve(approvalId, 'approved', userId);
    }
    /**
     * Reject a pending request.
     */
    async reject(approvalId, userId) {
        await this.resolve(approvalId, 'rejected', userId);
    }
    async resolve(approvalId, status, userId) {
        const request = this.pendingApprovals.get(approvalId);
        if (!request)
            return;
        request.status = status;
        request.resolvedAt = new Date().toISOString();
        if (userId)
            request.resolvedBy = userId;
        const resolver = this.resolvers.get(approvalId);
        if (resolver) {
            resolver(status === 'approved');
            this.resolvers.delete(approvalId);
        }
        await this.events.emit({
            type: `approval:${status}`,
            payload: {
                approvalId,
                sessionId: request.sessionId,
                toolName: request.toolCall.name,
                resolvedBy: userId,
            },
            source: 'approval-manager',
            timestamp: new Date().toISOString(),
        });
    }
    getPending() {
        return [...this.pendingApprovals.values()].filter((r) => r.status === 'pending');
    }
    getAll() {
        return [...this.pendingApprovals.values()];
    }
    getById(id) {
        return this.pendingApprovals.get(id);
    }
}
//# sourceMappingURL=approval-manager.js.map