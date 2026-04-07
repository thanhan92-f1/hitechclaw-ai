// ============================================================
// SandboxManager — OpenShell sandbox lifecycle management
// ============================================================
// Manages creation, connection, execution, and destruction of
// sandboxed environments via OpenShell CLI/API.

import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  SandboxConfig,
  SandboxInstance,
  SandboxExecutionResult,
  SandboxStatus,
  SandboxAuditEntry,
  SandboxPolicy,
} from '@hitechclaw/shared';

const execFileAsync = promisify(execFile);

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

export class SandboxManager {
  private readonly binary: string;
  private readonly gatewayUrl?: string;
  private readonly maxPoolSize: number;
  private readonly idleTimeoutMs: number;
  private readonly mode: 'local' | 'remote';
  private readonly onAudit?: (entry: SandboxAuditEntry) => void;

  /** Active sandbox instances */
  private readonly instances = new Map<string, SandboxInstance>();

  /** Idle timers per sandbox */
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: SandboxManagerOptions = {}) {
    this.binary = options.binaryPath ?? 'openshell';
    this.gatewayUrl = options.gatewayUrl;
    this.maxPoolSize = options.maxPoolSize ?? 50;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 5 * 60_000;
    this.mode = options.mode ?? 'local';
    this.onAudit = options.onAudit;
  }

  // ─── Lifecycle ──────────────────────────────────────────

  /**
   * Create a new sandbox container with the given config.
   * Returns the sandbox instance once ready.
   */
  async create(config: SandboxConfig): Promise<SandboxInstance> {
    if (this.instances.size >= this.maxPoolSize) {
      throw new Error(`Sandbox pool full (max ${this.maxPoolSize}). Destroy idle sandboxes first.`);
    }

    const instance: SandboxInstance = {
      id: config.id || randomUUID(),
      name: config.name,
      tenantId: config.tenantId,
      status: 'creating',
      image: config.image ?? 'base',
      policy: config.policy,
      gpu: config.gpu ?? false,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      resources: config.resources,
    };

    this.instances.set(instance.id, instance);

    try {
      const args = ['sandbox', 'create', '--name', instance.name];

      if (config.image && config.image !== 'base') {
        args.push('--from', config.image);
      }

      if (config.gpu) {
        args.push('--gpu');
      }

      // Resource limits
      if (config.resources?.cpuLimit) {
        args.push('--cpu', config.resources.cpuLimit);
      }
      if (config.resources?.memoryLimit) {
        args.push('--memory', config.resources.memoryLimit);
      }

      await this.exec(args, config.timeoutMs ?? 60_000);

      instance.status = 'ready';
      this.audit(instance.id, config.tenantId, 'create', { image: instance.image, gpu: instance.gpu });
      this.resetIdleTimer(instance.id);

      return instance;
    } catch (err) {
      instance.status = 'error';
      this.instances.delete(instance.id);
      throw err;
    }
  }

  /**
   * Execute a command inside an existing sandbox.
   * Used for running tool handlers in isolation.
   */
  async execute(sandboxId: string, command: string, stdin?: string): Promise<SandboxExecutionResult> {
    const instance = this.instances.get(sandboxId);
    if (!instance) throw new Error(`Sandbox ${sandboxId} not found`);
    if (instance.status !== 'ready' && instance.status !== 'running') {
      throw new Error(`Sandbox ${sandboxId} is ${instance.status}, cannot execute`);
    }

    instance.status = 'running';
    instance.lastActivityAt = new Date().toISOString();
    this.resetIdleTimer(sandboxId);

    const start = Date.now();

    try {
      const args = ['sandbox', 'exec', instance.name, '--', 'sh', '-c', command];
      const { stdout, stderr } = await this.exec(args, instance.resources?.cpuLimit ? 30_000 : 15_000, stdin);

      instance.status = 'ready';

      const result: SandboxExecutionResult = {
        success: true,
        output: stdout.trim(),
        stderr: stderr?.trim() || undefined,
        exitCode: 0,
        durationMs: Date.now() - start,
      };

      this.audit(sandboxId, instance.tenantId, 'execute', {
        command: command.slice(0, 200),
        durationMs: result.durationMs,
      });

      return result;
    } catch (err) {
      instance.status = 'ready';

      const result: SandboxExecutionResult = {
        success: false,
        output: null,
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: Date.now() - start,
      };

      this.audit(sandboxId, instance.tenantId, 'execute', {
        command: command.slice(0, 200),
        error: result.stderr,
        durationMs: result.durationMs,
      });

      return result;
    }
  }

  /**
   * Apply or update a policy on a running sandbox.
   * Network and inference policies can be hot-reloaded.
   */
  async applyPolicy(sandboxId: string, policy: SandboxPolicy): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance) throw new Error(`Sandbox ${sandboxId} not found`);

    // Write policy to temp file and apply
    const policyJson = JSON.stringify(policy, null, 2);
    const encodedPolicy = Buffer.from(policyJson).toString('base64');

    await this.exec([
      'policy', 'set', instance.name,
      '--policy-json', encodedPolicy,
      '--wait',
    ]);

    instance.policy = policy;
    this.audit(sandboxId, instance.tenantId, 'policy-update', { policyName: policy.name });
  }

  /**
   * Destroy a sandbox and clean up resources.
   */
  async destroy(sandboxId: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance) return;

    instance.status = 'stopping';

    try {
      await this.exec(['sandbox', 'delete', instance.name, '--force']);
    } catch {
      // Best-effort cleanup
    }

    instance.status = 'stopped';
    this.clearIdleTimer(sandboxId);
    this.instances.delete(sandboxId);
    this.audit(sandboxId, instance.tenantId, 'destroy', {});
  }

  /**
   * Destroy all sandboxes for a given tenant.
   */
  async destroyByTenant(tenantId: string): Promise<number> {
    const tenantInstances = [...this.instances.values()].filter((i) => i.tenantId === tenantId);
    let destroyed = 0;
    for (const instance of tenantInstances) {
      await this.destroy(instance.id);
      destroyed++;
    }
    return destroyed;
  }

  // ─── Queries ────────────────────────────────────────────

  getInstance(sandboxId: string): SandboxInstance | undefined {
    return this.instances.get(sandboxId);
  }

  listInstances(): SandboxInstance[] {
    return [...this.instances.values()];
  }

  listByTenant(tenantId: string): SandboxInstance[] {
    return [...this.instances.values()].filter((i) => i.tenantId === tenantId);
  }

  getPoolStats(): { total: number; maxSize: number; byStatus: Record<SandboxStatus, number> } {
    const byStatus: Record<SandboxStatus, number> = {
      creating: 0, ready: 0, running: 0, stopping: 0, stopped: 0, error: 0,
    };
    for (const instance of this.instances.values()) {
      byStatus[instance.status]++;
    }
    return { total: this.instances.size, maxSize: this.maxPoolSize, byStatus };
  }

  // ─── Gateway Bootstrap ──────────────────────────────────

  /**
   * Initialize OpenShell gateway (runs K3s cluster inside Docker).
   * Should be called once at server startup.
   */
  async bootstrapGateway(): Promise<void> {
    try {
      await this.exec(['gateway', 'status'], 10_000);
    } catch {
      // Gateway not running — bootstrap it
      await this.exec(['gateway', 'create'], 120_000);
    }
  }

  // ─── Internal ───────────────────────────────────────────

  private async exec(
    args: string[],
    timeoutMs: number = 30_000,
    stdin?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execFileAsync(this.binary, args, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          ...(this.gatewayUrl ? { OPENSHELL_GATEWAY_URL: this.gatewayUrl } : {}),
        },
        ...(stdin ? {} : {}),
      });
      return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      if (execErr.stderr) {
        throw new Error(`OpenShell error: ${execErr.stderr.trim()}`);
      }
      throw err;
    }
  }

  private audit(sandboxId: string, tenantId: string, action: SandboxAuditEntry['action'], details: Record<string, unknown>): void {
    this.onAudit?.({
      sandboxId,
      tenantId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  private resetIdleTimer(sandboxId: string): void {
    this.clearIdleTimer(sandboxId);
    const timer = setTimeout(() => {
      this.destroy(sandboxId).catch(() => {});
    }, this.idleTimeoutMs);
    // Don't block Node.js shutdown
    timer.unref();
    this.idleTimers.set(sandboxId, timer);
  }

  private clearIdleTimer(sandboxId: string): void {
    const timer = this.idleTimers.get(sandboxId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(sandboxId);
    }
  }

  /**
   * Clean up all sandboxes. Call during graceful shutdown.
   */
  async shutdown(): Promise<void> {
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    const ids = [...this.instances.keys()];
    for (const id of ids) {
      await this.destroy(id);
    }
  }
}
