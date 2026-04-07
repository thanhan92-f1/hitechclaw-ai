// ============================================================
// AgentSpawnTool — Lets LLM dynamically spawn subagents
// Inspired by claude-code AgentTool pattern
// ============================================================
import { randomUUID } from 'node:crypto';
export const SPAWN_AGENT_TOOL_NAME = 'spawn_agent';
/**
 * Returns the ToolDefinition for spawn_agent.
 * Register this in a ToolRegistry so the LLM can call it.
 */
export function buildSpawnAgentToolDefinition() {
    return {
        name: SPAWN_AGENT_TOOL_NAME,
        description: 'Spawn a specialized subagent to handle a subtask in parallel or in sequence. ' +
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
                description: 'Type of subagent to spawn. Use a built-in type ("researcher", "coder", "analyst") ' +
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
export function buildSpawnAgentHandler(options) {
    return async (args) => {
        var _a, _b, _c, _d, _e, _f;
        const task = args['task'];
        const agentType = (_a = args['agent_type']) !== null && _a !== void 0 ? _a : 'general';
        const customSystemPrompt = args['system_prompt'];
        const maxTurns = (_b = args['max_turns']) !== null && _b !== void 0 ? _b : 20;
        if (!task || typeof task !== 'string' || task.trim().length === 0) {
            throw new Error('spawn_agent: "task" parameter is required and must be a non-empty string');
        }
        // Find definition matching agentType (if known)
        const definition = (_c = options.definitions) === null || _c === void 0 ? void 0 : _c.find((d) => d.agentType === agentType);
        // Build subagent config inheriting from parent
        const subAgentConfig = {
            id: randomUUID(),
            name: `${agentType}-subagent`,
            description: (_d = definition === null || definition === void 0 ? void 0 : definition.description) !== null && _d !== void 0 ? _d : `Subagent spawned for: ${task.slice(0, 80)}`,
            persona: (_e = definition === null || definition === void 0 ? void 0 : definition.systemPrompt) !== null && _e !== void 0 ? _e : options.parentConfig.persona,
            systemPrompt: (_f = customSystemPrompt !== null && customSystemPrompt !== void 0 ? customSystemPrompt : definition === null || definition === void 0 ? void 0 : definition.systemPrompt) !== null && _f !== void 0 ? _f : options.parentConfig.systemPrompt,
            llm: Object.assign(Object.assign({}, options.parentConfig.llm), ((definition === null || definition === void 0 ? void 0 : definition.model) ? { model: definition.model } : {})),
            enabledSkills: options.parentConfig.enabledSkills,
            memory: options.parentConfig.memory,
            security: options.parentConfig.security,
            maxToolIterations: maxTurns,
            toolTimeout: options.parentConfig.toolTimeout,
            allowTransfer: false, // subagents don't spawn further agents by default
        };
        const subAgent = options.agentFactory(subAgentConfig);
        // Register the task
        const agentTask = {
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
        }
        catch (err) {
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
export const BUILT_IN_AGENT_DEFINITIONS = [
    {
        agentType: 'researcher',
        description: 'Specializes in gathering information, summarizing content, and answering research questions.',
        systemPrompt: 'You are a research specialist. Your job is to gather, synthesize, and summarize information accurately. ' +
            'Be thorough, cite sources when possible, and present findings in a clear and organized manner.',
        tools: ['web_search', 'web_fetch'],
        maxTurns: 30,
        source: 'built-in',
    },
    {
        agentType: 'coder',
        description: 'Specializes in writing, reviewing, and debugging code.',
        systemPrompt: 'You are a senior software engineer. Write clean, well-documented, production-ready code. ' +
            'Follow best practices for the language/framework being used. ' +
            'Always explain your implementation choices.',
        maxTurns: 50,
        source: 'built-in',
    },
    {
        agentType: 'analyst',
        description: 'Specializes in data analysis, pattern recognition, and generating insights.',
        systemPrompt: 'You are a data analyst. Analyze the provided data or information carefully, ' +
            'identify patterns and trends, and generate actionable insights. ' +
            'Present your analysis in a structured format with clear conclusions.',
        maxTurns: 20,
        source: 'built-in',
    },
    {
        agentType: 'general',
        description: 'General-purpose agent for any task.',
        systemPrompt: 'You are a helpful, capable AI assistant. Complete the assigned task thoroughly and accurately.',
        maxTurns: 20,
        source: 'built-in',
    },
];
/**
 * Validates that the spawn_agent call result is a proper ToolResult shape.
 */
export function wrapSpawnResult(toolCallId, result) {
    return {
        toolCallId,
        success: true,
        result,
        duration: 0,
    };
}
