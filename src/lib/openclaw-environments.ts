import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import pool, { query } from "@/lib/db";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/notification-secrets";

const DEFAULT_OPENCLAW_ENVIRONMENT_ID = "default";
const OPENCLAW_REQUEST_TIMEOUT_MIN_MS = 1000;
const OPENCLAW_REQUEST_TIMEOUT_MAX_MS = 300000;

export type OpenClawEnvironmentSecretField = "managementApiKey" | "gatewayToken" | "authToken";

export interface OpenClawEnvironmentConfig {
  notes?: string;
  defaultProvider?: string;
  defaultModel?: string;
  region?: string;
  tags?: string[];
  allowedManagementPaths?: string[];
  allowDestructiveActions?: boolean;
  confirmHighRiskActions?: boolean;
  requestTimeoutMs?: number;
  [key: string]: unknown;
}

export interface OpenClawEnvironmentRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseUrl: string;
  gatewayUrl: string;
  managementApiKey: string;
  gatewayToken: string;
  authToken: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  config: OpenClawEnvironmentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface OpenClawEnvironmentSummary extends Omit<OpenClawEnvironmentRecord, "managementApiKey" | "gatewayToken" | "authToken"> {
  managementApiKeyConfigured: boolean;
  gatewayTokenConfigured: boolean;
  authTokenConfigured: boolean;
  source: "database";
}

export interface OpenClawEnvironmentResolved extends OpenClawEnvironmentRecord {
  source: "database";
}

export interface OpenClawEnvironmentInput {
  name: string;
  slug: string;
  description?: string;
  baseUrl: string;
  gatewayUrl?: string;
  managementApiKey?: string;
  gatewayToken?: string;
  authToken?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  config?: OpenClawEnvironmentConfig;
}

