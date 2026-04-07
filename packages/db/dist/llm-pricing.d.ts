interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}
/**
 * Estimate cost in USD for an LLM call.
 * Returns 0 for local models (ollama) or unknown models.
 */
export declare function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number;
/**
 * Get pricing info for a provider/model.
 * Returns null if unknown.
 */
export declare function getModelPricing(provider: string, model: string): ModelPricing | null;
/**
 * List all known providers and their models with pricing.
 */
export declare function listPricing(): Record<string, Record<string, ModelPricing>>;
export {};
//# sourceMappingURL=llm-pricing.d.ts.map