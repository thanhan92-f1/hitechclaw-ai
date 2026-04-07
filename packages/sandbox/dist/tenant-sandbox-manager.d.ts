import type { SandboxConfig, SandboxInstance, TenantSandboxConfig } from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';
export declare class TenantSandboxManager {
    private readonly manager;
    /** Per-tenant configurations (loaded from DB tenantSettings) */
    private readonly tenantConfigs;
    /** Per-tenant sandbox pools: tenantId → Map<sandboxId, SandboxInstance> */
    private readonly tenantPools;
    constructor(manager: SandboxManager);
    /**
     * Set tenant sandbox configuration (loaded from DB on startup or settings update).
     */
    setTenantConfig(tenantId: string, config: Partial<TenantSandboxConfig>): void;
    /**
     * Get tenant sandbox configuration.
     */
    getTenantConfig(tenantId: string): TenantSandboxConfig;
    /**
     * Create a sandbox for a tenant, enforcing quotas.
     */
    createForTenant(tenantId: string, overrides?: Partial<SandboxConfig>): Promise<SandboxInstance>;
    /**
     * Get or create a reusable sandbox for a tenant.
     * Tries to reuse an idle sandbox from the pool.
     */
    getOrCreate(tenantId: string): Promise<SandboxInstance>;
    /**
     * Destroy a specific sandbox, removing from tenant pool.
     */
    destroy(tenantId: string, sandboxId: string): Promise<void>;
    /**
     * Destroy all sandboxes for a tenant.
     */
    destroyAll(tenantId: string): Promise<number>;
    getTenantSandboxCount(tenantId: string): number;
    getTenantSandboxes(tenantId: string): SandboxInstance[];
    /**
     * Get usage stats for all tenants.
     */
    getUsageStats(): Array<{
        tenantId: string;
        count: number;
        maxAllowed: number;
    }>;
    private resolvePolicy;
}
//# sourceMappingURL=tenant-sandbox-manager.d.ts.map