interface OpenClawEnvironmentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_url: string;
  gateway_url: string | null;
  management_api_key: string | null;
  gateway_token: string | null;
  auth_token: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(value: unknown, fieldName: string, fallbackPort?: string): string {
  const raw = normalizeOptionalString(value);
  if (!raw) return "";

  const candidate = raw.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");
  try {
    const url = new URL(candidate);
    if (fallbackPort && !url.port) {
      url.port = fallbackPort;
    }
    if (url.port === "18789" && fieldName === "baseUrl") {
      url.port = "9998";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${fieldName} must be a valid URL.`);
  }
}

function normalizeSlug(value: unknown): string {
  const raw = normalizeOptionalString(value).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (!slug) {
    throw new Error("slug is required and may only contain letters, numbers, and hyphens.");
  }

  return slug;
}

function normalizeName(value: unknown): string {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("name is required.");
  }
  return name.slice(0, 120);
}

function normalizeConfig(value: unknown): OpenClawEnvironmentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const config = { ...(value as Record<string, unknown>) };
  const timeoutRaw = config.requestTimeoutMs;
  if (timeoutRaw !== undefined && timeoutRaw !== null && String(timeoutRaw).trim() !== "") {
    const timeout = Number(timeoutRaw);
    if (!Number.isFinite(timeout) || timeout < OPENCLAW_REQUEST_TIMEOUT_MIN_MS || timeout > OPENCLAW_REQUEST_TIMEOUT_MAX_MS) {
      throw new Error(`config.requestTimeoutMs must be between ${OPENCLAW_REQUEST_TIMEOUT_MIN_MS} and ${OPENCLAW_REQUEST_TIMEOUT_MAX_MS} milliseconds.`);
    }
    config.requestTimeoutMs = Math.round(timeout);
  } else {
    delete config.requestTimeoutMs;
  }

  if (config.tags !== undefined) {
    if (!Array.isArray(config.tags)) {
      throw new Error("config.tags must be an array of strings.");
    }
    config.tags = config.tags
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (config.allowedManagementPaths !== undefined) {
    if (!Array.isArray(config.allowedManagementPaths)) {
      throw new Error("config.allowedManagementPaths must be an array of strings.");
    }
    config.allowedManagementPaths = config.allowedManagementPaths
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 100);
  }

  if (config.allowDestructiveActions !== undefined) {
    config.allowDestructiveActions = Boolean(config.allowDestructiveActions);
  }
  if (config.confirmHighRiskActions !== undefined) {
    config.confirmHighRiskActions = Boolean(config.confirmHighRiskActions);
  }

  return config as OpenClawEnvironmentConfig;
}

function normalizeSecretValue(value: unknown): string {
  return normalizeOptionalString(value);
}

function decryptStoredSecret(value: string | null): string {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch {
    return value;
  }
}

function maskSecret(value: string): boolean {
  return Boolean(value.trim());
}

function mapRow(row: OpenClawEnvironmentRow): OpenClawEnvironmentResolved {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    baseUrl: normalizeUrl(row.base_url, "baseUrl", "9998"),
    gatewayUrl: normalizeOptionalString(row.gateway_url),
    managementApiKey: decryptStoredSecret(row.management_api_key),
    gatewayToken: decryptStoredSecret(row.gateway_token),
    authToken: decryptStoredSecret(row.auth_token),
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order ?? 0),
    config: normalizeConfig(row.config ?? {}),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    source: "database",
  };
}

function toSummary(record: OpenClawEnvironmentResolved): OpenClawEnvironmentSummary {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    baseUrl: record.baseUrl,
    gatewayUrl: record.gatewayUrl,
    isActive: record.isActive,
    isDefault: record.isDefault,
    sortOrder: record.sortOrder,
    config: record.config,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    managementApiKeyConfigured: maskSecret(record.managementApiKey),
    gatewayTokenConfigured: maskSecret(record.gatewayToken),
    authTokenConfigured: maskSecret(record.authToken),
    source: record.source,
  };
}

async function ensureBootstrapEnvironment() {
  await query(
    `INSERT INTO openclaw_environments (
      id,
      name,
      slug,
      description,
      base_url,
      gateway_url,
      management_api_key,
      gateway_token,
      auth_token,
      is_active,
      is_default,
      sort_order,
      config,
      updated_at
    )
    SELECT
      $1,
      'Default OpenClaw',
      'default',
      'Bootstrapped default environment. Update it from Settings → OpenClaw.',
      'http://localhost:9998',
      NULL,
      NULL,
      NULL,
      NULL,
      TRUE,
      TRUE,
      0,
      $2::jsonb,
      NOW()
    WHERE NOT EXISTS (SELECT 1 FROM openclaw_environments)`,
    [
      DEFAULT_OPENCLAW_ENVIRONMENT_ID,
      JSON.stringify({ source: "database-bootstrap" }),
    ],
  );
}

export async function listOpenClawEnvironments(): Promise<OpenClawEnvironmentSummary[]> {
  await ensureBootstrapEnvironment();

  const result = await query(
    `SELECT * FROM openclaw_environments
     ORDER BY is_default DESC, sort_order ASC, name ASC`,
  );

  const environments = (result.rows as OpenClawEnvironmentRow[]).map((row) => toSummary(mapRow(row)));
  return environments;
}

export async function getOpenClawEnvironmentById(id: string): Promise<OpenClawEnvironmentResolved | null> {
  const normalizedId = normalizeOptionalString(id);
  if (!normalizedId) return null;

  const result = await query(`SELECT * FROM openclaw_environments WHERE id = $1 LIMIT 1`, [normalizedId]);
  const row = result.rows[0] as OpenClawEnvironmentRow | undefined;
  if (row) {
    return mapRow(row);
  }

  return null;
}

export async function getDefaultOpenClawEnvironment(): Promise<OpenClawEnvironmentResolved> {
  await ensureBootstrapEnvironment();

  const result = await query(
    `SELECT * FROM openclaw_environments
     WHERE is_active = TRUE
     ORDER BY is_default DESC, sort_order ASC, name ASC
     LIMIT 1`,
  );
  const row = result.rows[0] as OpenClawEnvironmentRow | undefined;
  if (!row) {
    throw new Error("No OpenClaw environment configured in database.");
  }
  return mapRow(row);
}

export async function resolveOpenClawEnvironment(id?: string | null): Promise<OpenClawEnvironmentResolved> {
  if (id) {
    const environment = await getOpenClawEnvironmentById(id);
    if (environment) return environment;
  }
  return getDefaultOpenClawEnvironment();
}

async function ensureDefaultEnvironment(client: PoolClient) {
  const result = await client.query(
    `SELECT id FROM openclaw_environments WHERE is_active = TRUE ORDER BY is_default DESC, sort_order ASC, name ASC LIMIT 1`,
  );
  const firstId = (result.rows[0] as { id: string } | undefined)?.id;
  if (!firstId) return;

  await client.query(`UPDATE openclaw_environments SET is_default = (id = $1)`, [firstId]);
}

export async function createOpenClawEnvironment(input: OpenClawEnvironmentInput): Promise<OpenClawEnvironmentResolved> {
  const payload = validateInput(input);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (payload.isDefault) {
      await client.query(`UPDATE openclaw_environments SET is_default = FALSE WHERE is_default = TRUE`);
    }

    await client.query(
      `INSERT INTO openclaw_environments (
        id, name, slug, description, base_url, gateway_url, management_api_key, gateway_token, auth_token,
        is_active, is_default, sort_order, config, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        payload.id,
        payload.name,
        payload.slug,
        payload.description,
        payload.baseUrl,
        payload.gatewayUrl || null,
        payload.managementApiKey ? encryptSecret(payload.managementApiKey) : null,
        payload.gatewayToken ? encryptSecret(payload.gatewayToken) : null,
        payload.authToken ? encryptSecret(payload.authToken) : null,
        payload.isActive,
        payload.isDefault,
        payload.sortOrder,
        JSON.stringify(payload.config),
      ],
    );

    await ensureDefaultEnvironment(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const created = await getOpenClawEnvironmentById(payload.id);
  if (!created) {
    throw new Error("Failed to load created OpenClaw environment.");
  }

  return created;
}

export async function updateOpenClawEnvironment(id: string, input: Partial<OpenClawEnvironmentInput>): Promise<OpenClawEnvironmentResolved> {
  const existing = await getOpenClawEnvironmentById(id);
  if (!existing || existing.source !== "database") {
    throw new Error("OpenClaw environment not found.");
  }

  const payload = validateInput({
    ...existing,
    ...input,
    slug: input.slug ?? existing.slug,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    baseUrl: input.baseUrl ?? existing.baseUrl,
    gatewayUrl: input.gatewayUrl ?? existing.gatewayUrl,
    managementApiKey:
      input.managementApiKey === undefined
        ? existing.managementApiKey
        : normalizeOptionalString(input.managementApiKey) || existing.managementApiKey,
    gatewayToken:
      input.gatewayToken === undefined
        ? existing.gatewayToken
        : normalizeOptionalString(input.gatewayToken) || existing.gatewayToken,
    authToken:
      input.authToken === undefined
        ? existing.authToken
        : normalizeOptionalString(input.authToken) || existing.authToken,
    isActive: input.isActive ?? existing.isActive,
    isDefault: input.isDefault ?? existing.isDefault,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    config: input.config ?? existing.config,
  } as OpenClawEnvironmentInput, existing);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (payload.isDefault) {
      await client.query(`UPDATE openclaw_environments SET is_default = FALSE WHERE is_default = TRUE AND id <> $1`, [id]);
    }

    await client.query(
      `UPDATE openclaw_environments
       SET name = $2,
           slug = $3,
           description = $4,
           base_url = $5,
           gateway_url = $6,
           management_api_key = $7,
           gateway_token = $8,
           auth_token = $9,
           is_active = $10,
           is_default = $11,
           sort_order = $12,
           config = $13,
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        payload.name,
        payload.slug,
        payload.description,
        payload.baseUrl,
        payload.gatewayUrl || null,
        payload.managementApiKey ? encryptSecret(payload.managementApiKey) : null,
        payload.gatewayToken ? encryptSecret(payload.gatewayToken) : null,
        payload.authToken ? encryptSecret(payload.authToken) : null,
        payload.isActive,
        payload.isDefault,
        payload.sortOrder,
        JSON.stringify(payload.config),
      ],
    );

    await ensureDefaultEnvironment(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const updated = await getOpenClawEnvironmentById(id);
  if (!updated) {
    throw new Error("Failed to load updated OpenClaw environment.");
  }
  return updated;
}

export async function deleteOpenClawEnvironment(id: string): Promise<void> {
  const existing = await getOpenClawEnvironmentById(id);
  if (!existing || existing.source !== "database") {
    throw new Error("OpenClaw environment not found.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM openclaw_environments WHERE id = $1`, [id]);
    await ensureDefaultEnvironment(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function validateInput(input: OpenClawEnvironmentInput, existing?: OpenClawEnvironmentResolved) {
  const id = existing?.id ?? randomUUID();
  const name = normalizeName(input.name);
  const slug = normalizeSlug(input.slug);
  const description = normalizeOptionalString(input.description).slice(0, 240);
  const baseUrl = normalizeUrl(input.baseUrl, "baseUrl", "9998");
  const gatewayUrl = input.gatewayUrl ? normalizeUrl(input.gatewayUrl, "gatewayUrl") : "";
  const managementApiKey = normalizeSecretValue(input.managementApiKey);
  const gatewayToken = normalizeSecretValue(input.gatewayToken);
  const authToken = normalizeSecretValue(input.authToken);
  const isActive = input.isActive ?? true;
  const isDefault = input.isDefault ?? false;
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const config = normalizeConfig(input.config ?? {});

  return {
    id,
    name,
    slug,
    description,
    baseUrl,
    gatewayUrl,
    managementApiKey,
    gatewayToken,
    authToken,
    isActive: Boolean(isActive),
    isDefault: Boolean(isDefault),
    sortOrder,
    config,
  };
}

export function buildOpenClawEnvironmentSummary(record: OpenClawEnvironmentResolved): OpenClawEnvironmentSummary {
  return toSummary(record);
}

export function redactOpenClawEnvironmentSecrets(record: OpenClawEnvironmentResolved): OpenClawEnvironmentSummary {
  return toSummary(record);
}
