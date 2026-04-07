var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
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
    constructor(config) {
        this.adapters = new Map();
        this.config = config;
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.provider, adapter);
    }
    setConfig(config) {
        this.config = config;
    }
    getAdapter(provider) {
        const p = provider !== null && provider !== void 0 ? provider : this.config.provider;
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
        var _a, _b;
        if ((_a = options === null || options === void 0 ? void 0 : options.fallbackChain) === null || _a === void 0 ? void 0 : _a.length)
            return options.fallbackChain;
        const primary = (_b = options === null || options === void 0 ? void 0 : options.preferProvider) !== null && _b !== void 0 ? _b : this.config.provider;
        const routingChain = (options === null || options === void 0 ? void 0 : options.taskComplexity) ? ROUTING_CHAINS[options.taskComplexity] : [];
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
        const adapterOpts = (options === null || options === void 0 ? void 0 : options.responseFormat) ? { responseFormat: options.responseFormat } : undefined;
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
        throw lastError !== null && lastError !== void 0 ? lastError : new Error(`All providers in chain failed: ${chain.join(', ')}`);
    }
    chatStream(messages, tools, options) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            const chain = this.resolveChain(options);
            const adapterOpts = (options === null || options === void 0 ? void 0 : options.responseFormat) ? { responseFormat: options.responseFormat } : undefined;
            let lastError;
            for (const provider of chain) {
                const adapter = this.adapters.get(provider);
                if (!adapter)
                    continue;
                try {
                    yield __await(yield* __asyncDelegator(__asyncValues(adapter.chatStream(messages, tools, adapterOpts))));
                    return yield __await(void 0); // stream completed successfully
                }
                catch (err) {
                    lastError = err;
                    const msg = err instanceof Error ? err.message : String(err);
                    console.warn(`[LLMRouter] Stream provider "${provider}" failed: ${msg}. Trying next…`);
                }
            }
            throw lastError !== null && lastError !== void 0 ? lastError : new Error(`All stream providers in chain failed: ${chain.join(', ')}`);
        });
    }
    /** Returns available (registered) providers. */
    getAvailableProviders() {
        return [...this.adapters.keys()];
    }
}
