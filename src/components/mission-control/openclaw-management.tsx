"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  Loader2,
  Play,
  RefreshCcw,
  Server,
  Square,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { ShellHeader } from "./dashboard";
import { DetailCard, EmptyCard, ListCard, StatCard } from "./ui-cards";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { getAuthHeaders, redirectToLogin } from "./api";
import { type OpenClawSection, useTenantFilter } from "./tenant-context";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

interface ServiceInfo {
  ok?: boolean;
  domain?: string;
  ip?: string;
  dashboardUrl?: string;
  gatewayToken?: string;
  mgmtApiKey?: string;
  status?: string;
  version?: string;
  mgmtVersion?: string;
  latestMgmtVersion?: string;
  mgmtUpdateAvailable?: boolean;
  ssl?: string;
  acmeEmail?: string;
  sslIssuer?: string;
  dnsStatus?: string;
}

interface ServiceStatus {
  ok?: boolean;
  openclaw?: { status?: string; startedAt?: string };
  caddy?: { status?: string };
  version?: string;
  gatewayPort?: string;
}

interface SystemInfo {
  ok?: boolean;
  hostname?: string;
  ip?: string;
  os?: string;
  uptime?: number;
  loadAvg?: number[];
  memory?: { total?: string; free?: string; used?: string };
  disk?: { total?: string; used?: string; available?: string; usagePercent?: string };
  nodeVersion?: string;
  openclawVersion?: string;
}

interface UpstreamStatus {
  ok?: boolean;
  [key: string]: unknown;
}

interface ConfigInfo {
  ok?: boolean;
  provider?: string;
  model?: string;
  apiKeys?: Record<string, string | null>;
  config?: Record<string, unknown>;
}

interface SessionsInfo {
  ok?: boolean;
  command?: string;
  result?: {
    sessions?: Array<{
      key?: string;
      agentId?: string;
      updatedAt?: string;
      store?: string;
      active?: boolean;
    }>;
  };
}

interface LogsInfo {
  ok?: boolean;
  service?: string;
  lines?: number;
  logs?: string;
}

interface VersionInfo {
  ok?: boolean;
  version?: string;
  clawVersion?: string;
  message?: string;
}

const sectionOptions: Array<{ key: OpenClawSection; label: string; icon: typeof Server }> = [
  { key: "overview", label: "Overview", icon: Server },
  { key: "runtime", label: "Runtime", icon: Activity },
  { key: "config", label: "Config", icon: Wrench },
  { key: "sessions", label: "Sessions", icon: Database },
];

function fmtUptime(seconds?: number) {
  if (!seconds || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function fmtDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-ZA");
}

function statusTone(status?: string) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("running") || normalized.includes("ok") || normalized.includes("ready")) {
    return "text-[var(--accent)]";
  }
  if (normalized.includes("warn") || normalized.includes("pending")) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--danger)]";
}

