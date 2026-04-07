import { Agent, AnthropicAdapter, CoordinatorAgent, createInheritingAgentFactory, DeepSeekAdapter, GeminiAdapter, GroqAdapter, HuggingFaceAdapter, MistralAdapter, OllamaAdapter, OpenAIAdapter, OpenRouterAdapter, PerplexityAdapter, TaskManager, XAIAdapter } from '@hitechclaw/core';
import { agentConfigsCollection } from '@hitechclaw/db';
/**
 * AgentManager — converts MongoAgentConfig → Agent instances with caching.
 * Shares LLM adapters across all agents. Falls back to the default global agent.
 */
export class AgentManager {
    agents = new Map();
    adapters = [];
    defaultAgent;
    constructor(defaultAgent) {
        this.defaultAgent = defaultAgent;
        this.agents.set('default-agent', defaultAgent);
    }
    /** Register an LLM adapter that will be shared with all dynamically created agents */
    registerAdapter(adapter) {
        this.adapters.push(adapter);
    }
    /** Get the default/global agent */
    getDefault() {
        return this.defaultAgent;
    }
    /** Get an agent by config ID, loading from MongoDB if needed */
    async getAgent(configId, tenantId = 'default') {
        if (!configId || configId === 'default-agent') {
            return this.defaultAgent;
        }
        // Check cache — verify model still matches DB config
        const cached = this.agents.get(configId);
        if (cached) {
            // Lazy re-check: if config was updated in DB with a different model, invalidate
            const configs = agentConfigsCollection();
            const mongoConfig = await configs.findOne({ _id: configId, tenantId });
            if (mongoConfig) {
                const dbModel = mongoConfig.llmConfig?.model || '';
                if (dbModel && dbModel !== cached.config.llm.model) {
                    this.agents.delete(configId);
                    return this.createAgentFromConfig(mongoConfig);
                }
            }
            return cached;
        }
        // Load from MongoDB
        const configs = agentConfigsCollection();
        const mongoConfig = await configs.findOne({ _id: configId, tenantId });
        if (!mongoConfig) {
            return this.defaultAgent;
        }
        return this.createAgentFromConfig(mongoConfig);
    }
    /** Get the default agent for a tenant */
    async getDefaultForTenant(tenantId) {
        const configs = agentConfigsCollection();
        const mongoConfig = await configs.findOne({ tenantId, isDefault: true });
        if (!mongoConfig) {
            return this.defaultAgent;
        }
        const cached = this.agents.get(mongoConfig._id);
        if (cached) {
            const dbModel = mongoConfig.llmConfig?.model || '';
            if (dbModel && dbModel !== cached.config.llm.model) {
                this.agents.delete(mongoConfig._id);
                return this.createAgentFromConfig(mongoConfig);
            }
            return cached;
        }
        return this.createAgentFromConfig(mongoConfig);
    }
    /** Invalidate cached agent (call after config update/delete) */
    invalidate(configId) {
        if (configId !== 'default-agent') {
            this.agents.delete(configId);
        }
    }
    /** Convert MongoAgentConfig → AgentConfig */
    toRuntimeConfig(mongo) {
        const llm = mongo.llmConfig || {};
        return {
            id: mongo._id,
            name: mongo.name,
            persona: mongo.persona || mongo.name,
            systemPrompt: mongo.systemPrompt || '',
            llm: {
                provider: llm.provider || 'openai',
                model: llm.model || 'gpt-4o-mini',
                apiKey: llm.apiKey,
                baseUrl: llm.baseUrl,
                temperature: llm.temperature,
                maxTokens: llm.maxTokens,
                capabilities: llm.capabilities,
            },
            enabledSkills: mongo.enabledSkills || [],
            memory: {
                enabled: mongo.memoryConfig?.enabled ?? true,
                maxEntries: mongo.memoryConfig?.maxEntries ?? 1000,
            },
            security: {
                requireApprovalForShell: mongo.securityConfig?.requireApprovalForShell ?? true,
                requireApprovalForNetwork: mongo.securityConfig?.requireApprovalForNetwork ?? false,
                blockedCommands: mongo.securityConfig?.blockedCommands,
            },
            maxToolIterations: mongo.maxToolIterations ?? 10,
            toolTimeout: mongo.toolTimeout ?? 30000,
            isDefault: mongo.isDefault,
        };
    }
    /** Create an Agent from MongoAgentConfig, register adapters, and cache it */
    createAgentFromConfig(mongoConfig) {
        const runtimeConfig = this.toRuntimeConfig(mongoConfig);
        const agent = new Agent(runtimeConfig);
        // Register adapters — create per-agent adapter when model differs from shared one
        const llm = mongoConfig.llmConfig || {};
        const provider = llm.provider || 'openai';
        const configModel = llm.model || '';
        let needsDedicatedAdapter = false;
        for (const adapter of this.adapters) {
            if (adapter.provider === provider && configModel && this.getAdapterModel(adapter) !== configModel) {
                // This agent uses a different model than the shared adapter — skip shared, create dedicated
                needsDedicatedAdapter = true;
            }
            else {
                agent.llm.registerAdapter(adapter);
            }
        }
        // Create a dedicated adapter if model differs or provider not covered
        const hasAdapter = !needsDedicatedAdapter && this.adapters.some(a => a.provider === provider);
        if (!hasAdapter) {
            const dynamicAdapter = this.createAdapterForProvider(provider, llm);
            if (dynamicAdapter) {
                agent.llm.registerAdapter(dynamicAdapter);
            }
        }
        // Copy tools from default agent
        for (const tool of this.defaultAgent.tools.getDefinitions()) {
            const registered = this.defaultAgent.tools.get(tool.name);
            if (registered) {
                agent.tools.register(tool, registered.handler);
            }
        }
        this.agents.set(mongoConfig._id, agent);
        return agent;
    }
    /** Create an LLM adapter from provider name and config */
    createAdapterForProvider(provider, llm) {
        const opts = { apiKey: llm.apiKey, model: llm.model || '', baseUrl: llm.baseUrl, temperature: llm.temperature, maxTokens: llm.maxTokens };
        switch (provider) {
            case 'openai': return new OpenAIAdapter(opts);
            case 'anthropic': return new AnthropicAdapter(opts);
            case 'ollama': {
                // Inherit baseUrl from shared Ollama adapter if not specified in config
                let ollamaBaseUrl = llm.baseUrl;
                if (!ollamaBaseUrl) {
                    const sharedOllama = this.adapters.find(a => a.provider === 'ollama');
                    ollamaBaseUrl = sharedOllama ? sharedOllama.baseUrl : 'http://localhost:11434';
                }
                return new OllamaAdapter({ baseUrl: ollamaBaseUrl.replace(/\/v1\/?$/, ''), model: llm.model || 'qwen2.5:14b' });
            }
            case 'deepseek': return new DeepSeekAdapter(opts);
            case 'xai': return new XAIAdapter(opts);
            case 'openrouter': return new OpenRouterAdapter(opts);
            case 'perplexity': return new PerplexityAdapter(opts);
            case 'groq': return new GroqAdapter(opts);
            case 'mistral': return new MistralAdapter(opts);
            case 'google': return new GeminiAdapter(opts);
            case 'huggingface': return new HuggingFaceAdapter(opts);
            case 'custom': return new OpenAIAdapter({ ...opts, baseUrl: llm.baseUrl });
            default: return null;
        }
    }
    /** Extract model name from an adapter (best-effort) */
    getAdapterModel(adapter) {
        return adapter.model ?? '';
    }
    /**
     * Create a CoordinatorAgent that wraps the given base agent config.
     * The coordinator uses the same LLM but has the spawn_agent tool pre-registered.
     * Returns both the coordinator and its TaskManager for observability.
     */
    createCoordinator(baseConfig, coordinatorConfig = { enabled: true }) {
        const taskManager = new TaskManager();
        const agentFactory = createInheritingAgentFactory(this.defaultAgent.tools, coordinatorConfig);
        // Register all shared adapters on the base config's agent instance
        const coordinatorBase = new Agent(baseConfig);
        for (const adapter of this.adapters) {
            coordinatorBase.llm.registerAdapter(adapter);
        }
        const coordinator = new CoordinatorAgent(baseConfig, coordinatorConfig, agentFactory);
        return { coordinator, taskManager };
    }
}
//# sourceMappingURL=agent-manager.js.map