/**
 * PluginManager — Central registry for HiTechClaw plugins.
 *
 * Handles plugin registration, activation/deactivation, lifecycle hooks,
 * and provides PluginContext to each plugin.
 */
export class PluginManager {
    constructor(deps) {
        this.plugins = new Map();
        this.pluginConfigs = new Map();
        this.deps = deps;
    }
    /**
     * Register a plugin (does not activate it).
     */
    register(plugin) {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin '${plugin.id}' is already registered`);
        }
        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Plugin '${plugin.id}' requires '${dep}' which is not registered`);
                }
            }
        }
        this.plugins.set(plugin.id, {
            plugin,
            status: 'registered',
        });
    }
    /**
     * Register and immediately activate a plugin.
     */
    async registerAndActivate(plugin, config) {
        this.register(plugin);
        if (config) {
            this.pluginConfigs.set(plugin.id, config);
        }
        await this.activate(plugin.id);
    }
    /**
     * Activate a registered plugin.
     */
    async activate(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin '${pluginId}' is not registered`);
        }
        if (entry.status === 'active')
            return;
        try {
            // Create MongoDB collections if declared
            if (entry.plugin.collections) {
                await this.ensureCollections(entry.plugin);
            }
            // Call onActivate hook
            if (entry.plugin.onActivate) {
                const ctx = this.createContext(pluginId);
                await entry.plugin.onActivate(ctx);
            }
            entry.status = 'active';
            entry.activatedAt = new Date().toISOString();
            entry.error = undefined;
        }
        catch (err) {
            entry.status = 'error';
            entry.error = err instanceof Error ? err.message : 'Activation failed';
            throw err;
        }
    }
    /**
     * Deactivate a plugin.
     */
    async deactivate(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin '${pluginId}' is not registered`);
        }
        if (entry.status !== 'active')
            return;
        try {
            if (entry.plugin.onDeactivate) {
                const ctx = this.createContext(pluginId);
                await entry.plugin.onDeactivate(ctx);
            }
            entry.status = 'inactive';
        }
        catch (err) {
            entry.status = 'error';
            entry.error = err instanceof Error ? err.message : 'Deactivation failed';
        }
    }
    /**
     * Get a registered plugin by ID.
     */
    get(pluginId) {
        return this.plugins.get(pluginId);
    }
    /**
     * List all registered plugins.
     */
    listAll() {
        return Array.from(this.plugins.values());
    }
    /**
     * List only active plugins.
     */
    listActive() {
        return this.listAll().filter((e) => e.status === 'active');
    }
    /**
     * Get active plugins that declare API routes.
     */
    getRoutePlugins() {
        return this.listActive()
            .filter((e) => e.plugin.createRoutes)
            .map((e) => ({ plugin: e.plugin, createRoutes: e.plugin.createRoutes }));
    }
    /**
     * Get active plugins that declare domain packs.
     */
    getDomainPlugins() {
        return this.listActive()
            .filter((e) => e.plugin.domain)
            .map((e) => e.plugin);
    }
    /**
     * Get all frontend page declarations from active plugins.
     */
    getPages() {
        return this.listActive()
            .filter((e) => e.plugin.pages && e.plugin.pages.length > 0)
            .map((e) => ({
            pluginId: e.plugin.id,
            pluginName: e.plugin.name,
            pluginIcon: e.plugin.icon,
            pages: e.plugin.pages,
        }));
    }
    /**
     * Create a PluginContext for a specific plugin.
     */
    createContext(pluginId) {
        const config = this.pluginConfigs.get(pluginId) || {};
        const db = this.deps.getMongoDb();
        return {
            config,
            getCollection: (name) => {
                const fullName = `plugin_${pluginId}_${name}`;
                return db === null || db === void 0 ? void 0 : db.collection(fullName);
            },
            llm: this.deps.llm,
            tools: this.deps.tools,
            events: this.deps.events,
            rag: this.deps.rag,
            imageGen: this.deps.imageGen,
        };
    }
    /**
     * Ensure MongoDB collections and indexes exist for a plugin.
     */
    async ensureCollections(plugin) {
        if (!plugin.collections)
            return;
        const db = this.deps.getMongoDb();
        if (!db)
            return;
        for (const col of plugin.collections) {
            const fullName = `plugin_${plugin.id}_${col.name}`;
            try {
                await db.createCollection(fullName);
            }
            catch (_a) {
                // Collection may already exist
            }
            if (col.indexes) {
                const collection = db.collection(fullName);
                for (const idx of col.indexes) {
                    await collection.createIndex(idx.fields, idx.options || {});
                }
            }
        }
    }
}
