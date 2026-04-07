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
export class OpenAIAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'openai';
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
        this.model = config.model;
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e, _f, _g;
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => this.toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => this.toOpenAITool(t)) : undefined,
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
            var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const stream = yield __await(this.client.chat.completions.create({
                model: this.model,
                messages: messages.map((m) => this.toOpenAIMessage(m)),
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => this.toOpenAITool(t)) : undefined,
                stream: true,
            }));
            const toolCallBuffers = new Map();
            try {
                for (var _r = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _r = true) {
                    _c = stream_1_1.value;
                    _r = false;
                    const chunk = _c;
                    const delta = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta;
                    if (!delta)
                        continue;
                    // Text content
                    if (delta.content) {
                        yield yield __await({ type: 'text-delta', delta: delta.content });
                    }
                    // Tool calls
                    if (delta.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index;
                            if (!toolCallBuffers.has(idx)) {
                                toolCallBuffers.set(idx, { id: tc.id || '', name: ((_e = tc.function) === null || _e === void 0 ? void 0 : _e.name) || '', args: '' });
                                if (tc.id && ((_f = tc.function) === null || _f === void 0 ? void 0 : _f.name)) {
                                    yield yield __await({ type: 'tool-call-start', toolCallId: tc.id, toolName: tc.function.name });
                                }
                            }
                            const buf = toolCallBuffers.get(idx);
                            if (tc.id)
                                buf.id = tc.id;
                            if ((_g = tc.function) === null || _g === void 0 ? void 0 : _g.name)
                                buf.name = tc.function.name;
                            if ((_h = tc.function) === null || _h === void 0 ? void 0 : _h.arguments) {
                                buf.args += tc.function.arguments;
                                yield yield __await({ type: 'tool-call-args', toolCallId: buf.id, argsJson: tc.function.arguments });
                            }
                        }
                    }
                    // Finish
                    if ((_j = chunk.choices[0]) === null || _j === void 0 ? void 0 : _j.finish_reason) {
                        for (const [, buf] of toolCallBuffers) {
                            yield yield __await({ type: 'tool-call-end', toolCallId: buf.id });
                        }
                        yield yield __await({
                            type: 'finish',
                            usage: {
                                promptTokens: (_l = (_k = chunk.usage) === null || _k === void 0 ? void 0 : _k.prompt_tokens) !== null && _l !== void 0 ? _l : 0,
                                completionTokens: (_o = (_m = chunk.usage) === null || _m === void 0 ? void 0 : _m.completion_tokens) !== null && _o !== void 0 ? _o : 0,
                                totalTokens: (_q = (_p = chunk.usage) === null || _p === void 0 ? void 0 : _p.total_tokens) !== null && _q !== void 0 ? _q : 0,
                            },
                            finishReason: chunk.choices[0].finish_reason,
                        });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_r && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    toOpenAIMessage(msg) {
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
    toOpenAITool(tool) {
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
                parameters: {
                    type: 'object',
                    properties,
                    required,
                },
            },
        };
    }
}
