// ============================================================
// TenantSandboxManager — Per-tenant sandbox pool management
// ============================================================
// Manages sandbox quotas, per-tenant policies, and sandbox pools
// with automatic idle cleanup.
import { randomUUID } from 'node:crypto';
import { BUILTIN_POLICIES } from './policy-builder.js';
/** Default tenant sandbox configuration */
const DEFAULT_TENANT_SANDBOX_CONFIG = {
    enabled: true,
    defaultPolicy: 'default',
    maxConcurrentSandboxes: 5,
    idleTimeoutMs: 5 * 60000,
    cpuLimit: '0.5',
    memoryLimit: '512Mi',
    gpuEnabled: false,
};
export class TenantSandboxManager {
    constructor(manager) {
        this.manager = manager;
        /** Per-tenant configurations (loaded from DB tenantSettings) */
        this.tenantConfigs = new Map();
        /** Per-tenant sandbox pools: tenantId → Map<sandboxId, SandboxInstance> */
        this.tenantPools = new Map();
    }
    // ─── Configuration ──────────────────────────────────────
    /**
     * Set tenant sandbox configuration (loaded from DB on startup or settings update).
     */
    setTenantConfig(tenantId, config) {
        this.tenantConfigs.set(tenantId, Object.assign(Object.assign({}, DEFAULT_TENANT_SANDBOX_CONFIG), config));
    }
    /**
     * Get tenant sandbox configuration.
     */
    getTenantConfig(tenantId) {
        var _a;
        return (_a = this.tenantConfigs.get(tenantId)) !== null && _a !== void 0 ? _a : DEFAULT_TENANT_SANDBOX_CONFIG;
    }
    // ─── Sandbox Operations ────────────────────────────────
    /**
     * Create a sandbox for a tenant, enforcing quotas.
     */
    async createForTenant(tenantId, overrides) {
        const config = this.getTenantConfig(tenantId);
        if (!config.enabled) {
            throw new Error('Sandbox execution is not enabled for this tenant');
        }
        // Check quota
        const currentCount = this.getTenantSandboxCount(tenantId);
        if (currentCount >= config.maxConcurrentSandboxes) {
            throw new Error(`Tenant ${tenantId} has reached max concurrent sandboxes (${config.maxConcurrentSandboxes}). ` +
                `Current: ${currentCount}. Destroy idle sandboxes first.`);
        }
        // Resolve policy
        const policy = this.resolvePolicy(config.defaultPolicy);
        const sandboxConfig = Object.assign({ id: randomUUID(), name: `tenant-${tenantId.slice(0, 8)}-${Date.now()}`, tenantId,
            policy, resources: {
                cpuLimit: config.cpuLimit,
                memoryLimit: config.memoryLimit,
                maxConcurrent: config.maxConcurrentSandboxes,
            }, gpu: config.gpuEnabled, timeoutMs: config.idleTimeoutMs }, overrides);
        const instance = await this.manager.create(sandboxConfig);
        // Track in tenant pool
        if (!this.tenantPools.has(tenantId)) {
            this.tenantPools.set(tenantId, new Set());
        }
        this.tenantPools.get(tenantId).add(instance.id);
        return instance;
    }
    /**
     * Get or create a reusable sandbox for a tenant.
     * Tries to reuse an idle sandbox from the pool.
     */
    async getOrCreate(tenantId) {
        // Try to find an idle sandbox
        const tenantSandboxIds = this.tenantPools.get(tenantId);
        if (tenantSandboxIds) {
            for (const sandboxId of tenantSandboxIds) {
                const instance = this.manager.getInstance(sandboxId);
                if (instance && instance.status === 'ready') {
                    return instance;
                }
            }
        }
        // No available sandbox — create one
        return this.createForTenant(tenantId);
    }
    /**
     * Destroy a specific sandbox, removing from tenant pool.
     */
    async destroy(tenantId, sandboxId) {
        var _a;
        await this.manager.destroy(sandboxId);
        (_a = this.tenantPools.get(tenantId)) === null || _a === void 0 ? void 0 : _a.delete(sandboxId);
    }
    /**
     * Destroy all sandboxes for a tenant.
     */
    async destroyAll(tenantId) {
        const count = await this.manager.destroyByTenant(tenantId);
        this.tenantPools.delete(tenantId);
        return count;
    }
    // ─── Queries ────────────────────────────────────────────
    getTenantSandboxCount(tenantId) {
        return this.manager.listByTenant(tenantId).length;
    }
    getTenantSandboxes(tenantId) {
        return this.manager.listByTenant(tenantId);
    }
    /**
     * Get usage stats for all tenants.
     */
    getUsageStats() {
        const stats = [];
        const tenantIds = new Set([
            ...this.tenantPools.keys(),
            ...this.tenantConfigs.keys(),
        ]);
        for (const tenantId of tenantIds) {
            const config = this.getTenantConfig(tenantId);
            stats.push({
                tenantId,
                count: this.getTenantSandboxCount(tenantId),
                maxAllowed: config.maxConcurrentSandboxes,
            });
        }
        return stats;
    }
    // ─── Internal ───────────────────────────────────────────
    resolvePolicy(policyName) {
        const policy = BUILTIN_POLICIES[policyName];
        if (!policy) {
            // Fallback to default if named policy not found
            return BUILTIN_POLICIES['default'];
        }
        return JSON.parse(JSON.stringify(policy));
    }
}
