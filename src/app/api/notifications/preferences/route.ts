import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNotificationConfig(channel: string, config: Record<string, unknown>, enabled: boolean): Record<string, unknown> {
  const nextConfig = { ...config };

  if (channel === "email") {
    const smtpPort = asTrimmedString(nextConfig.smtp_port);
    const smtpSecure = asTrimmedString(nextConfig.smtp_secure).toLowerCase();

    if (smtpPort && !/^\d+$/.test(smtpPort)) {
      throw new Error("SMTP port must be a valid number.");
    }

    if (smtpSecure && !["true", "false", "1", "0"].includes(smtpSecure)) {
      throw new Error("SMTP secure must be true or false.");
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
  }

  return nextConfig;
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
    channels[row.channel] = { enabled: row.enabled, config: row.config ?? {} };
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
    normalizedConfig = normalizeNotificationConfig(body.channel, body.config ?? {}, body.enabled);
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
