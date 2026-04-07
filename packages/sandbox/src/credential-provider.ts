// ============================================================
// CredentialProviderAdapter — OpenShell credential injection
// ============================================================
// Wraps integration credentials into OpenShell providers that
// inject credentials as environment variables into sandboxes.
// Credentials never touch the sandbox filesystem.

import { randomUUID } from 'node:crypto';
import type { SandboxProvider } from '@hitechclaw/shared';
import type { SandboxManager } from './sandbox-manager.js';

/** Raw credential data from integration_connections table */
export interface IntegrationCredentials {
  integrationId: string;
  credentials: Record<string, unknown>;
  oauthTokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  };
}

/** Environment variable mapping for credential providers */
const INTEGRATION_ENV_MAP: Record<string, string[]> = {
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
  constructor(private readonly manager: SandboxManager) {}

  /**
   * Convert integration credentials to an OpenShell SandboxProvider.
   * The provider tells OpenShell which env vars to inject.
   */
  toProvider(creds: IntegrationCredentials): SandboxProvider {
    const envVars = INTEGRATION_ENV_MAP[creds.integrationId] ?? [];

    let providerType: SandboxProvider['type'] = 'api-key';
    if (creds.oauthTokens) {
      providerType = 'oauth2';
    } else if (creds.credentials['token']) {
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
  buildEnvVars(creds: IntegrationCredentials): Record<string, string> {
    const env: Record<string, string> = {};

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
    const credMap = creds.credentials as Record<string, string>;
    const envVarNames = INTEGRATION_ENV_MAP[creds.integrationId] ?? [];

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
  async registerForSandbox(
    sandboxName: string,
    credentials: IntegrationCredentials[],
  ): Promise<SandboxProvider[]> {
    const providers: SandboxProvider[] = [];

    for (const creds of credentials) {
      const provider = this.toProvider(creds);
      providers.push(provider);
    }

    return providers;
  }

  private getEnvPrefix(integrationId: string): string {
    const prefixes: Record<string, string> = {
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
    return prefixes[integrationId] ?? integrationId.toUpperCase().replace(/-/g, '_');
  }
}
