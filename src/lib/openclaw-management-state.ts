import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/notification-secrets";
import { getDefaultOpenClawEnvironment, getOpenClawEnvironmentById } from "@/lib/openclaw-environments";

export interface ManagedAuthRecord {
  environmentId: string;
  username: string;
  passwordConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupHistoryRecord {
  id: string;
  environmentId: string;
  action: string;
  archivePath: string;
  verified: boolean | null;
  status: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ManagedAuthRow {
  environment_id: string;
  username: string | null;
  password_ciphertext: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface BackupHistoryRow {
  id: string;
  environment_id: string;
  action: string;
  archive_path: string;
  verified: boolean | null;
  status: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoString(value: string | Date): string {
  return new Date(value).toISOString();
}

function mapManagedAuthRow(row: ManagedAuthRow): ManagedAuthRecord {
  return {
    environmentId: row.environment_id,
    username: row.username ?? "",
    passwordConfigured: Boolean(asTrimmedString(row.password_ciphertext)),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapBackupHistoryRow(row: BackupHistoryRow): BackupHistoryRecord {
  return {
    id: row.id,
    environmentId: row.environment_id,
    action: row.action,
    archivePath: row.archive_path,
    verified: row.verified ?? null,
    status: row.status ?? "recorded",
    message: row.message ?? "",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function resolveManagedOpenClawEnvironmentId(requestedEnvironmentId?: string | null): Promise<string> {
  if (requestedEnvironmentId) {
    const environment = await getOpenClawEnvironmentById(requestedEnvironmentId);
    if (environment) {
      return environment.id;
    }
  }

  const fallbackEnvironment = await getDefaultOpenClawEnvironment();
  return fallbackEnvironment.id;
}

export async function getManagedAuthRecord(environmentId: string): Promise<ManagedAuthRecord | null> {
  const result = await query(
    `SELECT environment_id, username, password_ciphertext, created_at, updated_at
     FROM openclaw_managed_auth_records
     WHERE environment_id = $1
     LIMIT 1`,
    [environmentId],
  );

  const row = result.rows[0] as ManagedAuthRow | undefined;
  return row ? mapManagedAuthRow(row) : null;
}

export async function upsertManagedAuthRecord(environmentId: string, username: string, password: string): Promise<ManagedAuthRecord> {
  const normalizedUsername = asTrimmedString(username);
  const normalizedPassword = asTrimmedString(password);

  if (!normalizedUsername) {
    throw new Error("username is required");
  }

  if (!normalizedPassword) {
    throw new Error("password is required");
  }

  const ciphertext = encryptSecret(normalizedPassword);
  const result = await query(
    `INSERT INTO openclaw_managed_auth_records (environment_id, username, password_ciphertext, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (environment_id)
     DO UPDATE SET
       username = EXCLUDED.username,
       password_ciphertext = EXCLUDED.password_ciphertext,
       updated_at = NOW()
     RETURNING environment_id, username, password_ciphertext, created_at, updated_at`,
    [environmentId, normalizedUsername, ciphertext],
  );

  return mapManagedAuthRow(result.rows[0] as ManagedAuthRow);
}

export async function deleteManagedAuthRecord(environmentId: string): Promise<void> {
  await query(`DELETE FROM openclaw_managed_auth_records WHERE environment_id = $1`, [environmentId]);
}

export async function getManagedAuthPassword(environmentId: string): Promise<string | null> {
  const result = await query(
    `SELECT password_ciphertext
     FROM openclaw_managed_auth_records
     WHERE environment_id = $1
     LIMIT 1`,
    [environmentId],
  );

  const ciphertext = asTrimmedString((result.rows[0] as { password_ciphertext?: string } | undefined)?.password_ciphertext);
  if (!ciphertext) {
    return null;
  }

  try {
    return decryptSecret(ciphertext);
  } catch {
    return null;
  }
}

export async function listBackupHistory(environmentId: string, limit = 20): Promise<BackupHistoryRecord[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.round(limit))) : 20;
  const result = await query(
    `SELECT id, environment_id, action, archive_path, verified, status, message, payload, created_at, updated_at
     FROM openclaw_backup_history
     WHERE environment_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [environmentId, safeLimit],
  );

  return (result.rows as BackupHistoryRow[]).map(mapBackupHistoryRow);
}

export async function createBackupHistoryRecord(input: {
  environmentId: string;
  action: string;
  archivePath: string;
  verified?: boolean | null;
  status?: string;
  message?: string;
  payload?: Record<string, unknown>;
}): Promise<BackupHistoryRecord> {
  const action = asTrimmedString(input.action) || "backup";
  const archivePath = asTrimmedString(input.archivePath);
  if (!archivePath) {
    throw new Error("archivePath is required");
  }

  const status = asTrimmedString(input.status) || "recorded";
  const message = asTrimmedString(input.message);
  const result = await query(
    `INSERT INTO openclaw_backup_history (
      id,
      environment_id,
      action,
      archive_path,
      verified,
      status,
      message,
      payload,
      updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
     RETURNING id, environment_id, action, archive_path, verified, status, message, payload, created_at, updated_at`,
    [
      randomUUID(),
      input.environmentId,
      action,
      archivePath,
      input.verified ?? null,
      status,
      message || null,
      JSON.stringify(input.payload ?? {}),
    ],
  );

  return mapBackupHistoryRow(result.rows[0] as BackupHistoryRow);
}