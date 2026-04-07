// ============================================================
// Privacy Router — PII stripping before external LLM calls
// ============================================================
// Strips personally identifiable information (PII) from prompts
// before sending to external LLM providers. Rehydrates PII in
// responses. Uses pattern-based detection.

/** PII type classification */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'vietnamese_id'
  | 'passport'
  | 'date_of_birth';

/** A detected PII entity */
export interface PIIEntity {
  type: PIIType;
  value: string;
  placeholder: string;
  start: number;
  end: number;
}

/** PII detection patterns */
const PII_PATTERNS: Array<{ type: PIIType; pattern: RegExp }> = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'phone', pattern: /(?:\+84|0)(?:\d[\s.-]?){8,10}\d/g },
  { type: 'credit_card', pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g },
  { type: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'vietnamese_id', pattern: /\b\d{9}(?:\d{3})?\b/g },
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

export class PrivacyRouter {
  private readonly enabled: boolean;
  private readonly piiMap = new Map<string, PIIEntity[]>();

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Strip PII from text, replacing with placeholders.
   * Returns the sanitized text and a session key for rehydration.
   */
  strip(text: string, sessionKey: string): string {
    if (!this.enabled) return text;

    const entities: PIIEntity[] = [];
    let sanitized = text;
    let offset = 0;

    for (const { type, pattern } of PII_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const placeholder = `[${type.toUpperCase()}_${entities.length}]`;
        entities.push({
          type,
          value: match[0],
          placeholder,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Sort by position (reverse) to replace from end to start
    entities.sort((a, b) => b.start - a.start);

    for (const entity of entities) {
      sanitized =
        sanitized.slice(0, entity.start) +
        entity.placeholder +
        sanitized.slice(entity.end);
    }

    if (entities.length > 0) {
      this.piiMap.set(sessionKey, entities);
    }

    return sanitized;
  }

  /**
   * Rehydrate PII in a response using the stored mappings.
   */
  rehydrate(text: string, sessionKey: string): string {
    if (!this.enabled) return text;

    const entities = this.piiMap.get(sessionKey);
    if (!entities) return text;

    let result = text;
    for (const entity of entities) {
      result = result.replaceAll(entity.placeholder, entity.value);
    }

    // Clean up after rehydration
    this.piiMap.delete(sessionKey);
    return result;
  }

  /**
   * Detect PII in text without stripping.
   * Returns list of detected PII entities.
   */
  detect(text: string): PIIEntity[] {
    const entities: PIIEntity[] = [];

    for (const { type, pattern } of PII_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          type,
          value: match[0],
          placeholder: `[${type.toUpperCase()}_${entities.length}]`,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  /**
   * Check if text contains any PII.
   */
  hasPII(text: string): boolean {
    return this.detect(text).length > 0;
  }

  /** Clear all stored PII mappings */
  clear(): void {
    this.piiMap.clear();
  }
}
