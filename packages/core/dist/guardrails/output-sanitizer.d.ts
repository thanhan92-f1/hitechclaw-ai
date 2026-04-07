import type { OutputGuardrail, GuardrailResult, GuardrailContext } from './types.js';
/**
 * Sanitizes LLM output by:
 * 1. Detecting system prompt leakage
 * 2. Removing XSS-dangerous patterns
 * 3. Checking for unexpected executable content
 */
export declare class OutputSanitizer implements OutputGuardrail {
    readonly name = "output-sanitizer";
    check(output: string, _context: GuardrailContext): Promise<GuardrailResult>;
}
//# sourceMappingURL=output-sanitizer.d.ts.map