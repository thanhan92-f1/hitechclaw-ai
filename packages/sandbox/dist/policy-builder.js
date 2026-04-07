// ============================================================
// PolicyBuilder — Construct and load OpenShell YAML policies
// ============================================================
// ─── Pre-built Policy Templates ─────────────────────────────
/** Default strict policy — minimal access, deny all network */
export const POLICY_STRICT = {
    name: 'strict',
    version: '1.0.0',
    filesystem: {
        rules: [
            { path: '/tmp', access: 'read-write' },
            { path: '/home/sandbox', access: 'read-write' },
        ],
        defaultAccess: 'none',
    },
    network: {
        rules: [],
        defaultAction: 'deny',
    },
    process: {
        allowPrivilegeEscalation: false,
        maxProcesses: 10,
    },
};
/** Default policy — read-only base, deny network, allow tmp write */
export const POLICY_DEFAULT = {
    name: 'default',
    version: '1.0.0',
    filesystem: {
        rules: [
            { path: '/tmp', access: 'read-write' },
            { path: '/home/sandbox', access: 'read-write' },
            { path: '/usr', access: 'read' },
            { path: '/lib', access: 'read' },
        ],
        defaultAccess: 'read',
    },
    network: {
        rules: [],
        defaultAction: 'deny',
    },
    process: {
        allowPrivilegeEscalation: false,
        maxProcesses: 20,
    },
};
/** Permissive policy — for trusted built-in skills, allows specific network */
export const POLICY_PERMISSIVE = {
    name: 'permissive',
    version: '1.0.0',
    filesystem: {
        rules: [
            { path: '/tmp', access: 'read-write' },
            { path: '/home/sandbox', access: 'read-write' },
            { path: '/usr', access: 'read' },
            { path: '/lib', access: 'read' },
            { path: '/data', access: 'read' },
        ],
        defaultAccess: 'read',
    },
    network: {
        rules: [],
        defaultAction: 'deny',
    },
    process: {
        allowPrivilegeEscalation: false,
        maxProcesses: 50,
    },
};
// ─── Integration-Specific Policies ──────────────────────────
/** Gmail integration — only allow Google APIs */
export const POLICY_GMAIL = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'gmail', network: {
        rules: [
            { host: '*.googleapis.com', methods: ['GET', 'POST'], allow: true },
            { host: 'oauth2.googleapis.com', methods: ['POST'], allow: true },
            { host: 'accounts.google.com', methods: ['GET', 'POST'], allow: true },
        ],
        defaultAction: 'deny',
    } });
/** GitHub integration — only allow GitHub API */
export const POLICY_GITHUB = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'github', network: {
        rules: [
            { host: 'api.github.com', allow: true },
            { host: 'github.com', methods: ['GET'], allow: true },
            { host: 'raw.githubusercontent.com', methods: ['GET'], allow: true },
        ],
        defaultAction: 'deny',
    } });
/** Slack integration */
export const POLICY_SLACK = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'slack', network: {
        rules: [
            { host: 'slack.com', allow: true },
            { host: '*.slack.com', allow: true },
        ],
        defaultAction: 'deny',
    } });
/** Notion integration */
export const POLICY_NOTION = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'notion', network: {
        rules: [
            { host: 'api.notion.com', allow: true },
        ],
        defaultAction: 'deny',
    } });
/** Web search (Tavily/Brave) */
export const POLICY_WEB_SEARCH = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'web-search', network: {
        rules: [
            { host: 'api.tavily.com', allow: true },
            { host: 'api.search.brave.com', allow: true },
        ],
        defaultAction: 'deny',
    } });
// ─── Channel Policies ───────────────────────────────────────
/** Telegram channel */
export const POLICY_TELEGRAM = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'telegram', network: {
        rules: [
            { host: 'api.telegram.org', allow: true },
        ],
        defaultAction: 'deny',
    } });
/** Discord channel */
export const POLICY_DISCORD = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'discord', network: {
        rules: [
            { host: 'discord.com', allow: true },
            { host: '*.discord.com', allow: true },
            { host: 'gateway.discord.gg', allow: true },
        ],
        defaultAction: 'deny',
    } });
/** Zalo channel */
export const POLICY_ZALO = Object.assign(Object.assign({}, POLICY_DEFAULT), { name: 'zalo', network: {
        rules: [
            { host: 'openapi.zalo.me', allow: true },
            { host: 'oauth.zaloapp.com', allow: true },
        ],
        defaultAction: 'deny',
    } });
