// ============================================================
// CoordinatorAgent — Orchestrates worker subagents
// Inspired by claude-code coordinator/coordinatorMode.ts
//
// Coordinator mode: the main agent only uses spawn_agent to
// delegate tasks. It never executes tools directly.
// Workers handle the actual execution (bash, file ops, etc.)
// ============================================================

import type {
    AgentConfig,
    AgentDefinition,
    CoordinatorConfig
} from '@hitechclaw/shared';
import type { ChatOptions } from '../llm/llm-router.js';
import {
    BUILT_IN_AGENT_DEFINITIONS,
    buildSpawnAgentHandler,
    buildSpawnAgentToolDefinition,
    type AgentFactory,
} from '../tools/agent-spawn-tool.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Agent } from './agent.js';
import { TaskManager } from './task-manager.js';

/** Coordinator system prompt prefix injected automatically */
const COORDINATOR_SYSTEM_PREFIX = `You are a coordinator agent. Your role is to:
1. Analyze the user's request and break it into subtasks.
2. Delegate each subtask to a specialized worker agent using the \`spawn_agent\` tool.
3. Synthesize the results from all workers into a coherent final response.

IMPORTANT: Do NOT attempt to answer questions directly unless they are trivial. 
Always prefer spawning the appropriate worker agent for any non-trivial task.

Available worker agent types: researcher, coder, analyst, general.
`;

/**
 * CoordinatorAgent — wraps a standard Agent with coordinator mode.
 *
 * When coordinator mode is active:
 * - The agent's system prompt is prepended with coordinator instructions
 * - The `spawn_agent` tool is automatically registered
 * - Workers are spawned via `AgentFactory` using child/inherited configs
 * - TaskManager tracks all spawned worker tasks
 *
 * Usage:
 *   const coordinator = new CoordinatorAgent(config, { enabled: true }, agentFactory);
 *   const result = await coordinator.coordinate('session-123', 'Research and code a solution for X');
 */
export class CoordinatorAgent {
  readonly inner: Agent;
  readonly taskManager: TaskManager;
  private readonly coordinatorConfig: CoordinatorConfig;
  private readonly agentFactory: AgentFactory;
  private readonly definitions: AgentDefinition[];

  constructor(
    config: AgentConfig,
    coordinatorConfig: CoordinatorConfig,
    agentFactory: AgentFactory,
    definitions?: AgentDefinition[],
  ) {
    this.coordinatorConfig = coordinatorConfig;
    this.agentFactory = agentFactory;
    this.taskManager = new TaskManager();
    this.definitions = definitions ?? BUILT_IN_AGENT_DEFINITIONS;

    // Build coordinator config: prepend coordinator system prompt
    const coordinatorSystemPrompt = coordinatorConfig.enabled
      ? `${COORDINATOR_SYSTEM_PREFIX}\n${config.systemPrompt}`
      : config.systemPrompt;

    const coordinatorAgentConfig: AgentConfig = {
      ...config,
      systemPrompt: coordinatorSystemPrompt,
      // Limit coordinator's direct tool use — it should delegate via spawn_agent
      maxToolIterations: config.maxToolIterations ?? 50,
    };

    this.inner = new Agent(coordinatorAgentConfig);
  }

  /**
   * Initialize and register the spawn_agent tool with the coordinator's registry.
   * Call this once after construction (after the sessionId is known).
   */
  setupSpawnTool(sessionId: string): void {
    const toolDef = buildSpawnAgentToolDefinition();
    const handler = buildSpawnAgentHandler({
      parentConfig: this.inner.config,
      taskManager: this.taskManager,
      agentFactory: this.agentFactory,
      definitions: this.definitions,
      sessionId,
    });

    // Register (no-op if already registered — safe to call per-session)
    if (!this.inner.tools.has(toolDef.name)) {
      this.inner.tools.register(toolDef, handler);
    }
  }

  /**
   * Run a coordination session.
   * Automatically sets up the spawn_agent tool and runs the main loop.
   */
  async coordinate(
    sessionId: string,
    userMessage: string,
    llmOptions?: ChatOptions,
  ): Promise<string> {
    this.setupSpawnTool(sessionId);

    const result = await this.inner.chat(sessionId, userMessage, undefined, undefined, undefined, llmOptions);

    // Cleanup finished tasks after the session
    this.taskManager.purgeSession(sessionId);

    return result;
  }

  /**
   * Expose task manager for observability (e.g. gateway routes showing task progress).
   */
  getActiveTasks() {
    return this.taskManager.getActiveTasks();
  }

  /**
   * Get all tasks for a session (active + completed).
   */
  getSessionTasks(sessionId: string) {
    return this.taskManager.getBySession(sessionId);
  }
}

// ─── Coordinator Tool Helpers ────────────────────────────────

/**
 * Build a restricted tool registry for worker agents.
 * Workers should only access the tools listed in `coordinatorConfig.workerTools`.
 */
export function buildWorkerToolRegistry(
  parentRegistry: ToolRegistry,
  allowedTools?: string[],
): ToolRegistry {
  const workerRegistry = new ToolRegistry();

  for (const def of parentRegistry.getDefinitions()) {
    // If allowedTools is undefined, copy all tools; otherwise filter
    if (!allowedTools || allowedTools.includes(def.name)) {
      const handler = parentRegistry.get(def.name);
      if (handler) {
        workerRegistry.register(def, handler.handler);
      }
    }
  }

  return workerRegistry;
}

/**
 * Create an AgentFactory that inherits parent registry (respecting workerTools).
 * Pass this to CoordinatorAgent constructor.
 */
export function createInheritingAgentFactory(
  parentRegistry: ToolRegistry,
  coordinatorConfig: CoordinatorConfig,
): AgentFactory {
  const workerRegistry = buildWorkerToolRegistry(parentRegistry, coordinatorConfig.workerTools);

  return (config) => {
    const agent = new Agent({
      id: config.id,
      name: config.name,
      description: config.description,
      persona: config.persona ?? 'You are a helpful AI assistant.',
      systemPrompt: config.systemPrompt ?? 'You are a helpful AI assistant.',
      llm: config.llm!,
      enabledSkills: config.enabledSkills ?? [],
      memory: config.memory ?? { enabled: true, maxEntries: 100 },
      security: config.security ?? {
        requireApprovalForShell: false,
        requireApprovalForNetwork: false,
      },
      maxToolIterations: config.maxToolIterations ?? 20,
      toolTimeout: config.toolTimeout ?? 30_000,
      allowTransfer: false,
    });

    // Copy worker tools into the subagent's registry
    for (const def of workerRegistry.getDefinitions()) {
      const entry = workerRegistry.get(def.name);
      if (entry) {
        agent.tools.register(def, entry.handler);
      }
    }

    return agent;
  };
}

/**
 * Check whether coordinator mode should be active for a given config.
 * Reads HITECHCLAW_COORDINATOR_MODE env var if not explicitly set in config.
 */
export function isCoordinatorModeEnabled(config?: CoordinatorConfig): boolean {
  if (config !== undefined) {
    return config.enabled;
  }
  return process.env.HITECHCLAW_COORDINATOR_MODE === '1' ||
    process.env.HITECHCLAW_COORDINATOR_MODE === 'true';
}
