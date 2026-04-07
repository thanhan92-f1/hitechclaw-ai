// ============================================================
// LLM Pricing — Cost Estimation in USD
// ============================================================
// Prices per 1M tokens (input / output) in USD
// Last updated: 2025-Q1. Ollama local = $0.

interface ModelPricing {
  inputPer1M: number;   // USD per 1M input (prompt) tokens
  outputPer1M: number;  // USD per 1M output (completion) tokens
}

// Known model pricing (provider → model pattern → pricing)
const PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
    'gpt-4': { inputPer1M: 30.00, outputPer1M: 60.00 },
    'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
    'o1': { inputPer1M: 15.00, outputPer1M: 60.00 },
    'o1-mini': { inputPer1M: 3.00, outputPer1M: 12.00 },
    'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-3-5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.00 },
    'claude-3-opus': { inputPer1M: 15.00, outputPer1M: 75.00 },
    'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
  },
  google: {
    'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
    'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
    'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  },
  groq: {
    'llama-3.3-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
    'llama-3.1-8b': { inputPer1M: 0.05, outputPer1M: 0.08 },
    'mixtral-8x7b': { inputPer1M: 0.24, outputPer1M: 0.24 },
  },
  deepseek: {
    'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
    'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
  },
  mistral: {
    'mistral-large': { inputPer1M: 2.00, outputPer1M: 6.00 },
    'mistral-small': { inputPer1M: 0.20, outputPer1M: 0.60 },
    'codestral': { inputPer1M: 0.30, outputPer1M: 0.90 },
  },
  xai: {
    'grok-2': { inputPer1M: 2.00, outputPer1M: 10.00 },
    'grok-2-mini': { inputPer1M: 0.20, outputPer1M: 1.00 },
  },
  perplexity: {
    'sonar-pro': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'sonar': { inputPer1M: 1.00, outputPer1M: 1.00 },
  },
  // Ollama (local) = free
  ollama: {},
};

/**
 * Find pricing for a model with fuzzy matching.
 * Tries exact match first, then prefix match.
 */
function findPricing(provider: string, model: string): ModelPricing | null {
  const providerPrices = PRICING[provider];
  if (!providerPrices) return null;

  // Exact match
  if (providerPrices[model]) return providerPrices[model];

  // Prefix match (e.g. "gpt-4o-2024-08-06" → "gpt-4o")
  const modelLower = model.toLowerCase();
  for (const [pattern, pricing] of Object.entries(providerPrices)) {
    if (modelLower.startsWith(pattern.toLowerCase())) return pricing;
  }

  return null;
}

/**
 * Estimate cost in USD for an LLM call.
 * Returns 0 for local models (ollama) or unknown models.
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  // Local models are free
  if (provider === 'ollama') return 0;

  const pricing = findPricing(provider, model);
  if (!pricing) return 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;

  // Round to 8 decimal places for sub-cent precision
  return Math.round((inputCost + outputCost) * 1e8) / 1e8;
}

/**
 * Get pricing info for a provider/model.
 * Returns null if unknown.
 */
export function getModelPricing(provider: string, model: string): ModelPricing | null {
  return findPricing(provider, model);
}

/**
 * List all known providers and their models with pricing.
 */
export function listPricing(): Record<string, Record<string, ModelPricing>> {
  return PRICING;
}
