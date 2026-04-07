import type { IWorkflowEngine } from '@hitechclaw/shared';
/**
 * Starts the schedule-trigger polling loop.
 * Runs every minute on the minute boundary.
 * Call once after server startup.
 */
export declare function startWorkflowScheduler(workflowEngine: IWorkflowEngine): void;
/**
 * Stops the scheduler (e.g. for graceful shutdown).
 */
export declare function stopWorkflowScheduler(): void;
//# sourceMappingURL=workflow-scheduler.d.ts.map