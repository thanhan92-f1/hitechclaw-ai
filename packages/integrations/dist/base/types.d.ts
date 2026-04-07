import { z } from 'zod';
export type IntegrationCategory = 'messaging' | 'email' | 'productivity' | 'storage' | 'developer' | 'social' | 'commerce' | 'analytics' | 'ai' | 'healthcare' | 'finance' | 'communication' | 'crm' | 'cloud' | 'search' | 'other';
export interface AuthField {
    key: string;
    label: string;
    type: 'string' | 'secret';
    required: boolean;
    envVar?: string;
    placeholder?: string;
}
export interface OAuth2Config {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdEnv: string;
    clientSecretEnv: string;
    refreshable: boolean;
}
export type IntegrationAuth = {
    type: 'none';
} | {
    type: 'api-key';
    fields: AuthField[];
} | {
    type: 'basic';
    fields: AuthField[];
} | {
    type: 'bearer';
    fields: AuthField[];
} | {
    type: 'oauth2';
    config: OAuth2Config;
};
export type Credentials = Record<string, string>;
export interface IntegrationContext {
    integrationId: string;
    credentials: Credentials;
    userId?: string;
    /** Pre-authenticated HTTP client for the integration */
    getClient<T = unknown>(): T;
}
export interface ActionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
export interface IntegrationAction {
    name: string;
    description: string;
    parameters: z.ZodSchema;
    execute: (args: Record<string, any>, ctx: IntegrationContext) => Promise<ActionResult>;
    riskLevel?: 'safe' | 'moderate' | 'dangerous';
    requiresApproval?: boolean;
}
export interface TriggerEvent {
    integrationId: string;
    triggerName: string;
    data: unknown;
    timestamp: Date;
}
export interface IntegrationTrigger {
    name: string;
    description: string;
    eventSchema: z.ZodSchema;
    /** Webhook-based: register webhook with remote service */
    subscribe?: (webhookUrl: string, credentials: Credentials) => Promise<void>;
    /** Webhook-based: unregister webhook */
    unsubscribe?: (webhookUrl: string, credentials: Credentials) => Promise<void>;
    /** Poll-based: check for new events */
    poll?: (lastPollTime: Date, credentials: Credentials) => Promise<TriggerEvent[]>;
    /** Poll interval in ms (default: 60000) */
    pollInterval?: number;
}
export interface IntegrationDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: IntegrationCategory;
    auth: IntegrationAuth;
    actions: IntegrationAction[];
    triggers?: IntegrationTrigger[];
    /** Called when integration is connected with valid credentials */
    onConnect?: (credentials: Credentials) => Promise<void>;
    /** Called when integration is disconnected */
    onDisconnect?: () => Promise<void>;
    /** Check if integration is available (e.g., macOS-only) */
    healthCheck?: () => Promise<boolean>;
}
export interface IntegrationConnection {
    integrationId: string;
    userId: string;
    status: 'connected' | 'disconnected' | 'error';
    credentials: Credentials;
    accountInfo?: Record<string, unknown>;
    connectedAt: Date;
    lastUsedAt?: Date;
    errorMessage?: string;
}
//# sourceMappingURL=types.d.ts.map