// ============================================================
// Ollama Adapter — Native Ollama integration with multi-model support
// Uses Ollama REST API directly (not through OpenAI compat layer)
// ============================================================

import type { LLMMessage, LLMResponse, ToolDefinition, StreamEvent, ToolCall } from '@hitechclaw/shared';
import type { LLMAdapter } from './llm-router.js';

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface OllamaModelInfo {
  name: string;
  parameterSize: string;
  family: string;
  quantization: string;
  sizeMB: number;
}

export interface OllamaHealthStatus {
  running: boolean;
  version?: string;
  models: OllamaModelInfo[];
  gpuAvailable: boolean;
}

export class OllamaAdapter implements LLMAdapter {
  readonly provider = 'ollama';
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: {
    baseUrl?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  // ─── LLMAdapter interface ──────────────────────────────────

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    // Log vision usage
    const visionMsgs = messages.filter(m => m.images?.length);
    if (visionMsgs.length) {
      console.log(`[Ollama] 👁️ Vision request: ${visionMsgs.length} message(s) with images, model=${this.model}`);
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => this.toOllamaMessage(m)),
      stream: false,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens,
      },
    };

    if (tools?.length) {
      body.tools = tools.map((t) => this.toOllamaTool(t));
    }

    let res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Retry without tools if model doesn't support them
    if (!res.ok && tools?.length) {
      const err = await res.text();
      if (res.status === 400 && err.includes('does not support tools')) {
        console.log(`[Ollama] Model ${this.model} does not support tools, retrying without tools`);
        delete body.tools;
        res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        throw new Error(`Ollama chat failed: ${res.status} ${err}`);
      }
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama chat failed: ${res.status} ${err}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const msg = data.message as { role: string; content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };

    const toolCalls: ToolCall[] | undefined = msg.tool_calls?.map((tc, i) => ({
      id: `ollama-tc-${Date.now()}-${i}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: msg.content || '',
      toolCalls,
      usage: {
        promptTokens: (data.prompt_eval_count as number) ?? 0,
        completionTokens: (data.eval_count as number) ?? 0,
        totalTokens: ((data.prompt_eval_count as number) ?? 0) + ((data.eval_count as number) ?? 0),
      },
      model: data.model as string,
      finishReason: toolCalls?.length ? 'tool_calls' : 'stop',
    };
  }

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => this.toOllamaMessage(m)),
      stream: true,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens,
      },
    };

    if (tools?.length) {
      body.tools = tools.map((t) => this.toOllamaTool(t));
    }

    let res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Retry without tools if model doesn't support them
    if (!res.ok && tools?.length) {
      const err = await res.text();
      if (res.status === 400 && err.includes('does not support tools')) {
        console.log(`[Ollama] Model ${this.model} does not support tools, retrying without tools (stream)`);
        delete body.tools;
        res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        yield { type: 'error', error: `Ollama stream failed: ${res.status} ${err}` };
        return;
      }
    }

    if (!res.ok) {
      const err = await res.text();
      yield { type: 'error', error: `Ollama stream failed: ${res.status} ${err}` };
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let promptTokens = 0;
    let completionTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as Record<string, unknown>;
          const msg = chunk.message as { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> } | undefined;

          if (msg?.content) {
            yield { type: 'text-delta', delta: msg.content };
          }

          if (msg?.tool_calls) {
            for (let i = 0; i < msg.tool_calls.length; i++) {
              const tc = msg.tool_calls[i];
              const tcId = `ollama-tc-${Date.now()}-${i}`;
              yield { type: 'tool-call-start', toolCallId: tcId, toolName: tc.function.name };
              yield { type: 'tool-call-args', toolCallId: tcId, argsJson: JSON.stringify(tc.function.arguments) };
              yield { type: 'tool-call-end', toolCallId: tcId };
            }
          }

          if (chunk.done) {
            promptTokens = (chunk.prompt_eval_count as number) ?? 0;
            completionTokens = (chunk.eval_count as number) ?? 0;
            yield {
              type: 'finish',
              usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
              finishReason: 'stop',
            };
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  }

  // ─── Ollama management APIs ────────────────────────────────

  /** Check if Ollama is reachable */
  async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get Ollama version */
  async getVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`);
      if (!res.ok) return null;
      const data = await res.json() as { version: string };
      return data.version;
    } catch {
      return null;
    }
  }

  /** List all locally available models */
  async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error('Failed to list Ollama models');
    const data = await res.json() as { models: OllamaModel[] };
    return data.models.map((m) => ({
      name: m.name,
      parameterSize: m.details?.parameterSize || 'unknown',
      family: m.details?.family || 'unknown',
      quantization: m.details?.quantizationLevel || 'unknown',
      sizeMB: Math.round(m.size / 1024 / 1024),
    }));
  }

  /** Get full health status */
  async getHealthStatus(): Promise<OllamaHealthStatus> {
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
      } catch { /* ignore */ }
    }

    return { running, version: version ?? undefined, models, gpuAvailable };
  }

  /** Pull (download) a model */
  async *pullModel(modelName: string): AsyncGenerator<{ status: string; completed?: number; total?: number }> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Failed to pull model ${modelName}: ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as { status: string; completed?: number; total?: number };
          yield data;
        } catch { /* skip */ }
      }
    }
  }

  /** Delete a model */
  async deleteModel(modelName: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return res.ok;
  }

  /** Get model info */
  async getModelInfo(modelName: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      if (!res.ok) return null;
      return await res.json() as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Switch the active model */
  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ─── Private helpers ───────────────────────────────────────

  private toOllamaMessage(msg: LLMMessage): Record<string, unknown> {
    const result: Record<string, unknown> = { role: msg.role, content: msg.content };

    // Pass images for vision models (qwen2.5vl, llava, etc.)
    if (msg.images?.length) {
      result.images = msg.images.map((img) => {
        // Strip data URL prefix if present, Ollama expects raw base64
        const base64Match = img.match(/^data:[^;]+;base64,(.+)$/);
        return base64Match ? base64Match[1] : img;
      });
    }

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      result.tool_calls = msg.toolCalls.map((tc) => ({
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }

    return result;
  }

  private toOllamaTool(tool: ToolDefinition): Record<string, unknown> {
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
        parameters: { type: 'object', properties, required },
      },
    };
  }
}
