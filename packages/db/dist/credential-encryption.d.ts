/**
 * Encrypt a JSON-serializable value.
 * Returns a base64-encoded string: salt:iv:tag:ciphertext
 */
export declare function encryptCredentials(data: Record<string, unknown>): string;
/**
 * Decrypt a previously encrypted credential string.
 */
export declare function decryptCredentials(encrypted: string): Record<string, unknown>;
/**
 * Check if a value looks like an encrypted credential string.
 */
export declare function isEncrypted(value: unknown): boolean;
//# sourceMappingURL=credential-encryption.d.ts.map