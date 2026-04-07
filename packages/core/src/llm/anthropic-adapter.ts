import Anthropic from '@anthropic-ai/sdk';
import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent, ToolCall, TokenUsage } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';

export class AnthropicAdapter implements LLMAdapter {
  readonly provider = 'anthropic';
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: { apiKey?: string; model: string; maxTokens?: number; temperature?: number }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0.7;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemMsg?.content,
      messages: nonSystemMsgs.map((m) => this.toAnthropicMessage(m)),
      tools: tools?.length ? tools.map((t) => this.toAnthropicTool(t)) : undefined,
    });

    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
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

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemMsg?.content,
      messages: nonSystemMsgs.map((m) => this.toAnthropicMessage(m)),
      tools: tools?.length ? tools.map((t) => this.toAnthropicTool(t)) : undefined,
    });

    let currentToolId = '';
    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'tool_use') {
          currentToolId = block.id;
          yield { type: 'tool-call-start', toolCallId: block.id, toolName: block.name };
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield { type: 'text-delta', delta: delta.text };
        } else if (delta.type === 'input_json_delta') {
          yield { type: 'tool-call-args', toolCallId: currentToolId, argsJson: delta.partial_json };
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId) {
          yield { type: 'tool-call-end', toolCallId: currentToolId };
          currentToolId = '';
        }
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          usage.completionTokens = event.usage.output_tokens;
        }
      } else if (event.type === 'message_start') {
        if (event.message.usage) {
          usage.promptTokens = event.message.usage.input_tokens;
        }
      } else if (event.type === 'message_stop') {
        usage.totalTokens = usage.promptTokens + usage.completionTokens;
        yield { type: 'finish', usage, finishReason: 'stop' };
      }
    }
  }

  private toAnthropicMessage(msg: LLMMessage): Anthropic.MessageParam {
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const content: Anthropic.ContentBlockParam[] = [];
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
            tool_use_id: msg.toolCallId!,
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

  private toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
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
