import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { resolveRole } from "@/app/api/tools/_utils";
import { query } from "@/lib/db";
import { broadcast } from "@/lib/event-bus";

/**
 * Kill a main agent by aborting its running sessions on the OpenClaw gateway.
 * Uses SSH + `openclaw gateway call sessions.abort` (Option A — Operation Extinguisher).
 *
 * POST /api/gateway/kill-agent
 * Body: { agent_id: string, reason?: string, kill_all?: boolean }
 *
 * Response includes `verified_dead: boolean` — true only if post-kill session
 * check confirms zero running sessions remain.
 */

interface SessionInfo {
  key: string;
  status: string;
  label?: string;
  displayName?: string;
  agentId?: string;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

interface AbortResult {
  session_key: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface VerificationResult {
  verified_dead: boolean;
  remaining_sessions: number;
  verification_method: "session-recheck" | "skipped" | "failed";
  detail: string;
}

function matchesAgentSession(session: SessionInfo, agentId: string, agentName: string): boolean {
  const haystacks = [
    session.key,
    session.label,
    session.displayName,
    session.agentId,
    session.agent_id,
    typeof session.metadata?.agent_id === "string" ? session.metadata.agent_id : undefined,
    typeof session.metadata?.agentId === "string" ? session.metadata.agentId : undefined,
    typeof session.metadata?.agent_name === "string" ? session.metadata.agent_name : undefined,
    typeof session.metadata?.agentName === "string" ? session.metadata.agentName : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  const needles = [agentId, agentName]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return needles.some((needle) =>
    haystacks.some((haystack) => haystack === needle || haystack.includes(needle))
  );
}

async function listGatewaySessions(sshHost: string, sshUser: string): Promise<SessionInfo[]> {
  const listOutput = await sshExec(
    sshHost,
    sshUser,
    "openclaw gateway call sessions.list --json"
  );
  const listData = JSON.parse(listOutput) as { sessions?: SessionInfo[] };
  return listData.sessions ?? [];
}

function sshExec(host: string, user: string, command: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      "ssh",
      [
        "-o", "BatchMode=yes",
        "-o", `ConnectTimeout=${Math.ceil(timeoutMs / 2000)}`,
        "-o", "StrictHostKeyChecking=accept-new",
        `${user}@${host}`,
        command,
      ],
      { timeout: timeoutMs },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message));
        } else {
          resolve(stdout);
        }
      }
    );
    // Ensure cleanup
    proc.on("error", reject);
  });
}

