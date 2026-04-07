import { Hono } from 'hono';
import type { TenantSandboxConfig } from '@hitechclaw/shared';
export interface TenantInfo {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    metadata: Record<string, unknown>;
}
export interface TenantSettingsInfo {
    llmProvider: string;
    llmModel: string;
    llmApiKey: string | null;
    llmBaseUrl: string | null;
    llmTemperature: number | null;
    llmMaxTokens: number | null;
    agentName: string;
    systemPrompt: string | null;
    aiLanguage: string;
    aiLanguageCustom: string | null;
    enableWebSearch: boolean;
    enableRag: boolean;
    enableWorkflows: boolean;
    enabledDomains: string[];
    enabledIntegrations: string[];
    maxUsersPerTenant: number;
    maxSessionsPerUser: number;
    maxMessagesPerDay: number;
    tavilyApiKey: string | null;
    branding: Record<string, unknown>;
    sandboxConfig: TenantSandboxConfig;
}
export declare const TenantService: {
    getById(tenantId: string): Promise<TenantInfo | null>;
    getBySlug(slug: string): Promise<TenantInfo | null>;
    list(): Promise<TenantInfo[]>;
    create(data: {
        name: string;
        slug: string;
        plan?: string;
        metadata?: Record<string, unknown>;
    }): Promise<TenantInfo>;
    update(tenantId: string, data: Partial<Pick<TenantInfo, "name" | "plan" | "status" | "metadata">>): Promise<TenantInfo | null>;
    getSettings(tenantId: string): Promise<TenantSettingsInfo | null>;
    updateSettings(tenantId: string, data: Partial<TenantSettingsInfo>): Promise<TenantSettingsInfo | null>;
};
declare const LANGUAGE_MAP: Record<string, string>;
export declare function getTenantLanguageInstruction(settings: TenantSettingsInfo): string;
export { LANGUAGE_MAP };
declare module 'hono' {
    interface ContextVariableMap {
        tenantId: string;
        tenantSettings: TenantSettingsInfo;
    }
}
export declare function tenantMiddleware(): (c: any, next: () => Promise<void>) => Promise<void>;
export declare function createTenantRoutes(): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=tenant.d.ts.map