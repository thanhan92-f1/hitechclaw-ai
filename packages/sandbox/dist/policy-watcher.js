// ============================================================
// Policy Watcher — Hot-reload sandbox policies from YAML files
// ============================================================
// Watches deploy/policies/ directory and reloads policies when
// files change. Notifies running sandboxes of policy updates.
import { watch, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { loadPolicyFromYAML, BUILTIN_POLICIES } from './policy-builder.js';
export class PolicyWatcher {
    watcher = null;
    policyDir;
    onPolicyUpdate;
    onError;
    constructor(options) {
        this.policyDir = options.policyDir;
        this.onPolicyUpdate = options.onPolicyUpdate;
        this.onError = options.onError;
    }
    /**
     * Load all YAML policies from the directory.
     * Returns the count of policies loaded.
     */
    loadAll() {
        let count = 0;
        try {
            const files = readdirSync(this.policyDir);
            for (const file of files) {
                if (extname(file) !== '.yaml' && extname(file) !== '.yml')
                    continue;
                const filePath = join(this.policyDir, file);
                if (!statSync(filePath).isFile())
                    continue;
                try {
                    const yaml = readFileSync(filePath, 'utf8');
                    const policy = loadPolicyFromYAML(yaml);
                    const name = basename(file, extname(file));
                    policy.name = name;
                    BUILTIN_POLICIES[name] = policy;
                    count++;
                }
                catch (err) {
                    this.onError?.(err instanceof Error ? err : new Error(String(err)));
                }
            }
        }
        catch (err) {
            this.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
        return count;
    }
    /**
     * Start watching the policy directory for changes.
     */
    start() {
        if (this.watcher)
            return;
        // Initial load
        this.loadAll();
        try {
            this.watcher = watch(this.policyDir, (eventType, filename) => {
                if (!filename)
                    return;
                if (extname(filename) !== '.yaml' && extname(filename) !== '.yml')
                    return;
                // Debounce — file system events can fire multiple times
                setTimeout(() => {
                    try {
                        const filePath = join(this.policyDir, filename);
                        const yaml = readFileSync(filePath, 'utf8');
                        const policy = loadPolicyFromYAML(yaml);
                        const name = basename(filename, extname(filename));
                        policy.name = name;
                        BUILTIN_POLICIES[name] = policy;
                        this.onPolicyUpdate?.(name, policy);
                    }
                    catch (err) {
                        this.onError?.(err instanceof Error ? err : new Error(String(err)));
                    }
                }, 200);
            });
        }
        catch (err) {
            this.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    }
    /**
     * Stop watching.
     */
    stop() {
        this.watcher?.close();
        this.watcher = null;
    }
}
//# sourceMappingURL=policy-watcher.js.map