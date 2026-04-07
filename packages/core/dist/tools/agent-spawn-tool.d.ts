import type { AgentConfig, AgentDefinition, ToolDefinition, ToolResult } from '@hitechclaw/shared';
import type { Agent } from '../agent/agent.js';
import type { TaskManager } from '../agent/task-manager.js';
export declare const SPAWN_AGENT_TOOL_NAME = "spawn_agent";
/** Factory function that creates an Agent from a config subset */
export type AgentFactory = (config: Partial<AgentConfig> & {
    id: string;
    name: string;
}) => Agent;
export interface SpawnAgentToolOptions {
    /** The parent agent's config (used to inherit LLM config, security, etc.) */
    parentConfig: AgentConfig;
    /** TaskManager to register spawned tasks */
    taskManager: TaskManager;
    /** Agent factory to instantiate subagents */
    agentFactory: AgentFactory;
    /** Built-in agent definitions available for spawning */
    definitions?: AgentDefinition[];
    /** Session ID for the current context */
    sessionId: string;
}
/**
 * Returns the ToolDefinition for spawn_agent.
 * Register this in a ToolRegistry so the LLM can call it.
 */
export declare function buildSpawnAgentToolDefinition(): ToolDefinition;
/**
 * Handler for the spawn_agent tool.
 * Creates an isolated subagent, runs it to completion, and returns the result.
 */
export declare function buildSpawnAgentHandler(options: SpawnAgentToolOptions): (args: Record<string, unknown>) => Promise<unknown>;
export declare const BUILT_IN_AGENT_DEFINITIONS: AgentDefinition[];
/**
 * Validates that the spawn_agent call result is a proper ToolResult shape.
 */
export declare function wrapSpawnResult(toolCallId: string, result: unknown): ToolResult;
//# sourceMappingURL=agent-spawn-tool.d.ts.map