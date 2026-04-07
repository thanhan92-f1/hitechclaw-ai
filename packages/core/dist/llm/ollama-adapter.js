// ============================================================
// Ollama Adapter — Native Ollama integration with multi-model support
// Uses Ollama REST API directly (not through OpenAI compat layer)
// ============================================================
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
export class OllamaAdapter {
    constructor(config) {
        var _a, _b;
        this.provider = 'ollama';
        this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        this.model = config.model;
        this.temperature = (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7;
        this.maxTokens = (_b = config.maxTokens) !== null && _b !== void 0 ? _b : 4096;
    }
    // ─── LLMAdapter interface ──────────────────────────────────
    async chat(messages, tools) {
        var _a, _b, _c, _d, _e;
        // Log vision usage
        const visionMsgs = messages.filter(m => { var _a; return (_a = m.images) === null || _a === void 0 ? void 0 : _a.length; });
        if (visionMsgs.length) {
            console.log(`[Ollama] 👁️ Vision request: ${visionMsgs.length} message(s) with images, model=${this.model}`);
        }
        const body = {
            model: this.model,
            messages: messages.map((m) => this.toOllamaMessage(m)),
            stream: false,
            options: {
                temperature: this.temperature,
                num_predict: this.maxTokens,
            },
        };
        if (tools === null || tools === void 0 ? void 0 : tools.length) {
            body.tools = tools.map((t) => this.toOllamaTool(t));
        }
        let res = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        // Retry without tools if model doesn't support them
        if (!res.ok && (tools === null || tools === void 0 ? void 0 : tools.length)) {
            const err = await res.text();
            if (res.status === 400 && err.includes('does not support tools')) {
                console.log(`[Ollama] Model ${this.model} does not support tools, retrying without tools`);
                delete body.tools;
                res = await fetch(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
            }
            else {
                throw new Error(`Ollama chat failed: ${res.status} ${err}`);
            }
        }
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Ollama chat failed: ${res.status} ${err}`);
        }
        const data = await res.json();
        const msg = data.message;
        const toolCalls = (_a = msg.tool_calls) === null || _a === void 0 ? void 0 : _a.map((tc, i) => ({
            id: `ollama-tc-${Date.now()}-${i}`,
            name: tc.function.name,
            arguments: tc.function.arguments,
        }));
        return {
            content: msg.content || '',
            toolCalls,
            usage: {
                promptTokens: (_b = data.prompt_eval_count) !== null && _b !== void 0 ? _b : 0,
                completionTokens: (_c = data.eval_count) !== null && _c !== void 0 ? _c : 0,
                totalTokens: ((_d = data.prompt_eval_count) !== null && _d !== void 0 ? _d : 0) + ((_e = data.eval_count) !== null && _e !== void 0 ? _e : 0),
            },
            model: data.model,
            finishReason: (toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls.length) ? 'tool_calls' : 'stop',
        };
    }
    chatStream(messages, tools) {
        return __asyncGenerator(this, arguments, function* chatStream_1() {
            var _a, _b;
            const body = {
                model: this.model,
                messages: messages.map((m) => this.toOllamaMessage(m)),
                stream: true,
                options: {
                    temperature: this.temperature,
                    num_predict: this.maxTokens,
                },
            };
            if (tools === null || tools === void 0 ? void 0 : tools.length) {
                body.tools = tools.map((t) => this.toOllamaTool(t));
            }
            let res = yield __await(fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }));
            // Retry without tools if model doesn't support them
            if (!res.ok && (tools === null || tools === void 0 ? void 0 : tools.length)) {
                const err = yield __await(res.text());
                if (res.status === 400 && err.includes('does not support tools')) {
                    console.log(`[Ollama] Model ${this.model} does not support tools, retrying without tools (stream)`);
                    delete body.tools;
                    res = yield __await(fetch(`${this.baseUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    }));
                }
                else {
                    yield yield __await({ type: 'error', error: `Ollama stream failed: ${res.status} ${err}` });
                    return yield __await(void 0);
                }
            }
            if (!res.ok) {
                const err = yield __await(res.text());
                yield yield __await({ type: 'error', error: `Ollama stream failed: ${res.status} ${err}` });
                return yield __await(void 0);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let promptTokens = 0;
            let completionTokens = 0;
            while (true) {
                const { done, value } = yield __await(reader.read());
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const chunk = JSON.parse(line);
                        const msg = chunk.message;
                        if (msg === null || msg === void 0 ? void 0 : msg.content) {
                            yield yield __await({ type: 'text-delta', delta: msg.content });
                        }
                        if (msg === null || msg === void 0 ? void 0 : msg.tool_calls) {
                            for (let i = 0; i < msg.tool_calls.length; i++) {
                                const tc = msg.tool_calls[i];
                                const tcId = `ollama-tc-${Date.now()}-${i}`;
                                yield yield __await({ type: 'tool-call-start', toolCallId: tcId, toolName: tc.function.name });
                                yield yield __await({ type: 'tool-call-args', toolCallId: tcId, argsJson: JSON.stringify(tc.function.arguments) });
                                yield yield __await({ type: 'tool-call-end', toolCallId: tcId });
                            }
                        }
                        if (chunk.done) {
                            promptTokens = (_a = chunk.prompt_eval_count) !== null && _a !== void 0 ? _a : 0;
                            completionTokens = (_b = chunk.eval_count) !== null && _b !== void 0 ? _b : 0;
                            yield yield __await({
                                type: 'finish',
                                usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
                                finishReason: 'stop',
                            });
                        }
                    }
                    catch (_c) {
                        // skip malformed JSON
                    }
                }
            }
        });
    }
    // ─── Ollama management APIs ────────────────────────────────
    /** Check if Ollama is reachable */
    async isRunning() {
        try {
            const res = await fetch(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
            return res.ok;
        }
        catch (_a) {
            return false;
        }
    }
    /** Get Ollama version */
    async getVersion() {
        try {
            const res = await fetch(`${this.baseUrl}/api/version`);
            if (!res.ok)
                return null;
            const data = await res.json();
            return data.version;
        }
        catch (_a) {
            return null;
        }
    }
    /** List all locally available models */
    async listModels() {
        const res = await fetch(`${this.baseUrl}/api/tags`);
        if (!res.ok)
            throw new Error('Failed to list Ollama models');
        const data = await res.json();
        return data.models.map((m) => {
            var _a, _b, _c;
            return ({
                name: m.name,
                parameterSize: ((_a = m.details) === null || _a === void 0 ? void 0 : _a.parameterSize) || 'unknown',
                family: ((_b = m.details) === null || _b === void 0 ? void 0 : _b.family) || 'unknown',
                quantization: ((_c = m.details) === null || _c === void 0 ? void 0 : _c.quantizationLevel) || 'unknown',
                sizeMB: Math.round(m.size / 1024 / 1024),
            });
        });
    }
    /** Get full health status */
    async getHealthStatus() {
        const running = await this.isRunning();
        if (!running) {
            return { running: false, models: [], gpuAvailable: false };
        }
        const version = await this.getVersion();
        const models = await this.listModels().catch(() => []);
        // Check GPU via show endpoint (if a model is loaded)
        let gpuAvailable = false;
        if (models.length > 0) {
            try {
                const res = await fetch(`${this.baseUrl}/api/show`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: models[0].name }),
                });
                if (res.ok) {
                    const info = await res.text();
                    gpuAvailable = info.includes('gpu') || info.includes('cuda') || info.includes('metal');
                }
            }
            catch ( /* ignore */_a) { /* ignore */ }
        }
        return { running, version: version !== null && version !== void 0 ? version : undefined, models, gpuAvailable };
    }
    /** Pull (download) a model */
    pullModel(modelName) {
        return __asyncGenerator(this, arguments, function* pullModel_1() {
            const res = yield __await(fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: true }),
            }));
            if (!res.ok) {
                throw new Error(`Failed to pull model ${modelName}: ${res.status}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = yield __await(reader.read());
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const data = JSON.parse(line);
                        yield yield __await(data);
                    }
                    catch ( /* skip */_a) { /* skip */ }
                }
            }
        });
    }
    /** Delete a model */
    async deleteModel(modelName) {
        const res = await fetch(`${this.baseUrl}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
        });
        return res.ok;
    }
    /** Get model info */
    async getModelInfo(modelName) {
        try {
            const res = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
            });
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch (_a) {
            return null;
        }
    }
    /** Switch the active model */
    setModel(model) {
        this.model = model;
    }
    getModel() {
        return this.model;
    }
    getBaseUrl() {
        return this.baseUrl;
    }
    // ─── Private helpers ───────────────────────────────────────
    toOllamaMessage(msg) {
        var _a, _b;
        const result = { role: msg.role, content: msg.content };
        // Pass images for vision models (qwen2.5vl, llava, etc.)
        if ((_a = msg.images) === null || _a === void 0 ? void 0 : _a.length) {
            result.images = msg.images.map((img) => {
                // Strip data URL prefix if present, Ollama expects raw base64
                const base64Match = img.match(/^data:[^;]+;base64,(.+)$/);
                return base64Match ? base64Match[1] : img;
            });
        }
        if (msg.role === 'assistant' && ((_b = msg.toolCalls) === null || _b === void 0 ? void 0 : _b.length)) {
            result.tool_calls = msg.toolCalls.map((tc) => ({
                function: { name: tc.name, arguments: tc.arguments },
            }));
        }
        return result;
    }
    toOllamaTool(tool) {
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
}
