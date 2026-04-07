import type { SandboxConfig, SandboxInstance, SandboxExecutionResult, SandboxStatus, SandboxAuditEntry, SandboxPolicy } from '@hitechclaw/shared';
/** Options for the SandboxManager */
export interface SandboxManagerOptions {
    /** Path to openshell binary (default: 'openshell') */
    binaryPath?: string;
    /** Gateway URL if using remote OpenShell */
    gatewayUrl?: string;
    /** Max sandbox pool size */
    maxPoolSize?: number;
    /** Sandbox idle timeout before auto-destroy (ms, default: 5min) */
    idleTimeoutMs?: number;
    /** Whether to use local Docker or remote gateway */
    mode?: 'local' | 'remote';
    /** Audit log callback */
    onAudit?: (entry: SandboxAuditEntry) => void;
}
export declare class SandboxManager {
    private readonly binary;
    private readonly gatewayUrl?;
    private readonly maxPoolSize;
    private readonly idleTimeoutMs;
    private readonly mode;
    private readonly onAudit?;
    /** Active sandbox instances */
    private readonly instances;
    /** Idle timers per sandbox */
    private readonly idleTimers;
    constructor(options?: SandboxManagerOptions);
    /**
     * Create a new sandbox container with the given config.
     * Returns the sandbox instance once ready.
     */
    create(config: SandboxConfig): Promise<SandboxInstance>;
    /**
     * Execute a command inside an existing sandbox.
     * Used for running tool handlers in isolation.
     */
    execute(sandboxId: string, command: string, stdin?: string): Promise<SandboxExecutionResult>;
    /**
     * Apply or update a policy on a running sandbox.
     * Network and inference policies can be hot-reloaded.
     */
    applyPolicy(sandboxId: string, policy: SandboxPolicy): Promise<void>;
    /**
     * Destroy a sandbox and clean up resources.
     */
    destroy(sandboxId: string): Promise<void>;
    /**
     * Destroy all sandboxes for a given tenant.
     */
    destroyByTenant(tenantId: string): Promise<number>;
    getInstance(sandboxId: string): SandboxInstance | undefined;
    listInstances(): SandboxInstance[];
    listByTenant(tenantId: string): SandboxInstance[];
    getPoolStats(): {
        total: number;
        maxSize: number;
        byStatus: Record<SandboxStatus, number>;
    };
    /**
     * Initialize OpenShell gateway (runs K3s cluster inside Docker).
     * Should be called once at server startup.
     */
    bootstrapGateway(): Promise<void>;
    private exec;
    private audit;
    private resetIdleTimer;
    private clearIdleTimer;
    /**
     * Clean up all sandboxes. Call during graceful shutdown.
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=sandbox-manager.d.ts.map