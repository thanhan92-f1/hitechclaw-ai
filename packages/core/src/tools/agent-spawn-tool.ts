// ============================================================
// AgentSpawnTool — Lets LLM dynamically spawn subagents
// Inspired by claude-code AgentTool pattern
// ============================================================

import type {
    AgentConfig,
    AgentDefinition,
    AgentTask,
    ToolDefinition,
    ToolResult,
} from '@hitechclaw/shared';
import { randomUUID } from 'node:crypto';
import type { Agent } from '../agent/agent.js';
import type { TaskManager } from '../agent/task-manager.js';

export const SPAWN_AGENT_TOOL_NAME = 'spawn_agent';

/** Factory function that creates an Agent from a config subset */
export type AgentFactory = (config: Partial<AgentConfig> & { id: string; name: string }) => Agent;

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
export function buildSpawnAgentToolDefinition(): ToolDefinition {
  return {
    name: SPAWN_AGENT_TOOL_NAME,
    description:
      'Spawn a specialized subagent to handle a subtask in parallel or in sequence. ' +
      'Use this when a task requires a different specialty, needs to run concurrently, ' +
      'or should be isolated from the main conversation context. ' +
      'Returns the subagent\'s result when it completes.',
    category: 'agent',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'The task or question to delegate to the subagent. Be specific and self-contained.',
        required: true,
      },
      {
        name: 'agent_type',
        type: 'string',
        description:
          'Type of subagent to spawn. Use a built-in type ("researcher", "coder", "analyst") ' +
          'or omit to use a general-purpose agent.',
        required: false,
      },
      {
        name: 'system_prompt',
        type: 'string',
        description: 'Optional custom system prompt to override the default for this subagent.',
        required: false,
      },
      {
        name: 'allowed_tools',
        type: 'array',
        description: 'Optional list of tool names this subagent is allowed to use.',
        required: false,
      },
      {
        name: 'max_turns',
        type: 'number',
        description: 'Maximum number of tool-calling iterations for this subagent (default: 20).',
        required: false,
      },
    ],
  };
}

/**
 * Handler for the spawn_agent tool.
 * Creates an isolated subagent, runs it to completion, and returns the result.
 */
export function buildSpawnAgentHandler(options: SpawnAgentToolOptions) {
  return async (args: Record<string, unknown>): Promise<unknown> => {
    const task = args['task'] as string;
    const agentType = (args['agent_type'] as string | undefined) ?? 'general';
    const customSystemPrompt = args['system_prompt'] as string | undefined;
    const maxTurns = (args['max_turns'] as number | undefined) ?? 20;

    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      throw new Error('spawn_agent: "task" parameter is required and must be a non-empty string');
    }

    // Find definition matching agentType (if known)
    const definition = options.definitions?.find((d) => d.agentType === agentType);

    // Build subagent config inheriting from parent
    const subAgentConfig: Partial<AgentConfig> & { id: string; name: string } = {
      id: randomUUID(),
      name: `${agentType}-subagent`,
      description: definition?.description ?? `Subagent spawned for: ${task.slice(0, 80)}`,
      persona: definition?.systemPrompt ?? options.parentConfig.persona,
      systemPrompt: customSystemPrompt ?? definition?.systemPrompt ?? options.parentConfig.systemPrompt,
      llm: {
        ...options.parentConfig.llm,
        ...(definition?.model ? { model: definition.model } : {}),
      },
      enabledSkills: options.parentConfig.enabledSkills,
      memory: options.parentConfig.memory,
      security: options.parentConfig.security,
      maxToolIterations: maxTurns,
      toolTimeout: options.parentConfig.toolTimeout,
      allowTransfer: false, // subagents don't spawn further agents by default
    };

    const subAgent = options.agentFactory(subAgentConfig);

    // Register the task
    const agentTask: AgentTask = {
      id: randomUUID(),
      type: 'subagent',
      status: 'pending',
      description: task.slice(0, 200),
      agentId: subAgentConfig.id,
      sessionId: options.sessionId,
      startedAt: new Date().toISOString(),
      metadata: { agentType, parentAgentId: options.parentConfig.id },
    };

    options.taskManager.register(agentTask);
    options.taskManager.transition(agentTask.id, 'running');

    try {
      const result = await subAgent.chat(options.sessionId, task);
      options.taskManager.complete(agentTask.id, result);
      return {
        taskId: agentTask.id,
        agentType,
        result,
        status: 'completed',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      options.taskManager.fail(agentTask.id, errorMessage);
      return {
        taskId: agentTask.id,
        agentType,
        result: null,
        error: errorMessage,
        status: 'failed',
      };
    }
  };
}

// ─── Built-in Agent Definitions ─────────────────────────────

export const BUILT_IN_AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    agentType: 'researcher',
    description: 'Specializes in gathering information, summarizing content, and answering research questions.',
    systemPrompt:
      'You are a research specialist. Your job is to gather, synthesize, and summarize information accurately. ' +
      'Be thorough, cite sources when possible, and present findings in a clear and organized manner.',
    tools: ['web_search', 'web_fetch'],
    maxTurns: 30,
    source: 'built-in',
  },
  {
    agentType: 'coder',
    description: 'Specializes in writing, reviewing, and debugging code.',
    systemPrompt:
      'You are a senior software engineer. Write clean, well-documented, production-ready code. ' +
      'Follow best practices for the language/framework being used. ' +
      'Always explain your implementation choices.',
    maxTurns: 50,
    source: 'built-in',
  },
  {
    agentType: 'analyst',
    description: 'Specializes in data analysis, pattern recognition, and generating insights.',
    systemPrompt:
      'You are a data analyst. Analyze the provided data or information carefully, ' +
      'identify patterns and trends, and generate actionable insights. ' +
      'Present your analysis in a structured format with clear conclusions.',
    maxTurns: 20,
    source: 'built-in',
  },
  {
    agentType: 'general',
    description: 'General-purpose agent for any task.',
    systemPrompt:
      'You are a helpful, capable AI assistant. Complete the assigned task thoroughly and accurately.',
    maxTurns: 20,
    source: 'built-in',
  },
];

/**
 * Validates that the spawn_agent call result is a proper ToolResult shape.
 */
export function wrapSpawnResult(toolCallId: string, result: unknown): ToolResult {
  return {
    toolCallId,
    success: true,
    result,
    duration: 0,
  };
}
