var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
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
import Anthropic from '@anthropic-ai/sdk';
export class AnthropicAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'anthropic';
        this.client = new Anthropic({ apiKey: config.apiKey });
        this.model = config.model;
        this.maxTokens = (_a = config.maxTokens) !== null && _a !== void 0 ? _a : 4096;
        this.temperature = (_b = config.temperature) !== null && _b !== void 0 ? _b : 0.7;
    }
    async chat(messages, tools) {
        const systemMsg = messages.find((m) => m.role === 'system');
        const nonSystemMsgs = messages.filter((m) => m.role !== 'system');
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            system: systemMsg === null || systemMsg === void 0 ? void 0 : systemMsg.content,
            messages: nonSystemMsgs.map((m) => this.toAnthropicMessage(m)),
            tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => this.toAnthropicTool(t)) : undefined,
        });
        let content = '';
        const toolCalls = [];
        for (const block of response.content) {
            if (block.type === 'text') {
                content += block.text;
            }
            else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    arguments: block.input,
                });
            }
        }
        return {
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
            model: response.model,
            finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            var _a, e_1, _b, _c;
            const systemMsg = messages.find((m) => m.role === 'system');
            const nonSystemMsgs = messages.filter((m) => m.role !== 'system');
            const stream = this.client.messages.stream({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                system: systemMsg === null || systemMsg === void 0 ? void 0 : systemMsg.content,
                messages: nonSystemMsgs.map((m) => this.toAnthropicMessage(m)),
                tools: (tools === null || tools === void 0 ? void 0 : tools.length) ? tools.map((t) => this.toAnthropicTool(t)) : undefined,
            });
            let currentToolId = '';
            const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield __await(stream_1.next()), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const event = _c;
                    if (event.type === 'content_block_start') {
                        const block = event.content_block;
                        if (block.type === 'tool_use') {
                            currentToolId = block.id;
                            yield yield __await({ type: 'tool-call-start', toolCallId: block.id, toolName: block.name });
                        }
                    }
                    else if (event.type === 'content_block_delta') {
                        const delta = event.delta;
                        if (delta.type === 'text_delta') {
                            yield yield __await({ type: 'text-delta', delta: delta.text });
                        }
                        else if (delta.type === 'input_json_delta') {
                            yield yield __await({ type: 'tool-call-args', toolCallId: currentToolId, argsJson: delta.partial_json });
                        }
                    }
                    else if (event.type === 'content_block_stop') {
                        if (currentToolId) {
                            yield yield __await({ type: 'tool-call-end', toolCallId: currentToolId });
                            currentToolId = '';
                        }
                    }
                    else if (event.type === 'message_delta') {
                        if (event.usage) {
                            usage.completionTokens = event.usage.output_tokens;
                        }
                    }
                    else if (event.type === 'message_start') {
                        if (event.message.usage) {
                            usage.promptTokens = event.message.usage.input_tokens;
                        }
                    }
                    else if (event.type === 'message_stop') {
                        usage.totalTokens = usage.promptTokens + usage.completionTokens;
                        yield yield __await({ type: 'finish', usage, finishReason: 'stop' });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield __await(_b.call(stream_1));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    toAnthropicMessage(msg) {
        var _a;
        if (msg.role === 'assistant' && ((_a = msg.toolCalls) === null || _a === void 0 ? void 0 : _a.length)) {
            const content = [];
            if (msg.content) {
                content.push({ type: 'text', text: msg.content });
            }
            for (const tc of msg.toolCalls) {
                content.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.name,
                    input: tc.arguments,
                });
            }
            return { role: 'assistant', content };
        }
        if (msg.role === 'tool') {
            return {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: msg.toolCallId,
                        content: msg.content,
                    },
                ],
            };
        }
        return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
        };
    }
    toAnthropicTool(tool) {
        const properties = {};
        const required = [];
        for (const param of tool.parameters) {
            properties[param.name] = Object.assign({ type: param.type, description: param.description }, (param.enum ? { enum: param.enum } : {}));
            if (param.required)
                required.push(param.name);
        }
        return {
            name: tool.name,
            description: tool.description,
            input_schema: {
                type: 'object',
                properties,
                required,
            },
        };
    }
}
