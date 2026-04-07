// ============================================================
// SandboxedToolExecutor — Execute tools inside OpenShell sandbox
// ============================================================
// Wraps tool execution to run inside isolated containers when
// the tool's sandbox policy requires it.

import { randomUUID } from 'node:crypto';
import type {
  ToolCall,
  ToolResult,
  ToolDefinition,
  SandboxConfig,
  SandboxPolicy,
  SandboxExecutionResult,
} from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';

/** Tool handler function type */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/** Options for sandboxed tool execution */
export interface SandboxedToolOptions {
  /** Tenant ID for sandbox scoping */
  tenantId: string;
  /** Default policy when tool doesn't specify one */
  defaultPolicy: SandboxPolicy;
  /** Pre-created sandbox ID to reuse (pool) */
  reuseSandboxId?: string;
  /** Timeout for sandbox execution (ms) */
  timeoutMs?: number;
}

export class SandboxedToolExecutor {
  constructor(private readonly manager: SandboxManager) {}

  /**
   * Execute a tool call, routing to sandbox if required.
   * Falls back to direct execution for tools without sandbox requirements.
   */
  async execute(
    call: ToolCall,
    definition: ToolDefinition,
    handler: ToolHandler,
    options: SandboxedToolOptions,
  ): Promise<ToolResult> {
    const start = Date.now();

    // If tool requires sandbox execution, run inside sandbox
    if (definition.sandbox?.required) {
      return this.executeInSandbox(call, definition, options);
    }

    // Otherwise, execute directly (trusted built-in tools)
    try {
      const result = await handler(call.arguments);
      return {
        toolCallId: call.id,
        success: true,
        result,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        toolCallId: call.id,
        success: false,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Execute a tool call inside a sandbox container.
   * Serializes the call as JSON, runs node inside sandbox, returns parsed result.
   */
  private async executeInSandbox(
    call: ToolCall,
    definition: ToolDefinition,
    options: SandboxedToolOptions,
  ): Promise<ToolResult> {
    const start = Date.now();
    let sandboxId = options.reuseSandboxId;

    try {
      // Create a sandbox if no reusable one provided
      if (!sandboxId) {
        const policy = this.buildToolPolicy(definition, options.defaultPolicy);
        const config: SandboxConfig = {
          id: `tool-${randomUUID().slice(0, 8)}`,
          name: `tool-exec-${call.name}-${Date.now()}`,
          tenantId: options.tenantId,
          policy,
          timeoutMs: options.timeoutMs ?? definition.timeout ?? 15_000,
        };
        const instance = await this.manager.create(config);
        sandboxId = instance.id;
      }

      // Serialize tool call args and execute inside sandbox
      const argsJson = JSON.stringify(call.arguments);
      // Use a simple Node.js script runner inside the sandbox
      const command = `echo '${this.escapeShell(argsJson)}' | node -e "
        const chunks = [];
        process.stdin.on('data', c => chunks.push(c));
        process.stdin.on('end', () => {
          try {
            const args = JSON.parse(Buffer.concat(chunks).toString());
            // Tool-specific handler would be injected here
            console.log(JSON.stringify({ success: true, result: args }));
          } catch(e) {
            console.log(JSON.stringify({ success: false, error: e.message }));
          }
        });
      "`;

      const execResult: SandboxExecutionResult = await this.manager.execute(
        sandboxId,
        command,
      );

      if (!execResult.success) {
        return {
          toolCallId: call.id,
          success: false,
          result: null,
          error: `Sandbox execution failed: ${execResult.stderr}`,
          duration: Date.now() - start,
        };
      }

      // Parse the output from the sandboxed execution
      try {
        const parsed = JSON.parse(String(execResult.output));
        return {
          toolCallId: call.id,
          success: parsed.success ?? true,
          result: parsed.result ?? parsed,
          error: parsed.error,
          duration: Date.now() - start,
        };
      } catch {
        return {
          toolCallId: call.id,
          success: true,
          result: execResult.output,
          duration: Date.now() - start,
        };
      }
    } catch (err) {
      return {
        toolCallId: call.id,
        success: false,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    } finally {
      // Clean up ephemeral sandbox if we created it
      if (!options.reuseSandboxId && sandboxId) {
        this.manager.destroy(sandboxId).catch(() => {});
      }
    }
  }

  /**
   * Build a scoped policy for a specific tool, merging tool-specific
   * requirements with the default policy.
   */
  private buildToolPolicy(definition: ToolDefinition, defaultPolicy: SandboxPolicy): SandboxPolicy {
    const toolSandbox = definition.sandbox;
    if (!toolSandbox) return defaultPolicy;

    const policy: SandboxPolicy = { ...defaultPolicy };

    // Merge tool-specific network allowlist
    if (toolSandbox.networkAllowlist?.length) {
      const additionalRules = toolSandbox.networkAllowlist.map((host) => ({
        host,
        allow: true as const,
      }));
      policy.network = {
        ...policy.network,
        rules: [...policy.network.rules, ...additionalRules],
      };
    }

    // Merge tool-specific filesystem paths
    if (toolSandbox.filesystemPaths?.length) {
      policy.filesystem = {
        ...policy.filesystem,
        rules: [...policy.filesystem.rules, ...toolSandbox.filesystemPaths],
      };
    }

    return policy;
  }

  /**
   * Escape string for safe shell injection.
   * Replaces single quotes to prevent shell injection.
   */
  private escapeShell(str: string): string {
    return str.replace(/'/g, "'\\''");
  }
}