export async function POST(req: NextRequest) {
  const role = await resolveRole(req);
  if (!role || (role !== "owner" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { agent_id?: string; reason?: string; kill_all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agent_id, reason, kill_all } = body;
  if (!agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  const sshHost = process.env.GATEWAY_SSH_HOST ?? "";
  const sshUser = process.env.GATEWAY_SSH_USER ?? "brynn";

  // Look up agent info
  const agentResult = await query(
    "SELECT id, name, metadata, tenant_id FROM agents WHERE id = $1 LIMIT 1",
    [agent_id]
  );
  const agent = agentResult.rows[0] as Record<string, unknown> | undefined;
  const agentName = agent ? String(agent.name ?? agent_id) : agent_id;
  const tenantId = agent ? String(agent.tenant_id ?? "default") : "default";

  let killMethod = "none";
  let killOk = false;
  let killDetail = "";
  const abortResults: AbortResult[] = [];
  let verification: VerificationResult = {
    verified_dead: false,
    remaining_sessions: -1,
    verification_method: "skipped",
    detail: "Verification not started",
  };

  if (!sshHost) {
    // No gateway SSH configured — event-only fallback with WARNING
    killMethod = "event-only";
    killOk = false;
    killDetail = "WARNING: No GATEWAY_SSH_HOST configured — kill event logged but agent was NOT stopped";
    console.warn("[kill-agent] No GATEWAY_SSH_HOST configured. Kill is event-only.");
  } else {
    try {
      // Step 1: List all sessions from the gateway
      const sessions = await listGatewaySessions(sshHost, sshUser);

      // Step 2: Find agent-scoped running sessions unless kill_all is requested
      const targets = kill_all
        ? sessions.filter((s) => s.status === "running")
        : sessions.filter((s) => s.status === "running" && matchesAgentSession(s, agent_id, agentName));

      if (targets.length === 0) {
        killMethod = "gateway-ssh";
        killOk = true;
        killDetail = kill_all
          ? "No running sessions found — gateway is already idle"
          : "No matching running sessions found — agent is already idle";
        verification = {
          verified_dead: true,
          remaining_sessions: 0,
          verification_method: "session-recheck",
          detail: killDetail,
        };
      } else {
        // Step 3: Abort each running session
        killMethod = "gateway-ssh";
        for (const session of targets) {
          try {
            const abortOutput = await sshExec(
              sshHost,
              sshUser,
              `openclaw gateway call sessions.abort --params '{"key": "${session.key}"}' --json`
            );
            const abortData = JSON.parse(abortOutput) as { ok?: boolean; status?: string; abortedRunId?: string | null };
            abortResults.push({
              session_key: session.key,
              label: session.displayName ?? session.label ?? session.key,
              ok: abortData.ok === true,
              detail: abortData.abortedRunId
                ? `Aborted run ${abortData.abortedRunId}`
                : abortData.status ?? "aborted",
            });
          } catch (err) {
            abortResults.push({
              session_key: session.key,
              label: session.displayName ?? session.label ?? session.key,
              ok: false,
              detail: err instanceof Error ? err.message : "Abort failed",
            });
          }
        }

        const succeeded = abortResults.filter((r) => r.ok).length;
        const failed = abortResults.filter((r) => !r.ok).length;
        killOk = succeeded > 0;
        killDetail = `Aborted ${succeeded}/${targets.length} running sessions${failed > 0 ? ` (${failed} failed)` : ""}`;

        // Verification continues in the shared Phase 7 block below.
      }
    } catch (err) {
      killMethod = "gateway-ssh";
      killOk = false;
      killDetail = `Gateway SSH failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      console.error("[kill-agent] Gateway SSH error:", err);
    }
  }

  // ── Phase 7: Kill Verification ──────────────────────────────────────
  // After abort, wait briefly then re-check sessions to confirm agent is dead.
  if (!sshHost || killMethod === "event-only") {
    verification = {
      verified_dead: false,
      remaining_sessions: -1,
      verification_method: "skipped",
      detail: "No SSH host — verification skipped",
    };
  } else if (!killOk) {
    verification = {
      verified_dead: false,
      remaining_sessions: -1,
      verification_method: "skipped",
      detail: "Kill failed — verification skipped",
    };
  } else {
    // Wait 2s for abort to propagate through the gateway
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const verifySessions = await listGatewaySessions(sshHost, sshUser);
      const remainingSessions = kill_all
        ? verifySessions.filter((s) => s.status === "running")
        : verifySessions.filter((s) => s.status === "running" && matchesAgentSession(s, agent_id, agentName));

      if (remainingSessions.length === 0) {
        verification = {
          verified_dead: true,
          remaining_sessions: 0,
          verification_method: "session-recheck",
          detail: "Confirmed: zero running sessions remain",
        };
        if (!killDetail.includes("verified stopped") && !killDetail.includes("already idle")) {
          killDetail += " — verified stopped";
        }
      } else {
        verification = {
          verified_dead: false,
          remaining_sessions: remainingSessions.length,
          verification_method: "session-recheck",
          detail: `WARNING: ${remainingSessions.length} session(s) still running after abort`,
        };
        killOk = false;
        if (!killDetail.includes("still running")) {
          killDetail += ` — ${remainingSessions.length} session(s) still running`;
        }
        console.warn(
          `[kill-agent] Verification failed: ${remainingSessions.length} sessions still running`,
          remainingSessions.map((s) => s.key)
        );
      }
    } catch (err) {
      verification = {
        verified_dead: false,
        remaining_sessions: -1,
        verification_method: "failed",
        detail: `Verification SSH failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
      killOk = false;
      if (!killDetail.includes("verification failed")) {
        killDetail += ` — verification failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      }
      console.error("[kill-agent] Verification error:", err);
    }
  }

  // Log to audit trail
  try {
    await query(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, detail, ip_address, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "admin",
        "agent.kill",
        "agent",
        agent_id,
        JSON.stringify({
          agent_name: agentName,
          reason: reason ?? null,
          kill_method: killMethod,
          kill_success: killOk,
          kill_detail: killDetail,
          sessions_aborted: abortResults,
          verification,
          is_main_agent: true,
        }),
        req.headers.get("x-forwarded-for") ?? null,
        tenantId,
      ]
    );
  } catch (err) {
    console.error("[kill-agent] Audit log error:", err);
  }

  // Log to events table
  try {
    await query(
      `INSERT INTO events (agent_id, event_type, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        agent_id,
        "agent_killed",
        `Agent killed from HiTechClaw AI: ${reason ?? "no reason provided"}`,
        JSON.stringify({
          source: "hitechclaw-ai-kill-switch",
          kill_method: killMethod,
          kill_success: killOk,
          sessions_aborted: abortResults.length,
          verification,
          verified_dead: verification.verified_dead,
        }),
      ]
    );
  } catch (err) {
    console.error("[kill-agent] Event log error:", err);
  }

  // Broadcast kill event to connected dashboards
  broadcast({
    type: "agent_killed",
    payload: {
      agent_id,
      agent_name: agentName,
      method: killMethod,
      sessions_aborted: abortResults.length,
      reason: reason ?? null,
      verification,
      verified_dead: verification.verified_dead,
    },
  });

  return NextResponse.json({
    ok: killOk,
    agent_id,
    agent_name: agentName,
    method: killMethod,
    detail: killDetail,
    sessions: abortResults,
    reason: reason ?? null,
    verification,
  });
}