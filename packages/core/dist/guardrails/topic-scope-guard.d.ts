import type { InputGuardrail, GuardrailResult, GuardrailContext } from './types.js';
/**
 * Prevents the agent from responding to topics outside its assigned domain.
 * Only active when a domain is configured.
 */
export declare class TopicScopeGuard implements InputGuardrail {
    readonly name = "topic-scope-guard";
    check(input: string, context: GuardrailContext): Promise<GuardrailResult>;
}
//# sourceMappingURL=topic-scope-guard.d.ts.map