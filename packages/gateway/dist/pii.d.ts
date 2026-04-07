export interface PIIMatch {
    type: string;
    value: string;
    start: number;
    end: number;
}
export interface PIIScanResult {
    hasPII: boolean;
    matches: PIIMatch[];
    redacted: string;
}
/**
 * Scan text for PII and optionally redact it.
 */
export declare function scanPII(text: string): PIIScanResult;
//# sourceMappingURL=pii.d.ts.map