import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyNotificationEmailConfig } from "@/lib/notification-email";

/**
 * POST /api/notifications/email/verify — verify SMTP connectivity for the email channel
 */
export async function POST(_req: NextRequest) {
  const tenantId = "default";

  const result = await query(
    `SELECT enabled, config FROM notification_preferences WHERE tenant_id = $1 AND channel = $2 LIMIT 1`,
    [tenantId, "email"],
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Email channel not configured" }, { status: 404 });
  }

  const row = result.rows[0] as { enabled: boolean; config: Record<string, unknown> };
  if (!row.enabled) {
    return NextResponse.json({ error: "Email channel is disabled" }, { status: 400 });
  }

  try {
    const result = await verifyNotificationEmailConfig(row.config ?? {});
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.message,
          errorCode: result.errorCode,
          diagnostics: result.diagnostics,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verification failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
