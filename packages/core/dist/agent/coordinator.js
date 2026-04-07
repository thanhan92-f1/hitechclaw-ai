// ============================================================
// CoordinatorAgent — Orchestrates worker subagents
// Inspired by claude-code coordinator/coordinatorMode.ts
//
// Coordinator mode: the main agent only uses spawn_agent to
// delegate tasks. It never executes tools directly.
// Workers handle the actual execution (bash, file ops, etc.)
// ============================================================
import { BUILT_IN_AGENT_DEFINITIONS, buildSpawnAgentHandler, buildSpawnAgentToolDefinition, } from '../tools/agent-spawn-tool.js';
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
    constructor(config, coordinatorConfig, agentFactory, definitions) {
        var _a;
        this.coordinatorConfig = coordinatorConfig;
        this.agentFactory = agentFactory;
        this.taskManager = new TaskManager();
        this.definitions = definitions !== null && definitions !== void 0 ? definitions : BUILT_IN_AGENT_DEFINITIONS;
        // Build coordinator config: prepend coordinator system prompt
        const coordinatorSystemPrompt = coordinatorConfig.enabled
            ? `${COORDINATOR_SYSTEM_PREFIX}\n${config.systemPrompt}`
            : config.systemPrompt;
        const coordinatorAgentConfig = Object.assign(Object.assign({}, config), { systemPrompt: coordinatorSystemPrompt, 
            // Limit coordinator's direct tool use — it should delegate via spawn_agent
            maxToolIterations: (_a = config.maxToolIterations) !== null && _a !== void 0 ? _a : 50 });
        this.inner = new Agent(coordinatorAgentConfig);
    }
    /**
     * Initialize and register the spawn_agent tool with the coordinator's registry.
     * Call this once after construction (after the sessionId is known).
     */
    setupSpawnTool(sessionId) {
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
    async coordinate(sessionId, userMessage, llmOptions) {
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
    getSessionTasks(sessionId) {
        return this.taskManager.getBySession(sessionId);
    }
}
// ─── Coordinator Tool Helpers ────────────────────────────────
/**
 * Build a restricted tool registry for worker agents.
 * Workers should only access the tools listed in `coordinatorConfig.workerTools`.
 */
export function buildWorkerToolRegistry(parentRegistry, allowedTools) {
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
export function createInheritingAgentFactory(parentRegistry, coordinatorConfig) {
    const workerRegistry = buildWorkerToolRegistry(parentRegistry, coordinatorConfig.workerTools);
    return (config) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const agent = new Agent({
            id: config.id,
            name: config.name,
            description: config.description,
            persona: (_a = config.persona) !== null && _a !== void 0 ? _a : 'You are a helpful AI assistant.',
            systemPrompt: (_b = config.systemPrompt) !== null && _b !== void 0 ? _b : 'You are a helpful AI assistant.',
            llm: config.llm,
            enabledSkills: (_c = config.enabledSkills) !== null && _c !== void 0 ? _c : [],
            memory: (_d = config.memory) !== null && _d !== void 0 ? _d : { enabled: true, maxEntries: 100 },
            security: (_e = config.security) !== null && _e !== void 0 ? _e : {
                requireApprovalForShell: false,
                requireApprovalForNetwork: false,
            },
            maxToolIterations: (_f = config.maxToolIterations) !== null && _f !== void 0 ? _f : 20,
            toolTimeout: (_g = config.toolTimeout) !== null && _g !== void 0 ? _g : 30000,
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
export function isCoordinatorModeEnabled(config) {
    if (config !== undefined) {
        return config.enabled;
    }
    return process.env.HITECHCLAW_COORDINATOR_MODE === '1' ||
        process.env.HITECHCLAW_COORDINATOR_MODE === 'true';
}
