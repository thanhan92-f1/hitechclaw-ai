// ============================================================
// Topic Scope Guard — Enforce agent stays within its domain
// ============================================================
/**
 * Domain-specific blocked topic patterns.
 * Use to prevent a healthcare agent from answering finance questions, etc.
 */
const DOMAIN_BLOCK_RULES = {
    healthcare: [
        /(?:buy|sell|trade|invest)\s+(?:stock|crypto|bitcoin|shares)/i,
        /(?:legal\s+advice|sue|lawsuit|attorney)/i,
    ],
    finance: [
        /(?:diagnos|prescri|symptom|disease|medical|doctor)/i,
    ],
    // General domain has no restrictions
};
/**
 * Prevents the agent from responding to topics outside its assigned domain.
 * Only active when a domain is configured.
 */
export class TopicScopeGuard {
    constructor() {
        this.name = 'topic-scope-guard';
    }
    async check(input, context) {
        const start = Date.now();
        // No domain = no restrictions
        if (!context.domainId || context.domainId === 'general') {
            return { pass: true, guardrailName: this.name, durationMs: Date.now() - start };
        }
        const rules = DOMAIN_BLOCK_RULES[context.domainId];
        if (!rules) {
            return { pass: true, guardrailName: this.name, durationMs: Date.now() - start };
        }
        for (const pattern of rules) {
            pattern.lastIndex = 0;
            if (pattern.test(input)) {
                return {
                    pass: false,
                    guardrailName: this.name,
                    durationMs: Date.now() - start,
                    blockedReason: `This question is outside the ${context.domainId} domain scope. Please ask questions related to ${context.domainId}.`,
                    confidence: 0.7,
                };
            }
        }
        return { pass: true, guardrailName: this.name, durationMs: Date.now() - start };
    }
}
