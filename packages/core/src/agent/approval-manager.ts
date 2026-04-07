import type { ApprovalRequest, ApprovalStatus, ToolCall, ToolDefinition } from '@hitechclaw/shared';
import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus.js';

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Approval Manager — Human-in-the-Loop (HITL) for high-risk tool calls.
 * Queues tool executions that require human approval before proceeding.
 */
export class ApprovalManager {
  private pendingApprovals = new Map<string, ApprovalRequest>();
  private resolvers = new Map<string, (approved: boolean) => void>();
  readonly events = new EventBus();

  constructor(private expiryMs = DEFAULT_EXPIRY_MS) {}

  /**
   * Check if a tool call requires approval based on the tool definition
   * and agent security config.
   */
  requiresApproval(toolDef: ToolDefinition, securityConfig?: { requireApprovalForShell: boolean; requireApprovalForNetwork: boolean }): boolean {
    if (toolDef.requiresApproval) return true;
    if (!securityConfig) return false;

    const isShellTool = toolDef.category === 'system' || toolDef.name.includes('shell') || toolDef.name.includes('exec');
    const isNetworkTool = toolDef.category === 'network' || toolDef.name.includes('http') || toolDef.name.includes('fetch');

    if (securityConfig.requireApprovalForShell && isShellTool) return true;
    if (securityConfig.requireApprovalForNetwork && isNetworkTool) return true;

    return false;
  }

  /**
   * Request approval for a tool call. Returns a promise that resolves
   * when the request is approved/rejected/expired.
   */
  async requestApproval(
    sessionId: string,
    toolCall: ToolCall,
    toolDefinition: ToolDefinition,
    reason: string,
  ): Promise<boolean> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expiryMs);

    const request: ApprovalRequest = {
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

    return new Promise<boolean>((resolve) => {
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
  async approve(approvalId: string, userId?: string): Promise<void> {
    await this.resolve(approvalId, 'approved', userId);
  }

  /**
   * Reject a pending request.
   */
  async reject(approvalId: string, userId?: string): Promise<void> {
    await this.resolve(approvalId, 'rejected', userId);
  }

  private async resolve(approvalId: string, status: ApprovalStatus, userId?: string): Promise<void> {
    const request = this.pendingApprovals.get(approvalId);
    if (!request) return;

    request.status = status;
    request.resolvedAt = new Date().toISOString();
    if (userId) request.resolvedBy = userId;

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

  getPending(): ApprovalRequest[] {
    return [...this.pendingApprovals.values()].filter((r) => r.status === 'pending');
  }

  getAll(): ApprovalRequest[] {
    return [...this.pendingApprovals.values()];
  }

  getById(id: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(id);
  }
}
