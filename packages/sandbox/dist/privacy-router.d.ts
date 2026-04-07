/** PII type classification */
export type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'vietnamese_id' | 'passport' | 'date_of_birth';
/** A detected PII entity */
export interface PIIEntity {
    type: PIIType;
    value: string;
    placeholder: string;
    start: number;
    end: number;
}
export declare class PrivacyRouter {
    private readonly enabled;
    private readonly piiMap;
    constructor(enabled?: boolean);
    /**
     * Strip PII from text, replacing with placeholders.
     * Returns the sanitized text and a session key for rehydration.
     */
    strip(text: string, sessionKey: string): string;
    /**
     * Rehydrate PII in a response using the stored mappings.
     */
    rehydrate(text: string, sessionKey: string): string;
    /**
     * Detect PII in text without stripping.
     * Returns list of detected PII entities.
     */
    detect(text: string): PIIEntity[];
    /**
     * Check if text contains any PII.
     */
    hasPII(text: string): boolean;
    /** Clear all stored PII mappings */
    clear(): void;
}
//# sourceMappingURL=privacy-router.d.ts.map