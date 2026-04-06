import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyNotificationEmailConfig } from "@/lib/notification-email";

/**
 * POST /api/notifications/email/verify — verify SMTP connectivity for the email channel
 */
export async function POST() {
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
    const verifyTimestamp = new Date().toISOString();

    await query(
      `UPDATE notification_preferences
       SET config = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(config, '{}'::jsonb),
               '{smtp_last_verified_at}',
               to_jsonb($3::text),
               true
             ),
             '{smtp_last_verify_status}',
             to_jsonb($4::text),
             true
           ),
           '{smtp_last_verify_message}',
           to_jsonb($5::text),
           true
         ),
         '{smtp_last_verify_error_code}',
         to_jsonb($6::text),
         true
       ),
       updated_at = NOW()
       WHERE tenant_id = $1 AND channel = $2`,
      [
        tenantId,
        "email",
        verifyTimestamp,
        result.ok ? "success" : "failed",
        result.message,
        result.errorCode ?? "",
      ],
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.message,
          errorCode: result.errorCode,
          diagnostics: result.diagnostics,
          verifiedAt: verifyTimestamp,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ...result, verifiedAt: verifyTimestamp });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verification failed";

    await query(
      `UPDATE notification_preferences
       SET config = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(config, '{}'::jsonb),
               '{smtp_last_verified_at}',
               to_jsonb($3::text),
               true
             ),
             '{smtp_last_verify_status}',
             to_jsonb($4::text),
             true
           ),
           '{smtp_last_verify_message}',
           to_jsonb($5::text),
           true
         ),
         '{smtp_last_verify_error_code}',
         to_jsonb($6::text),
         true
       ),
       updated_at = NOW()
       WHERE tenant_id = $1 AND channel = $2`,
      [tenantId, "email", new Date().toISOString(), "failed", message, ""],
    );

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
