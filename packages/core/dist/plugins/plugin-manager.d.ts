/**
 * PluginManager — Central registry for HiTechClaw plugins.
 *
 * Handles plugin registration, activation/deactivation, lifecycle hooks,
 * and provides PluginContext to each plugin.
 */
import type { HiTechClawPlugin, PluginContext, PluginRegistryEntry } from '@hitechclaw/shared';
export interface PluginManagerDeps {
    /** MongoDB db instance for creating plugin collections */
    getMongoDb: () => unknown;
    /** LLM router reference */
    llm: unknown;
    /** Tool registry reference */
    tools: unknown;
    /** Event bus reference */
    events: unknown;
    /** RAG engine reference */
    rag: unknown;
    /** Image generation service (optional) */
    imageGen?: unknown;
}
export declare class PluginManager {
    private plugins;
    private deps;
    private pluginConfigs;
    constructor(deps: PluginManagerDeps);
    /**
     * Register a plugin (does not activate it).
     */
    register(plugin: HiTechClawPlugin): void;
    /**
     * Register and immediately activate a plugin.
     */
    registerAndActivate(plugin: HiTechClawPlugin, config?: Record<string, unknown>): Promise<void>;
    /**
     * Activate a registered plugin.
     */
    activate(pluginId: string): Promise<void>;
    /**
     * Deactivate a plugin.
     */
    deactivate(pluginId: string): Promise<void>;
    /**
     * Get a registered plugin by ID.
     */
    get(pluginId: string): PluginRegistryEntry | undefined;
    /**
     * List all registered plugins.
     */
    listAll(): PluginRegistryEntry[];
    /**
     * List only active plugins.
     */
    listActive(): PluginRegistryEntry[];
    /**
     * Get active plugins that declare API routes.
     */
    getRoutePlugins(): Array<{
        plugin: HiTechClawPlugin;
        createRoutes: NonNullable<HiTechClawPlugin['createRoutes']>;
    }>;
    /**
     * Get active plugins that declare domain packs.
     */
    getDomainPlugins(): HiTechClawPlugin[];
    /**
     * Get all frontend page declarations from active plugins.
     */
    getPages(): Array<{
        pluginId: string;
        pluginName: string;
        pluginIcon: string;
        pages: NonNullable<HiTechClawPlugin['pages']>;
    }>;
    /**
     * Create a PluginContext for a specific plugin.
     */
    createContext(pluginId: string): PluginContext;
    /**
     * Ensure MongoDB collections and indexes exist for a plugin.
     */
    private ensureCollections;
}
//# sourceMappingURL=plugin-manager.d.ts.map