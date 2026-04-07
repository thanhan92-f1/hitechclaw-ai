import type { LLMConfig, LLMMessage, LLMResponse, ResponseFormat, StreamEvent, ToolDefinition } from '@hitechclaw/shared';

export interface LLMAdapter {
  readonly provider: string;
  chat(messages: LLMMessage[], tools?: ToolDefinition[], options?: AdapterOptions): Promise<LLMResponse>;
  chatStream(messages: LLMMessage[], tools?: ToolDefinition[], options?: AdapterOptions): AsyncGenerator<StreamEvent>;
}

export interface AdapterOptions {
  responseFormat?: ResponseFormat;
}

/** Hint for automatic model selection when no explicit provider is requested. */
export type TaskComplexity = 'fast' | 'smart' | 'cheap';

/**
 * Provider preference chains per task complexity.
 * The router tries each provider in order and falls back on errors.
 */
const ROUTING_CHAINS: Record<TaskComplexity, string[]> = {
  // Low-latency tasks: prefer Groq → Ollama → OpenAI
  fast: ['groq', 'ollama', 'openai', 'anthropic'],
  // Highest-quality tasks: prefer Anthropic → OpenAI → Mistral → Groq
  smart: ['anthropic', 'openai', 'mistral', 'groq'],
  // Cost-sensitive tasks: prefer Ollama → DeepSeek → Groq → OpenAI
  cheap: ['ollama', 'deepseek', 'groq', 'mistral', 'openai'],
};

export interface ChatOptions {
  /**
   * Override the default provider for this call. If provided the fallback
   * chain is still used when the named provider fails.
   */
  preferProvider?: string;
  /** Hint for automatic model routing when no preferProvider is set. */
  taskComplexity?: TaskComplexity;
  /** Ordered list of provider names to try in sequence. Overrides routing table. */
  fallbackChain?: string[];
  /** Structured output: force text, JSON object, or JSON schema response. */
  responseFormat?: ResponseFormat;
}

export class LLMRouter {
  private adapters = new Map<string, LLMAdapter>();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  registerAdapter(adapter: LLMAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  setConfig(config: LLMConfig): void {
    this.config = config;
  }

  getAdapter(provider?: string): LLMAdapter {
    const p = provider ?? this.config.provider;
    const adapter = this.adapters.get(p);
    if (!adapter) {
      throw new Error(
        `No adapter registered for provider "${p}". ` +
        `Available: ${[...this.adapters.keys()].join(', ')}`,
      );
    }
    return adapter;
  }

  /**
   * Build the ordered provider chain for a call.
   * Priority: explicit fallbackChain > preferProvider (+ routing table) > config.provider
   */
  private resolveChain(options?: ChatOptions): string[] {
    if (options?.fallbackChain?.length) return options.fallbackChain;

    const primary = options?.preferProvider ?? this.config.provider;
    const routingChain = options?.taskComplexity ? ROUTING_CHAINS[options.taskComplexity] : [];

    // Build unique ordered list: primary first, then routing chain providers, skipping duplicates
    const seen = new Set<string>();
    const chain: string[] = [];
    for (const p of [primary, ...routingChain]) {
      if (!seen.has(p)) {
        seen.add(p);
        chain.push(p);
      }
    }
    return chain;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[], options?: ChatOptions): Promise<LLMResponse> {
    const chain = this.resolveChain(options);
    const adapterOpts: AdapterOptions | undefined = options?.responseFormat ? { responseFormat: options.responseFormat } : undefined;
    let lastError: unknown;

    for (const provider of chain) {
      const adapter = this.adapters.get(provider);
      if (!adapter) continue; // skip unavailable providers silently

      try {
        return await adapter.chat(messages, tools, adapterOpts);
      } catch (err) {
        lastError = err;
        // Log and try next provider in chain
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[LLMRouter] Provider "${provider}" failed: ${msg}. Trying next in chain…`);
      }
    }

    throw lastError ?? new Error(`All providers in chain failed: ${chain.join(', ')}`);
  }

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[], options?: ChatOptions): AsyncGenerator<StreamEvent> {
    const chain = this.resolveChain(options);
    const adapterOpts: AdapterOptions | undefined = options?.responseFormat ? { responseFormat: options.responseFormat } : undefined;
    let lastError: unknown;

    for (const provider of chain) {
      const adapter = this.adapters.get(provider);
      if (!adapter) continue;

      try {
        yield* adapter.chatStream(messages, tools, adapterOpts);
        return; // stream completed successfully
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[LLMRouter] Stream provider "${provider}" failed: ${msg}. Trying next…`);
      }
    }

    throw lastError ?? new Error(`All stream providers in chain failed: ${chain.join(', ')}`);
  }

  /** Returns available (registered) providers. */
  getAvailableProviders(): string[] {
    return [...this.adapters.keys()];
  }
}
