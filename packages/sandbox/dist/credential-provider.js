// ============================================================
// CredentialProviderAdapter — OpenShell credential injection
// ============================================================
// Wraps integration credentials into OpenShell providers that
// inject credentials as environment variables into sandboxes.
// Credentials never touch the sandbox filesystem.
import { randomUUID } from 'node:crypto';
/** Environment variable mapping for credential providers */
const INTEGRATION_ENV_MAP = {
    gmail: ['GOOGLE_ACCESS_TOKEN', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    'google-calendar': ['GOOGLE_ACCESS_TOKEN', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    github: ['GITHUB_TOKEN'],
    slack: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'],
    'slack-api': ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'],
    notion: ['NOTION_API_KEY'],
    telegram: ['TELEGRAM_BOT_TOKEN'],
    discord: ['DISCORD_BOT_TOKEN'],
    tavily: ['TAVILY_API_KEY'],
    brave: ['BRAVE_API_KEY'],
    huggingface: ['HUGGINGFACE_TOKEN'],
    wandb: ['WANDB_API_KEY'],
    imessage: [],
};
export class CredentialProviderAdapter {
    constructor(manager) {
        this.manager = manager;
    }
    /**
     * Convert integration credentials to an OpenShell SandboxProvider.
     * The provider tells OpenShell which env vars to inject.
     */
    toProvider(creds) {
        var _a;
        const envVars = (_a = INTEGRATION_ENV_MAP[creds.integrationId]) !== null && _a !== void 0 ? _a : [];
        let providerType = 'api-key';
        if (creds.oauthTokens) {
            providerType = 'oauth2';
        }
        else if (creds.credentials['token']) {
            providerType = 'bearer';
        }
        return {
            id: `hitechclaw-${creds.integrationId}-${randomUUID().slice(0, 8)}`,
            name: `hitechclaw-${creds.integrationId}`,
            type: providerType,
            envVars,
        };
    }
    /**
     * Build the environment variables map for credential injection.
     * Returns a Record<envVarName, value> for the sandbox runtime.
     * WARNING: This data must never be logged or persisted in plaintext.
     */
    buildEnvVars(creds) {
        var _a;
        const env = {};
        // OAuth tokens
        if (creds.oauthTokens) {
            const prefix = this.getEnvPrefix(creds.integrationId);
            if (creds.oauthTokens.accessToken) {
                env[`${prefix}_ACCESS_TOKEN`] = creds.oauthTokens.accessToken;
            }
            if (creds.oauthTokens.refreshToken) {
                env[`${prefix}_REFRESH_TOKEN`] = creds.oauthTokens.refreshToken;
            }
        }
        // API key credentials
        const credMap = creds.credentials;
        const envVarNames = (_a = INTEGRATION_ENV_MAP[creds.integrationId]) !== null && _a !== void 0 ? _a : [];
        for (const envVar of envVarNames) {
            // Try to match credential keys to env var names
            const keyName = envVar.toLowerCase().replace(/_/g, '');
            for (const [key, value] of Object.entries(credMap)) {
                if (key.toLowerCase().replace(/[_-]/g, '').includes(keyName.replace(/[a-z]*_/g, '').toLowerCase())) {
                    env[envVar] = String(value);
                    break;
                }
            }
            // Direct match
            if (!env[envVar] && credMap[envVar]) {
                env[envVar] = String(credMap[envVar]);
            }
        }
        return env;
    }
    /**
     * Register credential providers with OpenShell for a sandbox.
     * Providers are injected at sandbox creation time.
     */
    async registerForSandbox(sandboxName, credentials) {
        const providers = [];
        for (const creds of credentials) {
            const provider = this.toProvider(creds);
            providers.push(provider);
        }
        return providers;
    }
    getEnvPrefix(integrationId) {
        var _a;
        const prefixes = {
            gmail: 'GOOGLE',
            'google-calendar': 'GOOGLE',
            github: 'GITHUB',
            slack: 'SLACK',
            'slack-api': 'SLACK',
            notion: 'NOTION',
            telegram: 'TELEGRAM',
            discord: 'DISCORD',
            tavily: 'TAVILY',
            brave: 'BRAVE',
            huggingface: 'HUGGINGFACE',
            wandb: 'WANDB',
        };
        return (_a = prefixes[integrationId]) !== null && _a !== void 0 ? _a : integrationId.toUpperCase().replace(/-/g, '_');
    }
}
