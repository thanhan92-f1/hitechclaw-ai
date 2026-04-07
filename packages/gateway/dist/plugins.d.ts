/**
 * Plugin Gateway Routes — Auto-mounts plugin API routes and provides
 * plugin registry/management endpoints.
 */
import { Hono } from 'hono';
import type { PluginManager } from '@hitechclaw/core';
export declare function createPluginRoutes(pluginManager: PluginManager): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=plugins.d.ts.map