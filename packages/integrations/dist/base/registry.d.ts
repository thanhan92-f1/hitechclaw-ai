import type { IntegrationDefinition, IntegrationConnection, Credentials, ActionResult } from './types.js';
import type { ToolDefinition } from '@hitechclaw/shared';
/**
 * IntegrationRegistry — Manages all integration definitions and connections.
 *
 * Workflow:
 * 1. register(integration) — Add integration definition
 * 2. connect(id, credentials) — Authenticate and activate
 * 3. Actions auto-bridge to Agent ToolRegistry as tools
 * 4. disconnect(id) — Revoke access
 */
export declare class IntegrationRegistry {
    private integrations;
    private connections;
    /** Register an integration definition */
    register(integration: IntegrationDefinition): void;
    /** Register multiple integrations at once */
    registerAll(integrations: IntegrationDefinition[]): void;
    /** Get integration definition */
    get(id: string): IntegrationDefinition | undefined;
    /** List all registered integration definitions */
    listAll(): IntegrationDefinition[];
    /** List by category */
    listByCategory(category: string): IntegrationDefinition[];
    /** Connect to an integration with credentials */
    connect(integrationId: string, userId: string, credentials: Credentials): Promise<void>;
    /** Disconnect from an integration */
    disconnect(integrationId: string, userId: string): Promise<void>;
    /** Get connection status */
    getConnection(integrationId: string, userId: string): IntegrationConnection | undefined;
    /** List connected integrations for a user */
    listConnected(userId: string): IntegrationConnection[];
    /** Check if integration is connected for user */
    isConnected(integrationId: string, userId: string): boolean;
    /**
     * Get all integration actions as ToolDefinitions.
     * Tool names are prefixed: integration_{integrationId}_{actionName}
     * Only returns tools for connected integrations.
     */
    getToolsForUser(userId: string): ToolDefinition[];
    /**
     * Execute an integration action.
     */
    executeAction(integrationId: string, actionName: string, args: unknown, userId: string): Promise<ActionResult>;
}
//# sourceMappingURL=registry.d.ts.map