// ============================================================
// Prompt Injection Detector — Detects common prompt injection patterns
// Based on OWASP LLM01:2025 mitigations
// ============================================================
/**
 * Patterns indicating prompt injection attempts.
 * Ordered by severity — most dangerous first.
 */
const INJECTION_PATTERNS = [
    // Direct instruction override attempts
    { name: 'instruction_override', pattern: /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?|guidelines?)/i, severity: 'high' },
    { name: 'new_instructions', pattern: /(?:your\s+new\s+instructions?\s+are|from\s+now\s+on\s+you\s+(?:are|will|must|should))/i, severity: 'high' },
    { name: 'role_hijack', pattern: /(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you\s+are)|roleplay\s+as)\s+(?:a\s+)?(?:different|new|evil|unrestricted|jailbroken)/i, severity: 'high' },
    // System prompt extraction
    { name: 'system_prompt_extract', pattern: /(?:reveal|show|display|print|output|repeat|tell\s+me)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions?|original\s+prompt|hidden\s+instructions?|secret\s+instructions?)/i, severity: 'high' },
    { name: 'system_prompt_extract_2', pattern: /what\s+(?:are|is|were)\s+your\s+(?:system|original|initial|hidden|secret)\s+(?:instructions?|prompt|rules?)/i, severity: 'high' },
    // DAN/jailbreak patterns
    { name: 'dan_jailbreak', pattern: /\bDAN\b.*(?:mode|jailbreak|unrestricted|no\s+restrictions)/i, severity: 'high' },
    { name: 'developer_mode', pattern: /(?:enable|activate|enter)\s+(?:developer|debug|admin|god|root|sudo)\s+mode/i, severity: 'high' },
    // Delimiter manipulation
    { name: 'delimiter_injection', pattern: /(?:```|<\/?system>|<\/?prompt>|<\/?instructions?>|\[SYSTEM\]|\[INST\])/i, severity: 'medium' },
    // Encoded/obfuscated payloads
    { name: 'base64_payload', pattern: /(?:decode|execute|eval)\s+(?:this\s+)?base64/i, severity: 'medium' },
    // Data exfiltration attempts
    { name: 'data_exfil', pattern: /(?:send|post|transmit|exfiltrate|leak)\s+(?:all\s+)?(?:data|information|context|conversation|history)\s+to/i, severity: 'high' },
    // Indirect injection markers (common in documents fed to RAG)
    { name: 'indirect_injection', pattern: /(?:IMPORTANT|URGENT|CRITICAL)\s*(?::|—)\s*(?:ignore|override|disregard)\s+(?:everything|all)/i, severity: 'medium' },
    { name: 'hidden_instruction', pattern: /(?:<!--.*(?:ignore|override|system).*-->)/i, severity: 'medium' },
];
/**
 * Heuristic scoring thresholds.
 * A message gets a cumulative suspicion score; if it exceeds the threshold it's blocked.
 */
const SCORE_WEIGHTS = { high: 0.9, medium: 0.5, low: 0.2 };
const BLOCK_THRESHOLD = 0.8;
export class PromptInjectionDetector {
    constructor() {
        this.name = 'prompt-injection-detector';
    }
    async check(input, _context) {
        const start = Date.now();
        const matched = [];
        let score = 0;
        for (const { name, pattern, severity } of INJECTION_PATTERNS) {
            // Reset global flag
            pattern.lastIndex = 0;
            if (pattern.test(input)) {
                matched.push({ name, severity });
                score += SCORE_WEIGHTS[severity];
            }
        }
        const pass = score < BLOCK_THRESHOLD;
        return Object.assign({ pass, guardrailName: this.name, durationMs: Date.now() - start, confidence: Math.min(score, 1) }, (pass ? {} : {
            blockedReason: `Potential prompt injection detected: ${matched.map(m => m.name).join(', ')} (score: ${score.toFixed(2)})`,
        }));
    }
}
