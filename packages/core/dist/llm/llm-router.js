/**
 * Provider preference chains per task complexity.
 * The router tries each provider in order and falls back on errors.
 */
const ROUTING_CHAINS = {
    // Low-latency tasks: prefer Groq → Ollama → OpenAI
    fast: ['groq', 'ollama', 'openai', 'anthropic'],
    // Highest-quality tasks: prefer Anthropic → OpenAI → Mistral → Groq
    smart: ['anthropic', 'openai', 'mistral', 'groq'],
    // Cost-sensitive tasks: prefer Ollama → DeepSeek → Groq → OpenAI
    cheap: ['ollama', 'deepseek', 'groq', 'mistral', 'openai'],
};
export class LLMRouter {
    adapters = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.provider, adapter);
    }
    setConfig(config) {
        this.config = config;
    }
    getAdapter(provider) {
        const p = provider ?? this.config.provider;
        const adapter = this.adapters.get(p);
        if (!adapter) {
            throw new Error(`No adapter registered for provider "${p}". ` +
                `Available: ${[...this.adapters.keys()].join(', ')}`);
        }
        return adapter;
    }
    /**
     * Build the ordered provider chain for a call.
     * Priority: explicit fallbackChain > preferProvider (+ routing table) > config.provider
     */
    resolveChain(options) {
        if (options?.fallbackChain?.length)
            return options.fallbackChain;
        const primary = options?.preferProvider ?? this.config.provider;
        const routingChain = options?.taskComplexity ? ROUTING_CHAINS[options.taskComplexity] : [];
        // Build unique ordered list: primary first, then routing chain providers, skipping duplicates
        const seen = new Set();
        const chain = [];
        for (const p of [primary, ...routingChain]) {
            if (!seen.has(p)) {
                seen.add(p);
                chain.push(p);
            }
        }
        return chain;
    }
    async chat(messages, tools, options) {
        const chain = this.resolveChain(options);
        const adapterOpts = options?.responseFormat ? { responseFormat: options.responseFormat } : undefined;
        let lastError;
        for (const provider of chain) {
            const adapter = this.adapters.get(provider);
            if (!adapter)
                continue; // skip unavailable providers silently
            try {
                return await adapter.chat(messages, tools, adapterOpts);
            }
            catch (err) {
                lastError = err;
                // Log and try next provider in chain
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[LLMRouter] Provider "${provider}" failed: ${msg}. Trying next in chain…`);
            }
        }
        throw lastError ?? new Error(`All providers in chain failed: ${chain.join(', ')}`);
    }
    async *chatStream(messages, tools, options) {
        const chain = this.resolveChain(options);
        const adapterOpts = options?.responseFormat ? { responseFormat: options.responseFormat } : undefined;
        let lastError;
        for (const provider of chain) {
            const adapter = this.adapters.get(provider);
            if (!adapter)
                continue;
            try {
                yield* adapter.chatStream(messages, tools, adapterOpts);
                return; // stream completed successfully
            }
            catch (err) {
                lastError = err;
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[LLMRouter] Stream provider "${provider}" failed: ${msg}. Trying next…`);
            }
        }
        throw lastError ?? new Error(`All stream providers in chain failed: ${chain.join(', ')}`);
    }
    /** Returns available (registered) providers. */
    getAvailableProviders() {
        return [...this.adapters.keys()];
    }
}
//# sourceMappingURL=llm-router.js.map