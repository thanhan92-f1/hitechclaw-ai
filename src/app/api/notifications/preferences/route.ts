import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/notification-secrets";

const SECRET_FIELDS: Record<string, string[]> = {
  email: ["smtp_pass"],
  telegram: ["bot_token"],
  slack: ["webhook_url"],
  discord: ["webhook_url"],
  webhook: ["secret_value"],
};

const EMAIL_VERIFY_METADATA_FIELDS = [
  "smtp_last_verified_at",
  "smtp_last_verify_status",
  "smtp_last_verify_message",
  "smtp_last_verify_error_code",
] as const;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBooleanString(value: unknown, fallback = "false"): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  const normalized = asTrimmedString(value).toLowerCase();
  if (["true", "false", "1", "0"].includes(normalized)) return normalized;
  return fallback;
}

function preserveExistingSecrets(
  channel: string,
  submittedConfig: Record<string, unknown>,
  existingConfig: Record<string, unknown>,
): Record<string, unknown> {
  const nextConfig = { ...submittedConfig };

  for (const field of SECRET_FIELDS[channel] ?? []) {
    const submittedValue = asTrimmedString(nextConfig[field]);
    const existingValue = typeof existingConfig[field] === "string" ? existingConfig[field] : "";

    if (!submittedValue && existingValue) {
      nextConfig[field] = decryptSecret(existingValue);
    }
  }

  return nextConfig;
}

function maskSecretsForResponse(channel: string, config: Record<string, unknown>): Record<string, unknown> {
  const nextConfig = { ...config };

  for (const field of SECRET_FIELDS[channel] ?? []) {
    const storedValue = typeof nextConfig[field] === "string" ? nextConfig[field] : "";
    if (!storedValue) continue;

    nextConfig[field] = "";
    nextConfig[`${field}_configured`] = isEncryptedSecret(storedValue) || Boolean(storedValue);
  }

  return nextConfig;
}

function encryptSecretFields(channel: string, config: Record<string, unknown>): Record<string, unknown> {
  const nextConfig = { ...config };

  for (const field of SECRET_FIELDS[channel] ?? []) {
    const value = asTrimmedString(nextConfig[field]);
    if (value) {
      nextConfig[field] = encryptSecret(value);
    }
  }

  return nextConfig;
}

function preserveEmailVerificationMetadata(
  channel: string,
  config: Record<string, unknown>,
  existingConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (channel !== "email") return config;

  const nextConfig = { ...config };
  for (const field of EMAIL_VERIFY_METADATA_FIELDS) {
    if (nextConfig[field] === undefined && existingConfig[field] !== undefined) {
      nextConfig[field] = existingConfig[field];
    }
  }

  return nextConfig;
}

function normalizeNotificationConfig(channel: string, config: Record<string, unknown>, enabled: boolean): Record<string, unknown> {
  const nextConfig = { ...config };

  if (channel === "email") {
    const smtpPort = asTrimmedString(nextConfig.smtp_port);
    const smtpSecure = asBooleanString(nextConfig.smtp_secure);

    if (smtpPort && !/^\d+$/.test(smtpPort)) {
      throw new Error("SMTP port must be a valid number.");
    }

    nextConfig.smtp_host = asTrimmedString(nextConfig.smtp_host);
    nextConfig.smtp_port = smtpPort;
    nextConfig.smtp_secure = smtpSecure || "false";
    nextConfig.smtp_user = asTrimmedString(nextConfig.smtp_user);
    nextConfig.smtp_pass = asTrimmedString(nextConfig.smtp_pass);
    nextConfig.smtp_from = asTrimmedString(nextConfig.smtp_from);
    nextConfig.smtp_reply_to = asTrimmedString(nextConfig.smtp_reply_to);
    nextConfig.email = asTrimmedString(nextConfig.email);

    if (enabled) {
      if (!nextConfig.smtp_host || !nextConfig.smtp_port || !nextConfig.smtp_from) {
        throw new Error("Email channel requires SMTP host, port, and from address.");
      }
    }
  } else if (channel === "telegram") {
    nextConfig.bot_token = asTrimmedString(nextConfig.bot_token);
    nextConfig.chat_id = asTrimmedString(nextConfig.chat_id);

    if (enabled && (!nextConfig.bot_token || !nextConfig.chat_id)) {
      throw new Error("Telegram channel requires bot token and chat ID.");
    }
  } else if (channel === "slack") {
    nextConfig.webhook_url = asTrimmedString(nextConfig.webhook_url);

    if (enabled && !nextConfig.webhook_url) {
      throw new Error("Slack channel requires a webhook URL.");
    }
  } else if (channel === "discord") {
    nextConfig.webhook_url = asTrimmedString(nextConfig.webhook_url);

    if (enabled && !nextConfig.webhook_url) {
      throw new Error("Discord channel requires a webhook URL.");
    }
  } else if (channel === "webhook") {
    nextConfig.url = asTrimmedString(nextConfig.url);
    nextConfig.secret_header = asTrimmedString(nextConfig.secret_header);
    nextConfig.secret_value = asTrimmedString(nextConfig.secret_value);

    if (enabled && !nextConfig.url) {
      throw new Error("Webhook channel requires a destination URL.");
    }
  }

  return encryptSecretFields(channel, nextConfig);
}

/**
 * GET /api/notifications/preferences — get all notification channel preferences
 */
export async function GET() {
  const tenantId = "default";

  const result = await query(
    `SELECT channel, enabled, config FROM notification_preferences WHERE tenant_id = $1 ORDER BY channel`,
    [tenantId],
  );

  // Return a map of channel → { enabled, config }
  const channels: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {};
  for (const row of result.rows) {
    const config = maskSecretsForResponse(
      row.channel,
      { ...(row.config ?? {}) } as Record<string, unknown>,
    );
    channels[row.channel] = { enabled: row.enabled, config };
  }

  return NextResponse.json({ channels });
}

/**
 * PUT /api/notifications/preferences — upsert a single channel preference
 * Body: { channel: string, enabled: boolean, config: object }
 */
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    channel: string;
    enabled: boolean;
    config: Record<string, unknown>;
  };
  const tenantId = "default";

  if (!body.channel) {
    return NextResponse.json({ error: "channel is required" }, { status: 400 });
  }

  const validChannels = ["email", "slack", "telegram", "discord", "webhook"];
  if (!validChannels.includes(body.channel)) {
    return NextResponse.json({ error: `Invalid channel. Must be one of: ${validChannels.join(", ")}` }, { status: 400 });
  }

  let normalizedConfig: Record<string, unknown>;
  try {
    const existing = await query(
      `SELECT config FROM notification_preferences WHERE tenant_id = $1 AND channel = $2 LIMIT 1`,
      [tenantId, body.channel],
    );
    const existingConfig = (existing.rows[0]?.config ?? {}) as Record<string, unknown>;
    const mergedConfig = preserveEmailVerificationMetadata(
      body.channel,
      preserveExistingSecrets(body.channel, body.config ?? {}, existingConfig),
      existingConfig,
    );

    normalizedConfig = normalizeNotificationConfig(body.channel, mergedConfig, body.enabled);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid configuration" },
      { status: 400 },
    );
  }

  await query(
    `INSERT INTO notification_preferences (tenant_id, channel, enabled, config, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, channel) DO UPDATE
     SET enabled = $3, config = $4, updated_at = NOW()`,
    [tenantId, body.channel, body.enabled, JSON.stringify(normalizedConfig)],
  );

  return NextResponse.json({ ok: true });
}
