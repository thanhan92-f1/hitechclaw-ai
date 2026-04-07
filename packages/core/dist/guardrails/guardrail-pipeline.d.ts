import type { InputGuardrail, OutputGuardrail, GuardrailContext, GuardrailPipelineResult } from './types.js';
export declare class GuardrailPipeline {
    private inputGuardrails;
    private outputGuardrails;
    /** Register an input guardrail (runs before LLM call) */
    addInputGuardrail(guard: InputGuardrail): void;
    /** Register an output guardrail (runs after LLM response) */
    addOutputGuardrail(guard: OutputGuardrail): void;
    /**
     * Run all input guardrails on user message.
     * Stops at the first blocking guardrail (fail-fast).
     */
    checkInput(input: string, context: GuardrailContext): Promise<GuardrailPipelineResult>;
    /**
     * Run all output guardrails on LLM response.
     * Stops at the first blocking guardrail (fail-fast).
     */
    checkOutput(output: string, context: GuardrailContext): Promise<GuardrailPipelineResult>;
    /** Get all registered guardrail names for diagnostics */
    getRegistered(): {
        input: string[];
        output: string[];
    };
}
//# sourceMappingURL=guardrail-pipeline.d.ts.map