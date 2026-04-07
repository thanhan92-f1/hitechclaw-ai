// ============================================================
// Policy Watcher — Hot-reload sandbox policies from YAML files
// ============================================================
// Watches deploy/policies/ directory and reloads policies when
// files change. Notifies running sandboxes of policy updates.

import { watch, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type { SandboxPolicy } from '@hitechclaw/shared';
import { loadPolicyFromYAML, BUILTIN_POLICIES } from './policy-builder.js';

export interface PolicyWatcherOptions {
  /** Directory to watch for YAML policy files */
  policyDir: string;
  /** Callback when a policy is updated */
  onPolicyUpdate?: (name: string, policy: SandboxPolicy) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export class PolicyWatcher {
  private watcher: ReturnType<typeof watch> | null = null;
  private readonly policyDir: string;
  private readonly onPolicyUpdate?: (name: string, policy: SandboxPolicy) => void;
  private readonly onError?: (error: Error) => void;

  constructor(options: PolicyWatcherOptions) {
    this.policyDir = options.policyDir;
    this.onPolicyUpdate = options.onPolicyUpdate;
    this.onError = options.onError;
  }

  /**
   * Load all YAML policies from the directory.
   * Returns the count of policies loaded.
   */
  loadAll(): number {
    let count = 0;
    try {
      const files = readdirSync(this.policyDir);
      for (const file of files) {
        if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;
        const filePath = join(this.policyDir, file);
        if (!statSync(filePath).isFile()) continue;

        try {
          const yaml = readFileSync(filePath, 'utf8');
          const policy = loadPolicyFromYAML(yaml);
          const name = basename(file, extname(file));
          policy.name = name;
          BUILTIN_POLICIES[name] = policy;
          count++;
        } catch (err) {
          this.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
    return count;
  }

  /**
   * Start watching the policy directory for changes.
   */
  start(): void {
    if (this.watcher) return;

    // Initial load
    this.loadAll();

    try {
      this.watcher = watch(this.policyDir, (eventType, filename) => {
        if (!filename) return;
        if (extname(filename) !== '.yaml' && extname(filename) !== '.yml') return;

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
          } catch (err) {
            this.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        }, 200);
      });
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stop watching.
   */
  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
