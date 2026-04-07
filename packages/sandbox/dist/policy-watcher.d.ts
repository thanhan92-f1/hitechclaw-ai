import type { SandboxPolicy } from '@hitechclaw/shared';
export interface PolicyWatcherOptions {
    /** Directory to watch for YAML policy files */
    policyDir: string;
    /** Callback when a policy is updated */
    onPolicyUpdate?: (name: string, policy: SandboxPolicy) => void;
    /** Callback for errors */
    onError?: (error: Error) => void;
}
export declare class PolicyWatcher {
    private watcher;
    private readonly policyDir;
    private readonly onPolicyUpdate?;
    private readonly onError?;
    constructor(options: PolicyWatcherOptions);
    /**
     * Load all YAML policies from the directory.
     * Returns the count of policies loaded.
     */
    loadAll(): number;
    /**
     * Start watching the policy directory for changes.
     */
    start(): void;
    /**
     * Stop watching.
     */
    stop(): void;
}
//# sourceMappingURL=policy-watcher.d.ts.map