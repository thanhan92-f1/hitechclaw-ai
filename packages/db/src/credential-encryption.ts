// ============================================================
// Credential Encryption — AES-256-GCM at-rest encryption
// ============================================================
// Encrypts integration credentials before storing in PostgreSQL.
// Uses AES-256-GCM with random IV per encryption.
// Key derivation from CREDENTIAL_ENCRYPTION_KEY env var.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive a 256-bit key from a passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH);
}

/**
 * Get the encryption key from environment.
 * Falls back to a deterministic key in dev mode (not recommended for production).
 */
function getEncryptionKey(): string {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set in production');
    }
    return 'hitechclaw-dev-credential-key-do-not-use-in-prod';
  }
  return key;
}

/**
 * Encrypt a JSON-serializable value.
 * Returns a base64-encoded string: salt:iv:tag:ciphertext
 */
export function encryptCredentials(data: Record<string, unknown>): string {
  const passphrase = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:ciphertext (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a previously encrypted credential string.
 */
export function decryptCredentials(encrypted: string): Record<string, unknown> {
  const passphrase = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted credential format');
  }

  const [saltB64, ivB64, tagB64, dataB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Check if a value looks like an encrypted credential string.
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 4 && parts.every((p) => /^[A-Za-z0-9+/=]+$/.test(p));
}