async function requestOpenClaw<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/openclaw-management${path}`, {
    headers: {
      ...getAuthHeaders(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    ...init,
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data as T;
}

function useOpenClawFetch<T>(path: string, intervalMs = 30000, enabled = true) {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: enabled, error: null });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const data = await requestOpenClaw<T>(path);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        loading: false,
        error: error instanceof Error ? error.message : "Request failed",
      }));
    }
  }, [enabled, path]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, refresh]);

  return { ...state, refresh };
}

export function OpenClawManagement() {
  const { openClawSection, setOpenClawSection } = useTenantFilter();
  const [serviceFilter, setServiceFilter] = useState<"openclaw" | "caddy">("openclaw");
  const [lines, setLines] = useState(150);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("anthropic/claude-sonnet-4-20250514");
  const [apiKey, setApiKey] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const info = useOpenClawFetch<ServiceInfo>("/info", 60000);
  const status = useOpenClawFetch<ServiceStatus>("/status", 20000);
  const system = useOpenClawFetch<SystemInfo>("/system", 45000);
  const upstream = useOpenClawFetch<UpstreamStatus>("/openclaw/status?all=true&usage=true&deep=false&timeoutMs=10000", 45000);
  const config = useOpenClawFetch<ConfigInfo>("/config", 45000, openClawSection === "overview" || openClawSection === "config");
  const sessions = useOpenClawFetch<SessionsInfo>("/sessions?agent=main&allAgents=false", 30000, openClawSection === "overview" || openClawSection === "sessions");
  const logs = useOpenClawFetch<LogsInfo>(`/logs?lines=${lines}&service=${serviceFilter}`, 20000, openClawSection === "runtime");
  const version = useOpenClawFetch<VersionInfo>("/version", 60000, openClawSection === "overview" || openClawSection === "runtime");

  useEffect(() => {
    if (config.data?.provider) {
      setProvider(config.data.provider);
    }
    if (config.data?.model) {
      setModel(config.data.model);
    }
  }, [config.data?.model, config.data?.provider]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      info.refresh(),
      status.refresh(),
      system.refresh(),
      upstream.refresh(),
      config.refresh(),
      sessions.refresh(),
      logs.refresh(),
      version.refresh(),
    ]);
  }, [config, info, logs, sessions, status, system, upstream, version]);

  const performRuntimeAction = useCallback(async (action: "start" | "restart" | "rebuild" | "stop") => {
    setRuntimeBusy(action);
    try {
      const result = await requestOpenClaw<{ ok?: boolean; message?: string; status?: string }>(`/${action}`, { method: "POST" });
      toast.success(result.message ?? `${action[0].toUpperCase()}${action.slice(1)} dispatched`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setRuntimeBusy(null);
    }
  }, [refreshAll]);

  const handleUpgrade = useCallback(async () => {
    setRuntimeBusy("upgrade");
    try {
      const result = await requestOpenClaw<VersionInfo>("/upgrade", { method: "POST" });
      toast.success(result.message ?? "Upgrade started. Monitor status for progress.");
      await Promise.all([status.refresh(), version.refresh(), logs.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start upgrade");
    } finally {
      setRuntimeBusy(null);
    }
  }, [logs, status, version]);

  const handleApplyProvider = useCallback(async () => {
    setConfigBusy(true);
    try {
      const result = await requestOpenClaw<{ provider?: string; model?: string }>("/config/provider", {
        method: "PUT",
        body: JSON.stringify({ provider, model }),
      });
      toast.success(`Provider switched to ${result.provider ?? provider}`);
      await Promise.all([config.refresh(), status.refresh(), upstream.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update provider");
    } finally {
      setConfigBusy(false);
    }
  }, [config, model, provider, status, upstream]);

  const handleTestApiKey = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Enter an API key first");
      return;
    }
    setConfigBusy(true);
    try {
      await requestOpenClaw<{ ok?: boolean; error?: string }>("/config/test-key", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey }),
      });
      toast.success("API key is valid");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "API key validation failed");
    } finally {
      setConfigBusy(false);
    }
  }, [apiKey, provider]);

  const handleApplyApiKey = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Enter an API key first");
      return;
    }
    setConfigBusy(true);
    try {
      await requestOpenClaw<{ ok?: boolean; provider?: string }>("/config/api-key", {
        method: "PUT",
        body: JSON.stringify({ provider, apiKey }),
      });
      toast.success(`API key updated for ${provider}`);
      setApiKey("");
      await config.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update API key");
    } finally {
      setConfigBusy(false);
    }
  }, [apiKey, config, provider]);

  const handleCleanup = useCallback(async () => {
    setCleanupBusy(true);
    try {
      await requestOpenClaw<{ ok?: boolean; message?: string }>("/sessions/cleanup", {
        method: "POST",
        body: JSON.stringify({ agent: "main", dryRun: true, fixMissing: true }),
      });
      toast.success("Session cleanup dry run completed");
      await sessions.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cleanup failed");
    } finally {
      setCleanupBusy(false);
    }
  }, [sessions]);

  const sessionRows = sessions.data?.result?.sessions ?? [];
  const sessionColumns = useMemo<Array<ColumnDef<(typeof sessionRows)[number]>>>(() => [
    {
      id: "key",
      header: "Session Key",
      accessor: (row) => <span className="font-mono text-xs text-[var(--text-primary)]">{row.key ?? "—"}</span>,
      sortValue: (row) => row.key ?? "",
      searchable: true,
    },
    {
      id: "agentId",
      header: "Agent",
      accessor: (row) => row.agentId ?? "main",
      sortValue: (row) => row.agentId ?? "",
      searchable: true,
    },
    {
      id: "updatedAt",
      header: "Updated",
      accessor: (row) => fmtDate(row.updatedAt),
      sortValue: (row) => row.updatedAt ?? "",
    },
  ], [sessionRows]);

  const errors = [info.error, status.error, system.error, upstream.error, config.error, sessions.error, logs.error, version.error].filter(Boolean);

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="OpenClaw Management"
        subtitle="Operate OpenClaw inside the HiTechClaw shell. Runtime controls, service health, config changes, and session maintenance are proxied through the secured management API."
        eyebrow="OpenClaw"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {sectionOptions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpenClawSection(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              openClawSection === key
                ? "bg-[rgba(0,212,126,0.15)] text-[var(--accent)]"
                : "border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {errors.length > 0 ? (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {errors[0]}
        </div>
      ) : null}

      {(info.loading && !info.data) || (status.loading && !status.data) ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-secondary)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Syncing OpenClaw management data…
        </div>
      ) : null}

      {openClawSection === "overview" ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Service" value={status.data?.openclaw?.status ?? info.data?.status ?? "unknown"} subtitle={`Caddy: ${status.data?.caddy?.status ?? "unknown"}`} icon={Server} className={statusTone(status.data?.openclaw?.status)} />
            <StatCard label="Version" value={info.data?.version ?? status.data?.version ?? "—"} subtitle={`Mgmt ${info.data?.mgmtVersion ?? "—"}`} icon={Bot} />
            <StatCard label="CLI Channel" value={version.data?.version ?? "—"} subtitle={version.data?.clawVersion ?? "OpenClaw CLI unknown"} icon={Wrench} />
            <StatCard label="Gateway Port" value={status.data?.gatewayPort ?? "18789"} subtitle={`DNS: ${info.data?.dnsStatus ?? "unknown"}`} icon={Activity} />
            <StatCard label="Uptime" value={fmtUptime(system.data?.uptime)} subtitle={system.data?.hostname ?? "OpenClaw host"} icon={Cpu} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <DetailCard title="Service Identity" icon={CheckCircle2} className="xl:col-span-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["Domain", info.data?.domain ?? "—"],
                  ["IP", info.data?.ip ?? system.data?.ip ?? "—"],
                  ["SSL", info.data?.sslIssuer ?? info.data?.ssl ?? "—"],
                  ["Dashboard URL", info.data?.dashboardUrl ?? "—"],
                  ["Gateway Token", info.data?.gatewayToken ?? "—"],
                  ["Mgmt API Key", info.data?.mgmtApiKey ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{label}</p>
                    <p className="mt-1 break-all text-sm text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </div>
            </DetailCard>

            <ListCard title="Host Health" icon={HardDrive}>
              <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Memory</p>
                  <p className="mt-1">{system.data?.memory?.used ?? "—"} / {system.data?.memory?.total ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Disk</p>
                  <p className="mt-1">{system.data?.disk?.used ?? "—"} / {system.data?.disk?.total ?? "—"} ({system.data?.disk?.usagePercent ?? "—"})</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Load Average</p>
                  <p className="mt-1 font-mono">{(system.data?.loadAvg ?? []).join(" · ") || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Provider</p>
                  <p className="mt-1">{config.data?.provider ?? "—"}</p>
                </div>
              </div>
            </ListCard>
          </div>
        </>
      ) : null}

      {openClawSection === "runtime" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.4fr]">
          <ListCard title="Runtime Control" icon={TerminalSquare}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "start", label: "Start", icon: Play },
                { key: "restart", label: "Restart", icon: RefreshCcw },
                { key: "rebuild", label: "Rebuild", icon: Wrench },
                { key: "stop", label: "Stop", icon: Square },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void performRuntimeAction(key as "start" | "restart" | "rebuild" | "stop")}
                  disabled={runtimeBusy != null}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {runtimeBusy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
              <p>OpenClaw: <span className={statusTone(status.data?.openclaw?.status)}>{status.data?.openclaw?.status ?? "unknown"}</span></p>
              <p>Caddy: <span className={statusTone(status.data?.caddy?.status)}>{status.data?.caddy?.status ?? "unknown"}</span></p>
              <p>Started: {fmtDate(status.data?.openclaw?.startedAt)}</p>
              <p>CLI: {version.data?.clawVersion ?? "unknown"}</p>
              <p>Channel: {version.data?.version ?? "unknown"}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={runtimeBusy != null}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[rgba(0,212,126,0.12)] text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
            >
              {runtimeBusy === "upgrade" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Upgrade OpenClaw
            </button>
          </ListCard>

          <DetailCard title="Live Logs" icon={TerminalSquare}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setServiceFilter("openclaw")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${serviceFilter === "openclaw" ? "bg-[rgba(0,212,126,0.12)] text-[var(--accent)]" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}
              >
                openclaw
              </button>
              <button
                type="button"
                onClick={() => setServiceFilter("caddy")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${serviceFilter === "caddy" ? "bg-[rgba(0,212,126,0.12)] text-[var(--accent)]" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}
              >
                caddy
              </button>
              <select
                value={lines}
                onChange={(event) => setLines(Number(event.target.value))}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
              >
                {[100, 150, 250, 500].map((value) => (
                  <option key={value} value={value}>{value} lines</option>
                ))}
              </select>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-[var(--bg-primary)] p-4 font-mono text-xs leading-6 text-[var(--text-secondary)]">
              {logs.data?.logs ?? "No logs returned yet."}
            </pre>
          </DetailCard>
        </div>
      ) : null}

      {openClawSection === "config" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <DetailCard title="Provider & Model" icon={Bot}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Provider</span>
                <input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                />
              </label>
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Model</span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleApplyProvider()}
                disabled={configBusy}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {configBusy ? "Applying…" : "Apply Provider"}
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Current Config Snapshot</p>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                {JSON.stringify(config.data?.config ?? {}, null, 2)}
              </pre>
            </div>
          </DetailCard>

          <ListCard title="Credentials" icon={KeyRound}>
            <label className="block space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Provider API key</span>
              <textarea
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                rows={6}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                placeholder="Paste provider key from the OpenClaw Postman flow"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTestApiKey()}
                disabled={configBusy}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
              >
                Test Key
              </button>
              <button
                type="button"
                onClick={() => void handleApplyApiKey()}
                disabled={configBusy}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                Save Key
              </button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
              {Object.entries(config.data?.apiKeys ?? {}).map(([name, masked]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-[var(--border)]/50 px-3 py-2">
                  <span className="uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{name}</span>
                  <span className="font-mono text-[var(--text-primary)]">{masked ?? "not set"}</span>
                </div>
              ))}
            </div>
          </ListCard>
        </div>
      ) : null}

      {openClawSection === "sessions" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Session Store</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Browse current OpenClaw sessions and run a safe cleanup dry run through the management API.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCleanup()}
              disabled={cleanupBusy}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
            >
              {cleanupBusy ? "Running…" : "Cleanup Dry Run"}
            </button>
          </div>

          {sessionRows.length === 0 ? (
            <EmptyCard
              title="No sessions returned"
              description="OpenClaw did not return stored sessions for the default agent. Try refreshing or switching back to runtime diagnostics."
              icon={Database}
            />
          ) : (
            <DataTable
              columns={sessionColumns}
              data={sessionRows}
              rowKey={(row) => row.key ?? `${row.agentId}-${row.updatedAt}`}
              searchable
              searchPlaceholder="Search sessions"
              density="compact"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}