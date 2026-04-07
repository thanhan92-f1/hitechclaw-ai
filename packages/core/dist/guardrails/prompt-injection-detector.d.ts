import type { InputGuardrail, GuardrailResult, GuardrailContext } from './types.js';
export declare class PromptInjectionDetector implements InputGuardrail {
    readonly name = "prompt-injection-detector";
    check(input: string, _context: GuardrailContext): Promise<GuardrailResult>;
}
//# sourceMappingURL=prompt-injection-detector.d.ts.map