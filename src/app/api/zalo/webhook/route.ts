import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getZaloBotToken, getZaloWebhookSecret, sendZaloMessage } from "@/lib/zalo";
import {
  asRecord,
  buildZaloReply,
  getInboundChatId,
  getInboundSender,
  getInboundText,
  shouldProcessMessage,
} from "@/lib/zalo-webhook";

interface ZaloPreferenceRow {
  tenant_id: string;
  config: Record<string, unknown>;
}

async function readPayload(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return asRecord(await request.json());
  }

  const raw = await request.text();
  if (!raw.trim()) return {};

  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return { raw };
  }
}

async function getActiveZaloPreference(): Promise<ZaloPreferenceRow | null> {
  const result = await query(
    `SELECT tenant_id, config
     FROM notification_preferences
     WHERE channel = 'zalo' AND enabled = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [],
  );

  if (result.rowCount === 0) return null;

  return {
    tenant_id: result.rows[0].tenant_id as string,
    config: asRecord(result.rows[0].config),
  };
}

async function ensureAgent(agentId: string, tenantId: string): Promise<void> {
  await query(
    `INSERT INTO agents (id, name, description, framework, role, tenant_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      agentId,
      "Zalo Bot",
      "Inbound Zalo bot integration",
      "zalo",
      "operator",
      tenantId,
    ],
  );
}

async function logEvent(params: {
  agentId: string;
  tenantId: string;
  eventType: "message_received" | "message_sent";
  sessionKey: string;
  channelId: string;
  sender: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO events (
      agent_id, event_type, direction, session_key, channel_id, sender,
      content, content_redacted, metadata, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      params.agentId,
      params.eventType,
      params.eventType === "message_received" ? "inbound" : "outbound",
      params.sessionKey,
      params.channelId,
      params.sender || null,
      params.content || null,
      false,
      JSON.stringify(params.metadata),
    ],
  );

  await query(
    `INSERT INTO sessions (agent_id, session_key, channel_id, last_active, message_count, tenant_id)
     VALUES ($1, $2, $3, NOW(), 1, $4)
     ON CONFLICT (agent_id, session_key)
     DO UPDATE SET last_active = NOW(), message_count = sessions.message_count + 1`,
    [params.agentId, params.sessionKey, params.channelId, params.tenantId],
  );

  const statField = params.eventType === "message_received" ? "messages_received" : "messages_sent";
  await query(
    `INSERT INTO daily_stats (agent_id, day, ${statField}, tenant_id)
     VALUES ($1, CURRENT_DATE, 1, $2)
     ON CONFLICT (agent_id, day)
     DO UPDATE SET ${statField} = daily_stats.${statField} + 1`,
    [params.agentId, params.tenantId],
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, channel: "zalo", webhook: "ready" });
}

export async function POST(request: NextRequest) {
  try {
    const preference = await getActiveZaloPreference();
    if (!preference) {
      return NextResponse.json({ error: "Zalo channel is not configured" }, { status: 404 });
    }

    const webhookSecret = getZaloWebhookSecret(preference.config);
    const providedSecret = request.headers.get("x-bot-api-secret-token")?.trim() ?? "";
    if (webhookSecret && providedSecret !== webhookSecret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const payload = await readPayload(request);
    if (!shouldProcessMessage(payload)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const text = getInboundText(payload);
    const chatId = getInboundChatId(payload) || String(preference.config.chat_id ?? "").trim();
    const sender = getInboundSender(payload) || "zalo-user";
    const sessionKey = `zalo:${chatId || "unknown"}`;
    const channelId = chatId || "zalo";
    const agentId = String(preference.config.agent_id ?? "").trim() || "zalo-bot";

    await ensureAgent(agentId, preference.tenant_id);

    await logEvent({
      agentId,
      tenantId: preference.tenant_id,
      eventType: "message_received",
      sessionKey,
      channelId,
      sender,
      content: text || "[empty message]",
      metadata: {
        provider: "zalo",
        raw: payload,
      },
    });

    const normalizedCommand = text.trim().toLowerCase();
    const reply = buildZaloReply(normalizedCommand, preference.config);
    if (reply && chatId) {
      const botToken = getZaloBotToken(preference.config);
      if (botToken) {
        await sendZaloMessage({ botToken, chatId }, reply);
        await logEvent({
          agentId,
          tenantId: preference.tenant_id,
          eventType: "message_sent",
          sessionKey,
          channelId,
          sender: "zalo-bot",
          content: reply,
          metadata: {
            provider: "zalo",
            autoReply: true,
            command: normalizedCommand,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[zalo/webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
