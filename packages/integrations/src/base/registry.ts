import type {
  IntegrationDefinition,
  IntegrationConnection,
  IntegrationAction,
  Credentials,
  IntegrationContext,
  ActionResult,
} from './types.js';
import type { ToolDefinition, ToolCall, ToolResult } from '@hitechclaw/shared';

/**
 * IntegrationRegistry — Manages all integration definitions and connections.
 * 
 * Workflow:
 * 1. register(integration) — Add integration definition
 * 2. connect(id, credentials) — Authenticate and activate
 * 3. Actions auto-bridge to Agent ToolRegistry as tools
 * 4. disconnect(id) — Revoke access
 */
export class IntegrationRegistry {
  private integrations = new Map<string, IntegrationDefinition>();
  private connections = new Map<string, IntegrationConnection>();

  /** Register an integration definition */
  register(integration: IntegrationDefinition): void {
    this.integrations.set(integration.id, integration);
  }

  /** Register multiple integrations at once */
  registerAll(integrations: IntegrationDefinition[]): void {
    for (const integration of integrations) {
      this.register(integration);
    }
  }

  /** Get integration definition */
  get(id: string): IntegrationDefinition | undefined {
    return this.integrations.get(id);
  }

  /** List all registered integration definitions */
  listAll(): IntegrationDefinition[] {
    return Array.from(this.integrations.values());
  }

  /** List by category */
  listByCategory(category: string): IntegrationDefinition[] {
    return this.listAll().filter((i) => i.category === category);
  }

  /** Connect to an integration with credentials */
  async connect(integrationId: string, userId: string, credentials: Credentials): Promise<void> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    // Call onConnect hook if defined
    if (integration.onConnect) {
      await integration.onConnect(credentials);
    }

    // Store connection
    this.connections.set(`${userId}:${integrationId}`, {
      integrationId,
      userId,
      status: 'connected',
      credentials,
      connectedAt: new Date(),
    });
  }

  /** Disconnect from an integration */
  async disconnect(integrationId: string, userId: string): Promise<void> {
    const key = `${userId}:${integrationId}`;
    const connection = this.connections.get(key);
    if (!connection) return;

    const integration = this.integrations.get(integrationId);
    if (integration?.onDisconnect) {
      await integration.onDisconnect();
    }

    this.connections.delete(key);
  }

  /** Get connection status */
  getConnection(integrationId: string, userId: string): IntegrationConnection | undefined {
    return this.connections.get(`${userId}:${integrationId}`);
  }

  /** List connected integrations for a user */
  listConnected(userId: string): IntegrationConnection[] {
    return Array.from(this.connections.values()).filter((c) => c.userId === userId);
  }

  /** Check if integration is connected for user */
  isConnected(integrationId: string, userId: string): boolean {
    const conn = this.connections.get(`${userId}:${integrationId}`);
    return conn?.status === 'connected';
  }

  /**
   * Get all integration actions as ToolDefinitions.
   * Tool names are prefixed: integration_{integrationId}_{actionName}
   * Only returns tools for connected integrations.
   */
  getToolsForUser(userId: string): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const connection of this.listConnected(userId)) {
      const integration = this.integrations.get(connection.integrationId);
      if (!integration) continue;

      for (const action of integration.actions) {
        tools.push({
          name: `integration_${integration.id}_${action.name}`,
          description: `[${integration.name}] ${action.description}`,
          category: `integration:${integration.category}`,
          parameters: [], // Zod schema handled separately
          requiresApproval: action.requiresApproval,
        });
      }
    }

    return tools;
  }

  /**
   * Execute an integration action.
   */
  async executeAction(
    integrationId: string,
    actionName: string,
    args: unknown,
    userId: string,
  ): Promise<ActionResult> {
    const connection = this.connections.get(`${userId}:${integrationId}`);
    if (!connection || connection.status !== 'connected') {
      return { success: false, error: `Integration ${integrationId} is not connected` };
    }

    const integration = this.integrations.get(integrationId);
    if (!integration) {
      return { success: false, error: `Integration ${integrationId} not found` };
    }

    const action = integration.actions.find((a) => a.name === actionName);
    if (!action) {
      return { success: false, error: `Action ${actionName} not found in ${integrationId}` };
    }

    // Validate parameters
    const parsed = action.parameters.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
    }

    // Build context
    const ctx: IntegrationContext = {
      integrationId,
      credentials: connection.credentials,
      userId,
      getClient: () => {
        throw new Error('getClient() not implemented — override per integration');
      },
    };

    // Update last used
    connection.lastUsedAt = new Date();

    return action.execute(parsed.data, ctx);
  }
}
