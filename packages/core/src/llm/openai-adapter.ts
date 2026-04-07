import OpenAI from 'openai';
import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent, ToolCall } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';

export class OpenAIAdapter implements LLMAdapter {
  readonly provider = 'openai';
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: { apiKey?: string; baseUrl?: string; model: string; temperature?: number; maxTokens?: number }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => this.toOpenAIMessage(m)),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      tools: tools?.length ? tools.map((t) => this.toOpenAITool(t)) : undefined,
    });

    const choice = response.choices[0];
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
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
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason as LLMResponse['finishReason'],
    };
  }

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => this.toOpenAIMessage(m)),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      tools: tools?.length ? tools.map((t) => this.toOpenAITool(t)) : undefined,
      stream: true,
    });

    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Text content
      if (delta.content) {
        yield { type: 'text-delta', delta: delta.content };
      }

      // Tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            if (tc.id && tc.function?.name) {
              yield { type: 'tool-call-start', toolCallId: tc.id, toolName: tc.function.name };
            }
          }
          const buf = toolCallBuffers.get(idx)!;
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name = tc.function.name;
          if (tc.function?.arguments) {
            buf.args += tc.function.arguments;
            yield { type: 'tool-call-args', toolCallId: buf.id, argsJson: tc.function.arguments };
          }
        }
      }

      // Finish
      if (chunk.choices[0]?.finish_reason) {
        for (const [, buf] of toolCallBuffers) {
          yield { type: 'tool-call-end', toolCallId: buf.id };
        }
        yield {
          type: 'finish',
          usage: {
            promptTokens: chunk.usage?.prompt_tokens ?? 0,
            completionTokens: chunk.usage?.completion_tokens ?? 0,
            totalTokens: chunk.usage?.total_tokens ?? 0,
          },
          finishReason: chunk.choices[0].finish_reason,
        };
      }
    }
  }

  private toOpenAIMessage(msg: LLMMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (msg.role === 'tool') {
      return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId! };
    }
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam;
  }

  private toOpenAITool(tool: ToolDefinition): OpenAI.Chat.ChatCompletionTool {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of tool.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        ...(param.enum ? { enum: param.enum } : {}),
      };
      if (param.required) required.push(param.name);
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
