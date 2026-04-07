// ============================================================
// TenantSandboxManager — Per-tenant sandbox pool management
// ============================================================
// Manages sandbox quotas, per-tenant policies, and sandbox pools
// with automatic idle cleanup.

import { randomUUID } from 'node:crypto';
import type {
  SandboxConfig,
  SandboxInstance,
  SandboxPolicy,
  TenantSandboxConfig,
} from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';
import { BUILTIN_POLICIES } from './policy-builder.js';

/** Default tenant sandbox configuration */
const DEFAULT_TENANT_SANDBOX_CONFIG: TenantSandboxConfig = {
  enabled: true,
  defaultPolicy: 'default',
  maxConcurrentSandboxes: 5,
  idleTimeoutMs: 5 * 60_000,
  cpuLimit: '0.5',
  memoryLimit: '512Mi',
  gpuEnabled: false,
};

export class TenantSandboxManager {
  /** Per-tenant configurations (loaded from DB tenantSettings) */
  private readonly tenantConfigs = new Map<string, TenantSandboxConfig>();

  /** Per-tenant sandbox pools: tenantId → Map<sandboxId, SandboxInstance> */
  private readonly tenantPools = new Map<string, Set<string>>();

  constructor(private readonly manager: SandboxManager) {}

  // ─── Configuration ──────────────────────────────────────

  /**
   * Set tenant sandbox configuration (loaded from DB on startup or settings update).
   */
  setTenantConfig(tenantId: string, config: Partial<TenantSandboxConfig>): void {
    this.tenantConfigs.set(tenantId, {
      ...DEFAULT_TENANT_SANDBOX_CONFIG,
      ...config,
    });
  }

  /**
   * Get tenant sandbox configuration.
   */
  getTenantConfig(tenantId: string): TenantSandboxConfig {
    return this.tenantConfigs.get(tenantId) ?? DEFAULT_TENANT_SANDBOX_CONFIG;
  }

  // ─── Sandbox Operations ────────────────────────────────

  /**
   * Create a sandbox for a tenant, enforcing quotas.
   */
  async createForTenant(tenantId: string, overrides?: Partial<SandboxConfig>): Promise<SandboxInstance> {
    const config = this.getTenantConfig(tenantId);

    if (!config.enabled) {
      throw new Error('Sandbox execution is not enabled for this tenant');
    }

    // Check quota
    const currentCount = this.getTenantSandboxCount(tenantId);
    if (currentCount >= config.maxConcurrentSandboxes) {
      throw new Error(
        `Tenant ${tenantId} has reached max concurrent sandboxes (${config.maxConcurrentSandboxes}). ` +
        `Current: ${currentCount}. Destroy idle sandboxes first.`
      );
    }

    // Resolve policy
    const policy = this.resolvePolicy(config.defaultPolicy);

    const sandboxConfig: SandboxConfig = {
      id: randomUUID(),
      name: `tenant-${tenantId.slice(0, 8)}-${Date.now()}`,
      tenantId,
      policy,
      resources: {
        cpuLimit: config.cpuLimit,
        memoryLimit: config.memoryLimit,
        maxConcurrent: config.maxConcurrentSandboxes,
      },
      gpu: config.gpuEnabled,
      timeoutMs: config.idleTimeoutMs,
      ...overrides,
    };

    const instance = await this.manager.create(sandboxConfig);

    // Track in tenant pool
    if (!this.tenantPools.has(tenantId)) {
      this.tenantPools.set(tenantId, new Set());
    }
    this.tenantPools.get(tenantId)!.add(instance.id);

    return instance;
  }

  /**
   * Get or create a reusable sandbox for a tenant.
   * Tries to reuse an idle sandbox from the pool.
   */
  async getOrCreate(tenantId: string): Promise<SandboxInstance> {
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
  async destroy(tenantId: string, sandboxId: string): Promise<void> {
    await this.manager.destroy(sandboxId);
    this.tenantPools.get(tenantId)?.delete(sandboxId);
  }

  /**
   * Destroy all sandboxes for a tenant.
   */
  async destroyAll(tenantId: string): Promise<number> {
    const count = await this.manager.destroyByTenant(tenantId);
    this.tenantPools.delete(tenantId);
    return count;
  }

  // ─── Queries ────────────────────────────────────────────

  getTenantSandboxCount(tenantId: string): number {
    return this.manager.listByTenant(tenantId).length;
  }

  getTenantSandboxes(tenantId: string): SandboxInstance[] {
    return this.manager.listByTenant(tenantId);
  }

  /**
   * Get usage stats for all tenants.
   */
  getUsageStats(): Array<{ tenantId: string; count: number; maxAllowed: number }> {
    const stats: Array<{ tenantId: string; count: number; maxAllowed: number }> = [];
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

  private resolvePolicy(policyName: string): SandboxPolicy {
    const policy = BUILTIN_POLICIES[policyName];
    if (!policy) {
      // Fallback to default if named policy not found
      return BUILTIN_POLICIES['default']!;
    }
    return JSON.parse(JSON.stringify(policy));
  }
}
