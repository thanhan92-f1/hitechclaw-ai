"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerCog } from "lucide-react";
import { getAuthHeaders } from "./api";
import { useTenantFilter } from "./tenant-context";

type OpenClawEnvironmentOption = {
  id: string;
  name: string;
  baseUrl: string;
};

type OpenClawEnvironmentsPayload = {
  environments: OpenClawEnvironmentOption[];
  defaultEnvironmentId?: string | null;
};

const OPENCLAW_TARGET_SYNC_MS = 10 * 60 * 1000;

export function OpenClawTargetSwitcher() {
  const { mode, openClawEnvironmentId, setOpenClawEnvironmentId } = useTenantFilter();
  const [environments, setEnvironments] = useState<OpenClawEnvironmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (mode !== "openclaw") return;

    setLoading(true);
    try {
      const response = await fetch("/api/settings/openclaw/environments", {
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load OpenClaw targets");
      }

      const payload = (await response.json()) as OpenClawEnvironmentsPayload;
      const nextEnvironments = payload.environments ?? [];
      setEnvironments(nextEnvironments);

      if (!openClawEnvironmentId) {
        setOpenClawEnvironmentId(payload.defaultEnvironmentId ?? nextEnvironments[0]?.id ?? null);
      }
    } catch {
      setEnvironments([]);
    } finally {
      setLoading(false);
    }
  }, [mode, openClawEnvironmentId, setOpenClawEnvironmentId]);

  useEffect(() => {
    if (mode !== "openclaw") return;

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, OPENCLAW_TARGET_SYNC_MS);

    return () => window.clearInterval(timer);
  }, [mode, refresh]);

  if (mode !== "openclaw") {
    return null;
  }

  return (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3">
      <ServerCog className="h-4 w-4 text-[var(--text-tertiary)]" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Target</span>
      <select
        value={openClawEnvironmentId ?? ""}
        onChange={(event) => setOpenClawEnvironmentId(event.target.value || null)}
        className="min-w-[160px] bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none"
      >
        {environments.length === 0 ? <option value="">No targets</option> : null}
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </select>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-tertiary)]" /> : null}
    </div>
  );
}
