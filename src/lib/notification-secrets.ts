import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const SECRET_PREFIX = "enc:v1:";

function getSecretKey(): Buffer {
  const seed = process.env.NOTIFICATION_SECRET_KEY
    || process.env.NEXTAUTH_SECRET
    || process.env.MC_ADMIN_TOKEN
    || "hitechclaw-ai-dev-secret";

  return createHash("sha256").update(seed).digest();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(value: string): string {
  if (!value) return value;
  if (isEncryptedSecret(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  if (!value) return value;
  if (!isEncryptedSecret(value)) return value;

  const [, payload] = value.split(SECRET_PREFIX);
  const [ivPart, tagPart, dataPart] = payload.split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted secret format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function decryptStoredSecret(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return decryptSecret(value.trim());
}
