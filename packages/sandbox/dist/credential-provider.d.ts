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
export declare class CredentialProviderAdapter {
    private readonly manager;
    constructor(manager: SandboxManager);
    /**
     * Convert integration credentials to an OpenShell SandboxProvider.
     * The provider tells OpenShell which env vars to inject.
     */
    toProvider(creds: IntegrationCredentials): SandboxProvider;
    /**
     * Build the environment variables map for credential injection.
     * Returns a Record<envVarName, value> for the sandbox runtime.
     * WARNING: This data must never be logged or persisted in plaintext.
     */
    buildEnvVars(creds: IntegrationCredentials): Record<string, string>;
    /**
     * Register credential providers with OpenShell for a sandbox.
     * Providers are injected at sandbox creation time.
     */
    registerForSandbox(sandboxName: string, credentials: IntegrationCredentials[]): Promise<SandboxProvider[]>;
    private getEnvPrefix;
}
//# sourceMappingURL=credential-provider.d.ts.map