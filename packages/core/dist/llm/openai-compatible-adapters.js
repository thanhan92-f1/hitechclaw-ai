var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
import OpenAI from 'openai';
/**
 * DeepSeek adapter — OpenAI-compatible API.
 * Base URL: https://api.deepseek.com
 * Models: deepseek-chat, deepseek-reasoner
 */
export class DeepSeekAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'deepseek';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com',
        });
        this.model = config.model || 'deepseek-chat';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        const toolCalls = (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
        }));
        return {
            content: choice.message.content || '',
            toolCalls,
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            var _a, e_1, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _f = true) {
                    _c = stream_1_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({
                            type: 'finish',
                            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                            finishReason: chunk.choices[0].finish_reason,
                        });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
}
/**
 * xAI (Grok) adapter — OpenAI-compatible API.
 * Base URL: https://api.x.ai/v1
 * Models: grok-2, grok-2-mini
 */
export class XAIAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'xai';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.XAI_API_KEY,
            baseURL: 'https://api.x.ai/v1',
        });
        this.model = config.model || 'grok-2';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_2() {
            var _a, e_2, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_2 = __asyncValues(stream), stream_2_1; stream_2_1 = yield __await(stream_2.next()), _a = stream_2_1.done, !_a; _f = true) {
                    _c = stream_2_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({
                            type: 'finish',
                            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                            finishReason: chunk.choices[0].finish_reason,
                        });
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_2.return)) yield __await(_b.call(stream_2));
                }
                finally { if (e_2) throw e_2.error; }
            }
        });
    }
}
/**
 * OpenRouter adapter — Unified API gateway for 100+ models.
 * Base URL: https://openrouter.ai/api/v1
 * Models: meta-llama/llama-3.1-70b, google/gemini-pro, etc.
 */
export class OpenRouterAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'openrouter';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://hitechclaw.ai',
                'X-Title': 'HiTechClaw AI Platform',
            },
        });
        this.model = config.model || 'meta-llama/llama-3.1-70b-instruct';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_3() {
            var _a, e_3, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_3 = __asyncValues(stream), stream_3_1; stream_3_1 = yield __await(stream_3.next()), _a = stream_3_1.done, !_a; _f = true) {
                    _c = stream_3_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({
                            type: 'finish',
                            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                            finishReason: chunk.choices[0].finish_reason,
                        });
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_3.return)) yield __await(_b.call(stream_3));
                }
                finally { if (e_3) throw e_3.error; }
            }
        });
    }
}
/**
 * Perplexity adapter — Search-augmented LLM API.
 * Base URL: https://api.perplexity.ai
 * Models: llama-3.1-sonar-large-128k-online, llama-3.1-sonar-small-128k-online
 */
export class PerplexityAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'perplexity';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai',
        });
        this.model = config.model || 'llama-3.1-sonar-large-128k-online';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.2;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages) {
        var _a, _b, _c, _d, _e, _f;
        // Perplexity doesn't support tool calling, so we ignore tools
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            usage: {
                promptTokens: (_b = (_a = response.usage) === null || _a === void 0 ? void 0 : _a.prompt_tokens) !== null && _b !== void 0 ? _b : 0,
                completionTokens: (_d = (_c = response.usage) === null || _c === void 0 ? void 0 : _c.completion_tokens) !== null && _d !== void 0 ? _d : 0,
                totalTokens: (_f = (_e = response.usage) === null || _e === void 0 ? void 0 : _e.total_tokens) !== null && _f !== void 0 ? _f : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason,
        };
    }
    chatStream(messages) {
        return __asyncGenerator(this, arguments, function* chatStream_4() {
            var _a, e_4, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                stream: true,
            }));
            try {
                for (var _f = true, stream_4 = __asyncValues(stream), stream_4_1; stream_4_1 = yield __await(stream_4.next()), _a = stream_4_1.done, !_a; _f = true) {
                    _c = stream_4_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({
                            type: 'finish',
                            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                            finishReason: chunk.choices[0].finish_reason,
                        });
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_4.return)) yield __await(_b.call(stream_4));
                }
                finally { if (e_4) throw e_4.error; }
            }
        });
    }
}
/**
 * Groq adapter — Ultra-fast inference via GroqCloud.
 * Base URL: https://api.groq.com/openai/v1
 * Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
 */
