// ============================================================
// Guardrail Pipeline — Orchestrate input & output guardrails
// ============================================================
export class GuardrailPipeline {
    inputGuardrails = [];
    outputGuardrails = [];
    /** Register an input guardrail (runs before LLM call) */
    addInputGuardrail(guard) {
        this.inputGuardrails.push(guard);
    }
    /** Register an output guardrail (runs after LLM response) */
    addOutputGuardrail(guard) {
        this.outputGuardrails.push(guard);
    }
    /**
     * Run all input guardrails on user message.
     * Stops at the first blocking guardrail (fail-fast).
     */
    async checkInput(input, context) {
        const start = Date.now();
        const results = [];
        let finalContent = input;
        for (const guard of this.inputGuardrails) {
            const result = await guard.check(finalContent, context);
            results.push(result);
            if (!result.pass) {
                return {
                    passed: false,
                    blockedBy: result,
                    results,
                    finalContent: input,
                    totalDurationMs: Date.now() - start,
                };
            }
            // Apply sanitization if the guardrail rewrote content
            if (result.sanitized) {
                finalContent = result.sanitized;
            }
        }
        return {
            passed: true,
            results,
            finalContent,
            totalDurationMs: Date.now() - start,
        };
    }
    /**
     * Run all output guardrails on LLM response.
     * Stops at the first blocking guardrail (fail-fast).
     */
    async checkOutput(output, context) {
        const start = Date.now();
        const results = [];
        let finalContent = output;
        for (const guard of this.outputGuardrails) {
            const result = await guard.check(finalContent, context);
            results.push(result);
            if (!result.pass) {
                return {
                    passed: false,
                    blockedBy: result,
                    results,
                    finalContent: output,
                    totalDurationMs: Date.now() - start,
                };
            }
            if (result.sanitized) {
                finalContent = result.sanitized;
            }
        }
        return {
            passed: true,
            results,
            finalContent,
            totalDurationMs: Date.now() - start,
        };
    }
    /** Get all registered guardrail names for diagnostics */
    getRegistered() {
        return {
            input: this.inputGuardrails.map(g => g.name),
            output: this.outputGuardrails.map(g => g.name),
        };
    }
}
//# sourceMappingURL=guardrail-pipeline.js.map