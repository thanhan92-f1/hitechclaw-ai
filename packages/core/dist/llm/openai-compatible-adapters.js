import OpenAI from 'openai';
/**
 * DeepSeek adapter — OpenAI-compatible API.
 * Base URL: https://api.deepseek.com
 * Models: deepseek-chat, deepseek-reasoner
 */
export class DeepSeekAdapter {
    provider = 'deepseek';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com',
        });
        this.model = config.model || 'deepseek-chat';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        const toolCalls = choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
        }));
        return {
            content: choice.message.content || '',
            toolCalls,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield {
                    type: 'finish',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    finishReason: chunk.choices[0].finish_reason,
                };
            }
        }
    }
}
/**
 * xAI (Grok) adapter — OpenAI-compatible API.
 * Base URL: https://api.x.ai/v1
 * Models: grok-2, grok-2-mini
 */
export class XAIAdapter {
    provider = 'xai';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.XAI_API_KEY,
            baseURL: 'https://api.x.ai/v1',
        });
        this.model = config.model || 'grok-2';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield {
                    type: 'finish',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    finishReason: chunk.choices[0].finish_reason,
                };
            }
        }
    }
}
/**
 * OpenRouter adapter — Unified API gateway for 100+ models.
 * Base URL: https://openrouter.ai/api/v1
 * Models: meta-llama/llama-3.1-70b, google/gemini-pro, etc.
 */
export class OpenRouterAdapter {
    provider = 'openrouter';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://hitechclaw.ai',
                'X-Title': 'HiTechClaw AI Platform',
            },
        });
        this.model = config.model || 'meta-llama/llama-3.1-70b-instruct';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield {
                    type: 'finish',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    finishReason: chunk.choices[0].finish_reason,
                };
            }
        }
    }
}
/**
 * Perplexity adapter — Search-augmented LLM API.
 * Base URL: https://api.perplexity.ai
 * Models: llama-3.1-sonar-large-128k-online, llama-3.1-sonar-small-128k-online
 */
export class PerplexityAdapter {
    provider = 'perplexity';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai',
        });
        this.model = config.model || 'llama-3.1-sonar-large-128k-online';
        this.temperature = config.temperature ?? 0.2;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages) {
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
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason,
        };
    }
    async *chatStream(messages) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield {
                    type: 'finish',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                    finishReason: chunk.choices[0].finish_reason,
                };
            }
        }
    }
}
/**
 * Groq adapter — Ultra-fast inference via GroqCloud.
 * Base URL: https://api.groq.com/openai/v1
 * Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
 */
export class GroqAdapter {
    provider = 'groq';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });
        this.model = config.model || 'llama-3.3-70b-versatile';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 8192;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield { type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason };
            }
        }
    }
}
/**
 * Mistral adapter — Mistral AI API.
 * Base URL: https://api.mistral.ai/v1
 * Models: mistral-large-latest, mistral-small-latest, codestral-latest
 */
export class MistralAdapter {
    provider = 'mistral';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
            baseURL: 'https://api.mistral.ai/v1',
        });
        this.model = config.model || 'mistral-large-latest';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield { type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason };
            }
        }
    }
}
/**
 * Gemini adapter — Google Gemini via OpenAI-compatible REST endpoint.
 * Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
 * Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
 */
export class GeminiAdapter {
    provider = 'gemini';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.GEMINI_API_KEY,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
        this.model = config.model || 'gemini-2.0-flash';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 8192;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield { type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason };
            }
        }
    }
}
/**
 * HuggingFace adapter — OpenAI-compatible Inference API.
 * Base URL: https://api-inference.huggingface.co/v1/
 * Models: meta-llama/Llama-3.1-70B-Instruct, mistralai/Mixtral-8x7B-Instruct-v0.1, etc.
 */
export class HuggingFaceAdapter {
    provider = 'huggingface';
    client;
    model;
    temperature;
    maxTokens;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY,
            baseURL: config.baseUrl || 'https://api-inference.huggingface.co/v1/',
        });
        this.model = config.model || 'meta-llama/Llama-3.1-70B-Instruct';
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4096;
    }
    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
        });
        const choice = response.choices[0];
        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls?.map((tc) => ({
                id: tc.id, name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
            })),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
            model: response.model,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map((m) => toOpenAIMessage(m)),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            tools: tools?.length ? tools.map((t) => toOpenAITool(t)) : undefined,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content)
                yield { type: 'text-delta', delta: delta.content };
            if (chunk.choices[0]?.finish_reason) {
                yield { type: 'finish', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: chunk.choices[0].finish_reason };
            }
        }
    }
}
// ─── Shared Helpers ─────────────────────────────────────────
function toOpenAIMessage(msg) {
    if (msg.role === 'tool') {
        return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId };
    }
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
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
        properties[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
        };
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
//# sourceMappingURL=openai-compatible-adapters.js.map