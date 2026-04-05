import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateAdmin, unauthorized } from "@/app/api/tools/_utils";

export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) {
    return unauthorized();
  }

  try {
    const range = req.nextUrl.searchParams.get("range") ?? "7d";
    const days = range === "30d" ? 30 : range === "24h" ? 1 : 7;
    const interval = `${days} days`;

    // 1. Summary stats
    const summary = await query(
      `SELECT
        COUNT(*) FILTER (WHERE event_type IN ('message_received', 'message_sent', 'error'))::int as total_messages,
        COUNT(*) FILTER (WHERE event_type = 'message_received' OR direction = 'inbound')::int as user_messages,
        COUNT(*) FILTER (WHERE event_type = 'message_sent' OR direction = 'outbound')::int as assistant_messages,
        COUNT(*) FILTER (WHERE event_type = 'error')::int as errors,
        0::int as interrupted,
        COUNT(*) FILTER (WHERE event_type = 'message_sent' OR direction = 'outbound')::int as delivered
       FROM events
       WHERE created_at > NOW() - $1::interval`,
      [interval]
    );

    // 2. Response time stats (from metadata on assistant messages)
    const responseStats = await query(
      `SELECT
        COALESCE(AVG((metadata->>'durationMs')::numeric), 0)::int as avg_duration_ms,
        COALESCE(MIN((metadata->>'durationMs')::numeric), 0)::int as min_duration_ms,
        COALESCE(MAX((metadata->>'durationMs')::numeric), 0)::int as max_duration_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'durationMs')::numeric), 0)::int as p95_duration_ms
       FROM events
       WHERE (event_type = 'message_sent' OR direction = 'outbound')
         AND metadata->>'durationMs' IS NOT NULL
         AND created_at > NOW() - $1::interval`,
      [interval]
    );

    // 3. Token usage (from metadata on assistant messages)
    const tokenUsage = await query(
      `SELECT
        COALESCE(SUM((metadata->'usage'->>'input')::bigint), 0)::bigint as input_tokens,
        COALESCE(SUM((metadata->'usage'->>'output')::bigint), 0)::bigint as output_tokens,
        COALESCE(SUM((metadata->'usage'->>'cacheRead')::bigint), 0)::bigint as cache_read_tokens,
        COALESCE(SUM((metadata->'usage'->>'cacheWrite')::bigint), 0)::bigint as cache_write_tokens,
        COALESCE(SUM((metadata->'usage'->>'total')::bigint), 0)::bigint as total_tokens,
        COUNT(DISTINCT metadata->>'model')::int as model_count
       FROM events
       WHERE (event_type = 'message_sent' OR direction = 'outbound')
         AND metadata->'usage' IS NOT NULL
         AND created_at > NOW() - $1::interval`,
      [interval]
    );

    // 4. Per-channel activity
    const channelActivity = await query(
      `SELECT
        COALESCE(NULLIF(channel_id, ''), 'unknown') as channel_name,
        COALESCE(NULLIF(channel_id, ''), 'unknown') as channel_slug,
        COUNT(*) FILTER (WHERE event_type IN ('message_received', 'message_sent', 'error'))::int as message_count,
        COUNT(*) FILTER (WHERE event_type = 'message_received' OR direction = 'inbound')::int as user_count,
        COUNT(*) FILTER (WHERE event_type = 'message_sent' OR direction = 'outbound')::int as assistant_count,
        COUNT(*) FILTER (WHERE event_type = 'error')::int as error_count,
        MAX(created_at) as last_message_at
       FROM events
       WHERE created_at > NOW() - $1::interval
       GROUP BY COALESCE(NULLIF(channel_id, ''), 'unknown')
       ORDER BY message_count DESC`,
      [interval]
    );

    // 5. Model breakdown
    const modelBreakdown = await query(
      `SELECT
        COALESCE(metadata->>'model', 'unknown') as model,
        COALESCE(metadata->>'provider', 'unknown') as provider,
        COUNT(*)::int as message_count,
        COALESCE(AVG((metadata->>'durationMs')::numeric), 0)::int as avg_duration_ms,
        COALESCE(SUM((metadata->'usage'->>'total')::bigint), 0)::bigint as total_tokens
       FROM events
       WHERE (event_type = 'message_sent' OR direction = 'outbound')
         AND metadata->>'model' IS NOT NULL
         AND created_at > NOW() - $1::interval
       GROUP BY metadata->>'model', metadata->>'provider'
       ORDER BY message_count DESC`,
      [interval]
    );

    // 6. Hourly activity pattern
    const hourlyPattern = await query(
      `SELECT
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) FILTER (WHERE event_type IN ('message_received', 'message_sent', 'error'))::int as count,
        COUNT(*) FILTER (WHERE event_type = 'message_received' OR direction = 'inbound')::int as user_count,
        COUNT(*) FILTER (WHERE event_type = 'message_sent' OR direction = 'outbound')::int as assistant_count
       FROM events
       WHERE created_at > NOW() - $1::interval
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [interval]
    );

    // 7. Daily volume timeline
    const dailyVolume = await query(
      `SELECT
        DATE(created_at) as day,
        COUNT(*) FILTER (WHERE event_type IN ('message_received', 'message_sent', 'error'))::int as total,
        COUNT(*) FILTER (WHERE event_type = 'message_received' OR direction = 'inbound')::int as user_msgs,
        COUNT(*) FILTER (WHERE event_type = 'message_sent' OR direction = 'outbound')::int as assistant_msgs,
        COUNT(*) FILTER (WHERE event_type = 'error')::int as errors
       FROM events
       WHERE created_at > NOW() - $1::interval
       GROUP BY DATE(created_at)
       ORDER BY day`,
      [interval]
    );

    // 8. Recent messages (last 10)
    const recentMessages = await query(
      `SELECT
        id,
        CASE
          WHEN event_type = 'message_received' OR direction = 'inbound' THEN 'user'
          WHEN event_type = 'message_sent' OR direction = 'outbound' THEN 'assistant'
          ELSE event_type
        END as role,
        LEFT(COALESCE(content, ''), 120) as content_preview,
        CASE
          WHEN event_type = 'error' THEN 'error'
          WHEN event_type = 'message_sent' OR direction = 'outbound' THEN 'sent'
          ELSE 'received'
        END as status,
        metadata,
        created_at,
        COALESCE(NULLIF(channel_id, ''), 'unknown') as channel_name,
        COALESCE(NULLIF(channel_id, ''), 'unknown') as channel_slug
       FROM events
       WHERE event_type IN ('message_received', 'message_sent', 'error')
       ORDER BY created_at DESC
       LIMIT 10`
    );

    // 9. Error details (recent errors/interrupted)
    const recentErrors = await query(
      `SELECT
        id,
        LEFT(COALESCE(content, ''), 200) as content_preview,
        'error' as status,
        metadata,
        created_at,
        COALESCE(NULLIF(channel_id, ''), 'unknown') as channel_name
       FROM events
       WHERE event_type = 'error'
       ORDER BY created_at DESC
       LIMIT 5`
    );

    return NextResponse.json({
      summary: summary.rows[0],
      responseStats: responseStats.rows[0],
      tokenUsage: tokenUsage.rows[0],
      channelActivity: channelActivity.rows,
      modelBreakdown: modelBreakdown.rows,
      hourlyPattern: hourlyPattern.rows,
      dailyVolume: dailyVolume.rows,
      recentMessages: recentMessages.rows,
      recentErrors: recentErrors.rows,
      range,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[victoryos/overview] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
