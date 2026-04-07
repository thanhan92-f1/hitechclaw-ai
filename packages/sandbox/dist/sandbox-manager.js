// ============================================================
// SandboxManager — OpenShell sandbox lifecycle management
// ============================================================
// Manages creation, connection, execution, and destruction of
// sandboxed environments via OpenShell CLI/API.
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export class SandboxManager {
    constructor(options = {}) {
        var _a, _b, _c, _d;
        /** Active sandbox instances */
        this.instances = new Map();
        /** Idle timers per sandbox */
        this.idleTimers = new Map();
        this.binary = (_a = options.binaryPath) !== null && _a !== void 0 ? _a : 'openshell';
        this.gatewayUrl = options.gatewayUrl;
        this.maxPoolSize = (_b = options.maxPoolSize) !== null && _b !== void 0 ? _b : 50;
        this.idleTimeoutMs = (_c = options.idleTimeoutMs) !== null && _c !== void 0 ? _c : 5 * 60000;
        this.mode = (_d = options.mode) !== null && _d !== void 0 ? _d : 'local';
        this.onAudit = options.onAudit;
    }
    // ─── Lifecycle ──────────────────────────────────────────
    /**
     * Create a new sandbox container with the given config.
     * Returns the sandbox instance once ready.
     */
    async create(config) {
        var _a, _b, _c, _d, _e;
        if (this.instances.size >= this.maxPoolSize) {
            throw new Error(`Sandbox pool full (max ${this.maxPoolSize}). Destroy idle sandboxes first.`);
        }
        const instance = {
            id: config.id || randomUUID(),
            name: config.name,
            tenantId: config.tenantId,
            status: 'creating',
            image: (_a = config.image) !== null && _a !== void 0 ? _a : 'base',
            policy: config.policy,
            gpu: (_b = config.gpu) !== null && _b !== void 0 ? _b : false,
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
            if ((_c = config.resources) === null || _c === void 0 ? void 0 : _c.cpuLimit) {
                args.push('--cpu', config.resources.cpuLimit);
            }
            if ((_d = config.resources) === null || _d === void 0 ? void 0 : _d.memoryLimit) {
                args.push('--memory', config.resources.memoryLimit);
            }
            await this.exec(args, (_e = config.timeoutMs) !== null && _e !== void 0 ? _e : 60000);
            instance.status = 'ready';
            this.audit(instance.id, config.tenantId, 'create', { image: instance.image, gpu: instance.gpu });
            this.resetIdleTimer(instance.id);
            return instance;
        }
        catch (err) {
            instance.status = 'error';
            this.instances.delete(instance.id);
            throw err;
        }
    }
    /**
     * Execute a command inside an existing sandbox.
     * Used for running tool handlers in isolation.
     */
    async execute(sandboxId, command, stdin) {
        var _a;
        const instance = this.instances.get(sandboxId);
        if (!instance)
            throw new Error(`Sandbox ${sandboxId} not found`);
        if (instance.status !== 'ready' && instance.status !== 'running') {
            throw new Error(`Sandbox ${sandboxId} is ${instance.status}, cannot execute`);
        }
        instance.status = 'running';
        instance.lastActivityAt = new Date().toISOString();
        this.resetIdleTimer(sandboxId);
        const start = Date.now();
        try {
            const args = ['sandbox', 'exec', instance.name, '--', 'sh', '-c', command];
            const { stdout, stderr } = await this.exec(args, ((_a = instance.resources) === null || _a === void 0 ? void 0 : _a.cpuLimit) ? 30000 : 15000, stdin);
            instance.status = 'ready';
            const result = {
                success: true,
                output: stdout.trim(),
                stderr: (stderr === null || stderr === void 0 ? void 0 : stderr.trim()) || undefined,
                exitCode: 0,
                durationMs: Date.now() - start,
            };
            this.audit(sandboxId, instance.tenantId, 'execute', {
                command: command.slice(0, 200),
                durationMs: result.durationMs,
            });
            return result;
        }
        catch (err) {
            instance.status = 'ready';
            const result = {
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
    async applyPolicy(sandboxId, policy) {
        const instance = this.instances.get(sandboxId);
        if (!instance)
            throw new Error(`Sandbox ${sandboxId} not found`);
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
    async destroy(sandboxId) {
        const instance = this.instances.get(sandboxId);
        if (!instance)
            return;
        instance.status = 'stopping';
        try {
            await this.exec(['sandbox', 'delete', instance.name, '--force']);
        }
        catch (_a) {
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
    async destroyByTenant(tenantId) {
        const tenantInstances = [...this.instances.values()].filter((i) => i.tenantId === tenantId);
        let destroyed = 0;
        for (const instance of tenantInstances) {
            await this.destroy(instance.id);
            destroyed++;
        }
        return destroyed;
    }
    // ─── Queries ────────────────────────────────────────────
    getInstance(sandboxId) {
        return this.instances.get(sandboxId);
    }
    listInstances() {
        return [...this.instances.values()];
    }
    listByTenant(tenantId) {
        return [...this.instances.values()].filter((i) => i.tenantId === tenantId);
    }
    getPoolStats() {
        const byStatus = {
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
    async bootstrapGateway() {
        try {
            await this.exec(['gateway', 'status'], 10000);
        }
        catch (_a) {
            // Gateway not running — bootstrap it
            await this.exec(['gateway', 'create'], 120000);
        }
    }
    // ─── Internal ───────────────────────────────────────────
    async exec(args, timeoutMs = 30000, stdin) {
        var _a, _b;
        try {
            const result = await execFileAsync(this.binary, args, Object.assign({ timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: Object.assign(Object.assign({}, process.env), (this.gatewayUrl ? { OPENSHELL_GATEWAY_URL: this.gatewayUrl } : {})) }, (stdin ? {} : {})));
            return { stdout: (_a = result.stdout) !== null && _a !== void 0 ? _a : '', stderr: (_b = result.stderr) !== null && _b !== void 0 ? _b : '' };
        }
        catch (err) {
            const execErr = err;
            if (execErr.stderr) {
                throw new Error(`OpenShell error: ${execErr.stderr.trim()}`);
            }
            throw err;
        }
    }
    audit(sandboxId, tenantId, action, details) {
        var _a;
        (_a = this.onAudit) === null || _a === void 0 ? void 0 : _a.call(this, {
            sandboxId,
            tenantId,
            action,
            details,
            timestamp: new Date().toISOString(),
        });
    }
    resetIdleTimer(sandboxId) {
        this.clearIdleTimer(sandboxId);
        const timer = setTimeout(() => {
            this.destroy(sandboxId).catch(() => { });
        }, this.idleTimeoutMs);
        // Don't block Node.js shutdown
        timer.unref();
        this.idleTimers.set(sandboxId, timer);
    }
    clearIdleTimer(sandboxId) {
        const timer = this.idleTimers.get(sandboxId);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(sandboxId);
        }
    }
    /**
     * Clean up all sandboxes. Call during graceful shutdown.
     */
    async shutdown() {
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