// ─── Policy Maps ────────────────────────────────────────────
/** Map of all built-in policies by name */
export const BUILTIN_POLICIES = {
    strict: POLICY_STRICT,
    default: POLICY_DEFAULT,
    permissive: POLICY_PERMISSIVE,
    gmail: POLICY_GMAIL,
    github: POLICY_GITHUB,
    slack: POLICY_SLACK,
    notion: POLICY_NOTION,
    'web-search': POLICY_WEB_SEARCH,
    telegram: POLICY_TELEGRAM,
    discord: POLICY_DISCORD,
    zalo: POLICY_ZALO,
    // ML/Inference policies are registered dynamically by gpu-sandbox module
};
/** Register additional policies (e.g., from gpu-sandbox) */
export function registerBuiltinPolicy(name, policy) {
    BUILTIN_POLICIES[name] = policy;
}
/** Map integration IDs to their policies */
export const INTEGRATION_POLICIES = {
    gmail: POLICY_GMAIL,
    'google-calendar': POLICY_GMAIL,
    github: POLICY_GITHUB,
    slack: POLICY_SLACK,
    'slack-api': POLICY_SLACK,
    notion: POLICY_NOTION,
    tavily: POLICY_WEB_SEARCH,
    brave: POLICY_WEB_SEARCH,
    telegram: POLICY_TELEGRAM,
    discord: POLICY_DISCORD,
    zalo: POLICY_ZALO,
};
// ─── PolicyBuilder Class ────────────────────────────────────
export class PolicyBuilder {
    constructor(baseName = 'custom') {
        this.policy = {
            name: baseName,
            version: '1.0.0',
            filesystem: { rules: [], defaultAccess: 'none' },
            network: { rules: [], defaultAction: 'deny' },
            process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
        };
    }
    /** Start from a predefined policy template */
    static from(templateName) {
        const template = BUILTIN_POLICIES[templateName];
        if (!template)
            throw new Error(`Unknown policy template: ${templateName}`);
        const builder = new PolicyBuilder(templateName);
        builder.policy = JSON.parse(JSON.stringify(template));
        return builder;
    }
    /** Add a filesystem rule */
    allowPath(path, access = 'read') {
        this.policy.filesystem.rules.push({ path, access });
        return this;
    }
    /** Add a network rule */
    allowHost(host, methods) {
        this.policy.network.rules.push({ host, methods, allow: true });
        return this;
    }
    /** Block a specific host */
    denyHost(host) {
        this.policy.network.rules.push({ host, allow: false });
        return this;
    }
    /** Set default filesystem access */
    defaultFilesystemAccess(access) {
        this.policy.filesystem.defaultAccess = access;
        return this;
    }
    /** Set default network action */
    defaultNetworkAction(action) {
        this.policy.network.defaultAction = action;
        return this;
    }
    /** Set process policy */
    processPolicy(policy) {
        this.policy.process = Object.assign(Object.assign({}, this.policy.process), policy);
        return this;
    }
    /** Set inference routing */
    inference(provider, model, stripCredentials = true) {
        this.policy.inference = { provider, model, stripCredentials };
        return this;
    }
    /** Build the final policy */
    build() {
        return JSON.parse(JSON.stringify(this.policy));
    }
    /** Convert to OpenShell YAML format string */
    toYAML() {
        var _a, _b;
        const p = this.policy;
        const lines = [
            `# OpenShell Policy: ${p.name}`,
            `name: ${p.name}`,
            `version: "${p.version}"`,
            '',
            'filesystem:',
            `  default: ${p.filesystem.defaultAccess}`,
            '  rules:',
        ];
        for (const rule of p.filesystem.rules) {
            lines.push(`    - path: "${rule.path}"`);
            lines.push(`      access: ${rule.access}`);
        }
        lines.push('');
        lines.push('network:');
        lines.push(`  default: ${p.network.defaultAction}`);
        lines.push('  rules:');
        for (const rule of p.network.rules) {
            lines.push(`    - host: "${rule.host}"`);
            lines.push(`      allow: ${rule.allow}`);
            if ((_a = rule.methods) === null || _a === void 0 ? void 0 : _a.length) {
                lines.push(`      methods: [${rule.methods.join(', ')}]`);
            }
            if ((_b = rule.pathPatterns) === null || _b === void 0 ? void 0 : _b.length) {
                lines.push(`      paths: [${rule.pathPatterns.map((pp) => `"${pp}"`).join(', ')}]`);
            }
        }
        lines.push('');
        lines.push('process:');
        lines.push(`  allow_privilege_escalation: ${p.process.allowPrivilegeEscalation}`);
        if (p.process.maxProcesses) {
            lines.push(`  max_processes: ${p.process.maxProcesses}`);
        }
        if (p.inference) {
            lines.push('');
            lines.push('inference:');
            lines.push(`  provider: ${p.inference.provider}`);
            lines.push(`  model: ${p.inference.model}`);
            lines.push(`  strip_credentials: ${p.inference.stripCredentials}`);
        }
        return lines.join('\n') + '\n';
    }
}
/**
 * Load a SandboxPolicy from a YAML string (simple parser).
 * For production, use a proper YAML library.
 */
export function loadPolicyFromYAML(yaml) {
    var _a, _b, _c, _d, _e, _f;
    // Simple line-by-line parsing for the structured format
    const policy = {
        name: 'loaded',
        version: '1.0.0',
        filesystem: { rules: [], defaultAccess: 'none' },
        network: { rules: [], defaultAction: 'deny' },
        process: { allowPrivilegeEscalation: false },
    };
    const lines = yaml.split('\n');
    let section = '';
    let subsection = '';
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        if (line.startsWith('name:')) {
            policy.name = (_b = (_a = line.split(':')[1]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : 'loaded';
        }
        else if (line.startsWith('version:')) {
            policy.version = (_d = (_c = line.split(':')[1]) === null || _c === void 0 ? void 0 : _c.trim().replace(/"/g, '')) !== null && _d !== void 0 ? _d : '1.0.0';
        }
        else if (line === 'filesystem:') {
            section = 'filesystem';
        }
        else if (line === 'network:') {
            section = 'network';
        }
        else if (line === 'process:') {
            section = 'process';
        }
        else if (line === 'inference:') {
            section = 'inference';
        }
        else if (line.startsWith('default:') && section === 'filesystem') {
            policy.filesystem.defaultAccess = (_e = line.split(':')[1]) === null || _e === void 0 ? void 0 : _e.trim();
        }
        else if (line.startsWith('default:') && section === 'network') {
            policy.network.defaultAction = (_f = line.split(':')[1]) === null || _f === void 0 ? void 0 : _f.trim();
        }
        else if (line === 'rules:') {
            subsection = 'rules';
        }
    }
    return policy;
}
