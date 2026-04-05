"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ActiveRun {
  run_id: string;
  agent_id: string;
  agent_name: string;
  started_at: string;
  current_action: string;
  source_channel: string | null;
  model: string | null;
  status: "running" | "paused";
  /** true = main agent (from agents table), false = sub-agent run (from subagent_runs) */
  is_main_agent?: boolean;
}

export interface KillRunVerification {
  verified_dead?: boolean;
  remaining_sessions?: number;
  verification_method?: "session-recheck" | "skipped" | "failed";
  detail?: string;
}

export interface KillRunResult {
  ok: boolean;
  run_id: string;
  agent_id?: string;
  agent_name?: string;
  method?: string;
  detail?: string;
  reason?: string | null;
  sessions?: Array<{
    session_key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  verification?: KillRunVerification;
}

export function isKillVerified(verification?: KillRunVerification | null): boolean {
  return !verification || verification.verified_dead === true;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof document !== "undefined") {
    const csrf = document.cookie.match(/mc_csrf=([^;]+)/)?.[1];
    if (csrf) headers["x-csrf-token"] = decodeURIComponent(csrf);
  }
  return headers;
}

export function useActiveRuns(agentId?: string, pollInterval = 5000) {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const burstTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const poll = useCallback(async () => {
    try {
      const url = agentId
        ? `/api/active-runs?agent_id=${agentId}`
        : "/api/active-runs";
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { runs: ActiveRun[] };
      setRuns(data.runs);
    } catch {
      // Silent
    }
  }, [agentId]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const triggerBurstPoll = useCallback(() => {
    for (const timer of burstTimersRef.current) {
      clearTimeout(timer);
    }
    burstTimersRef.current = [300, 1000, 2500, 5000].map((delay) =>
      setTimeout(() => {
        void pollRef.current();
      }, delay)
    );
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, pollInterval);
    return () => {
      clearInterval(timer);
      for (const burstTimer of burstTimersRef.current) {
        clearTimeout(burstTimer);
      }
      burstTimersRef.current = [];
    };
  }, [poll, pollInterval]);

  const killRun = useCallback(async (runId: string, reason?: string) => {
    // Main agents use agent:id format — kill via gateway proxy
    if (runId.startsWith("agent:")) {
      const agentIdFromRun = runId.replace("agent:", "");
      try {
        const res = await fetch("/api/gateway/kill-agent", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentIdFromRun, reason: reason || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<KillRunResult>;
        const result: KillRunResult = {
          ok: res.ok && data.ok !== false,
          run_id: runId,
          agent_id: data.agent_id ?? agentIdFromRun,
          agent_name: data.agent_name,
          method: data.method,
          detail: data.detail,
          reason: data.reason ?? reason ?? null,
          sessions: data.sessions,
          verification: data.verification,
        };

        triggerBurstPoll();
        return result;
      } catch (error) {
        return {
          ok: false,
          run_id: runId,
          agent_id: agentIdFromRun,
          detail: error instanceof Error ? error.message : "Kill request failed",
        };
      }
    }

    // Sub-agent runs — existing kill endpoint
    try {
      const res = await fetch(`/api/tools/agents-live/${runId}/kill`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
      const result: KillRunResult = {
        ok: res.ok,
        run_id: runId,
        detail: data.detail ?? data.error,
        reason: reason ?? null,
      };
      if (res.ok) {
        triggerBurstPoll();
      }
      return result;
    } catch (error) {
      return {
        ok: false,
        run_id: runId,
        detail: error instanceof Error ? error.message : "Kill request failed",
      };
    }
  }, [triggerBurstPoll]);

  const pauseRun = useCallback(async (runId: string) => {
    if (runId.startsWith("agent:")) {
      // Main agents — pause not supported yet
      return false;
    }
    const res = await fetch(`/api/tools/agents-live/${runId}/pause`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setRuns((prev) =>
        prev.map((r) => (r.run_id === runId ? { ...r, status: "paused" as const } : r))
      );
    }
    return res.ok;
  }, []);

  const resumeRun = useCallback(async (runId: string) => {
    if (runId.startsWith("agent:")) {
      return false;
    }
    const res = await fetch(`/api/tools/agents-live/${runId}/resume`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setRuns((prev) =>
        prev.map((r) => (r.run_id === runId ? { ...r, status: "running" as const } : r))
      );
    }
    return res.ok;
  }, []);

  return { runs, killRun, pauseRun, resumeRun };
}