export class GroqAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'groq';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });
        this.model = config.model || 'llama-3.3-70b-versatile';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 8192;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_5() {
            var _a, e_5, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_5 = __asyncValues(stream), stream_5_1; stream_5_1 = yield __await(stream_5.next()), _a = stream_5_1.done, !_a; _f = true) {
                    _c = stream_5_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({ type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason });
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_5.return)) yield __await(_b.call(stream_5));
                }
                finally { if (e_5) throw e_5.error; }
            }
        });
    }
}
/**
 * Mistral adapter — Mistral AI API.
 * Base URL: https://api.mistral.ai/v1
 * Models: mistral-large-latest, mistral-small-latest, codestral-latest
 */
export class MistralAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'mistral';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
            baseURL: 'https://api.mistral.ai/v1',
        });
        this.model = config.model || 'mistral-large-latest';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_6() {
            var _a, e_6, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_6 = __asyncValues(stream), stream_6_1; stream_6_1 = yield __await(stream_6.next()), _a = stream_6_1.done, !_a; _f = true) {
                    _c = stream_6_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({ type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason });
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_6.return)) yield __await(_b.call(stream_6));
                }
                finally { if (e_6) throw e_6.error; }
            }
        });
    }
}
/**
 * Gemini adapter — Google Gemini via OpenAI-compatible REST endpoint.
 * Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
 * Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
 */
export class GeminiAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'gemini';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.GEMINI_API_KEY,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
        this.model = config.model || 'gemini-2.0-flash';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 8192;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_7() {
            var _a, e_7, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_7 = __asyncValues(stream), stream_7_1; stream_7_1 = yield __await(stream_7.next()), _a = stream_7_1.done, !_a; _f = true) {
                    _c = stream_7_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({ type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason });
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_7.return)) yield __await(_b.call(stream_7));
                }
                finally { if (e_7) throw e_7.error; }
            }
        });
    }
}
/**
 * HuggingFace adapter — OpenAI-compatible Inference API.
 * Base URL: https://api-inference.huggingface.co/v1/
 * Models: meta-llama/Llama-3.1-70B-Instruct, mistralai/Mixtral-8x7B-Instruct-v0.1, etc.
 */
export class HuggingFaceAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'huggingface';
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY,
            baseURL: config.baseUrl || 'https://api-inference.huggingface.co/v1/',
        });
        this.model = config.model || 'meta-llama/Llama-3.1-70B-Instruct';
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: (_a = choice.message.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: (_c = (_b = response.usage) === null || _b === void 0 ? void 0 : _b.prompt_tokens) !== null && _c !== void 0 ? _c : 0,
                completionTokens: (_e = (_d = response.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) !== null && _e !== void 0 ? _e : 0,
                totalTokens: (_g = (_f = response.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) !== null && _g !== void 0 ? _g : 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_8() {
            var _a, e_8, _b, _c;
            var _d, _e;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => toOpenAITool(t)) : undefined,
                stream: true,
            }));
            try {
                for (var _f = true, stream_8 = __asyncValues(stream), stream_8_1; stream_8_1 = yield __await(stream_8.next()), _a = stream_8_1.done, !_a; _f = true) {
                    _c = stream_8_1.value;
                    _f = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    if (delta.content)
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    if ((_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.finish_reason) {
                        yield yield __await({ type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason });
                    }
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_8.return)) yield __await(_b.call(stream_8));
                }
                finally { if (e_8) throw e_8.error; }
            }
        });
    }
}
// ─── Shared Helpers ─────────────────────────────────────────
function toOpenAIMessage(msg) {
    var _a;
    if (msg.role === 'tool') {
        return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId };
    }
    if (msg.role === 'assistant' && ((_a = msg.toolCalls) === null || _a === void 0 ? void 0 : _a.length)) {
        return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
        };
    }
    return { role: msg.role, content: msg.content };
}
function toOpenAITool(tool) {
    const properties = {};
    const required = [];
    for (const param of tool.parameters) {
        properties[param.name] = Object.assign({ type: param.type, description: param.description }, (param.enum ? { enum: param.enum } : {}));
        if (param.required)
            required.push(param.name);
    }
    return {
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: { type: 'object', properties, required },
        },
    };
}
