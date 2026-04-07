// ============================================================
// Output Sanitizer — Sanitize LLM responses before returning to user
// Addresses OWASP LLM05:2025 (Improper Output Handling)
// ============================================================
/**
 * Patterns in LLM output that indicate system prompt leakage.
 * Addresses OWASP LLM07:2025.
 */
const SYSTEM_PROMPT_LEAK_PATTERNS = [
    /(?:my\s+system\s+prompt\s+is|here\s+(?:are|is)\s+my\s+(?:system\s+)?instructions?)/i,
    /(?:as\s+instructed\s+in\s+my\s+system\s+prompt|original\s+instructions?\s+(?:say|are|were))/i,
    /\[SYSTEM\][\s\S]{20,}\[\/SYSTEM\]/i,
];
/**
 * Characters/patterns that could be used for XSS if output is rendered as HTML.
 */
const XSS_PATTERNS = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /on(?:load|error|click|mouseover|focus|blur|submit)\s*=/gi,
    /javascript\s*:/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^>]*action\s*=\s*["']?https?:/gi,
];
/**
 * Sanitizes LLM output by:
 * 1. Detecting system prompt leakage
 * 2. Removing XSS-dangerous patterns
 * 3. Checking for unexpected executable content
 */
export class OutputSanitizer {
    constructor() {
        this.name = 'output-sanitizer';
    }
    async check(output, _context) {
        const start = Date.now();
        let sanitized = output;
        const issues = [];
        // 1. Check for system prompt leakage
        for (const pattern of SYSTEM_PROMPT_LEAK_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(sanitized)) {
                issues.push('system-prompt-leak');
                // Block entirely — don't try to sanitize, the whole response is compromised
                return {
                    pass: false,
                    guardrailName: this.name,
                    durationMs: Date.now() - start,
                    blockedReason: 'LLM response contains system prompt leakage. Response blocked.',
                    confidence: 0.9,
                };
            }
        }
        // 2. Strip XSS patterns (sanitize, don't block — LLMs sometimes use code examples)
        let xssFound = false;
        for (const pattern of XSS_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(sanitized)) {
                xssFound = true;
                sanitized = sanitized.replace(pattern, '[removed-unsafe-content]');
            }
        }
        if (xssFound) {
            issues.push('xss-patterns-removed');
        }
        return {
            pass: true,
            guardrailName: this.name,
            durationMs: Date.now() - start,
            sanitized: xssFound ? sanitized : undefined,
            confidence: issues.length > 0 ? 0.7 : 1,
        };
    }
}
