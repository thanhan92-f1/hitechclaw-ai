import type { SandboxPolicy, FilesystemPolicyRule, NetworkPolicyRule, ProcessPolicy } from '@hitechclaw/shared';
/** Default strict policy — minimal access, deny all network */
export declare const POLICY_STRICT: SandboxPolicy;
/** Default policy — read-only base, deny network, allow tmp write */
export declare const POLICY_DEFAULT: SandboxPolicy;
/** Permissive policy — for trusted built-in skills, allows specific network */
export declare const POLICY_PERMISSIVE: SandboxPolicy;
/** Gmail integration — only allow Google APIs */
export declare const POLICY_GMAIL: SandboxPolicy;
/** GitHub integration — only allow GitHub API */
export declare const POLICY_GITHUB: SandboxPolicy;
/** Slack integration */
export declare const POLICY_SLACK: SandboxPolicy;
/** Notion integration */
export declare const POLICY_NOTION: SandboxPolicy;
/** Web search (Tavily/Brave) */
export declare const POLICY_WEB_SEARCH: SandboxPolicy;
/** Telegram channel */
export declare const POLICY_TELEGRAM: SandboxPolicy;
/** Discord channel */
export declare const POLICY_DISCORD: SandboxPolicy;
/** Zalo channel */
export declare const POLICY_ZALO: SandboxPolicy;
/** Map of all built-in policies by name */
export declare const BUILTIN_POLICIES: Record<string, SandboxPolicy>;
/** Register additional policies (e.g., from gpu-sandbox) */
export declare function registerBuiltinPolicy(name: string, policy: SandboxPolicy): void;
/** Map integration IDs to their policies */
export declare const INTEGRATION_POLICIES: Record<string, SandboxPolicy>;
export declare class PolicyBuilder {
    private policy;
    constructor(baseName?: string);
    /** Start from a predefined policy template */
    static from(templateName: string): PolicyBuilder;
    /** Add a filesystem rule */
    allowPath(path: string, access?: FilesystemPolicyRule['access']): this;
    /** Add a network rule */
    allowHost(host: string, methods?: NetworkPolicyRule['methods']): this;
    /** Block a specific host */
    denyHost(host: string): this;
    /** Set default filesystem access */
    defaultFilesystemAccess(access: 'none' | 'read'): this;
    /** Set default network action */
    defaultNetworkAction(action: 'allow' | 'deny'): this;
    /** Set process policy */
    processPolicy(policy: Partial<ProcessPolicy>): this;
    /** Set inference routing */
    inference(provider: string, model: string, stripCredentials?: boolean): this;
    /** Build the final policy */
    build(): SandboxPolicy;
    /** Convert to OpenShell YAML format string */
    toYAML(): string;
}
/**
 * Load a SandboxPolicy from a YAML string (simple parser).
 * For production, use a proper YAML library.
 */
export declare function loadPolicyFromYAML(yaml: string): SandboxPolicy;
//# sourceMappingURL=policy-builder.d.ts.map