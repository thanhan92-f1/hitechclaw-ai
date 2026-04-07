import type { ApprovalRequest, ToolCall, ToolDefinition } from '@hitechclaw/shared';
import { EventBus } from './event-bus.js';
/**
 * Approval Manager — Human-in-the-Loop (HITL) for high-risk tool calls.
 * Queues tool executions that require human approval before proceeding.
 */
export declare class ApprovalManager {
    private expiryMs;
    private pendingApprovals;
    private resolvers;
    readonly events: EventBus;
    constructor(expiryMs?: number);
    /**
     * Check if a tool call requires approval based on the tool definition
     * and agent security config.
     */
    requiresApproval(toolDef: ToolDefinition, securityConfig?: {
        requireApprovalForShell: boolean;
        requireApprovalForNetwork: boolean;
    }): boolean;
    /**
     * Request approval for a tool call. Returns a promise that resolves
     * when the request is approved/rejected/expired.
     */
    requestApproval(sessionId: string, toolCall: ToolCall, toolDefinition: ToolDefinition, reason: string): Promise<boolean>;
    /**
     * Approve a pending request.
     */
    approve(approvalId: string, userId?: string): Promise<void>;
    /**
     * Reject a pending request.
     */
    reject(approvalId: string, userId?: string): Promise<void>;
    private resolve;
    getPending(): ApprovalRequest[];
    getAll(): ApprovalRequest[];
    getById(id: string): ApprovalRequest | undefined;
}
//# sourceMappingURL=approval-manager.d.ts.map