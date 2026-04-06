"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Loader2,
  MessageSquare,
  Play,
  RefreshCcw,
  Server,
  ShieldCheck,
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

interface DomainConfig {
  ok?: boolean;
  domain?: string;
  ip?: string;
  ssl?: boolean | string;
  selfSignedSSL?: boolean;
  acmeEmail?: string;
  sslIssuer?: string;
  sslIssuerHint?: string;
  sslFallbackUsed?: boolean;
}

interface DiagnosticItem {
  code?: string;
  severity?: string;
  message?: string;
}

interface DiagnosticBlock {
  status?: string;
  summary?: string;
  findings?: DiagnosticItem[];
  issues?: DiagnosticItem[];
  suggestedActions?: string[];
}

interface DomainPreflight {
  ok?: boolean;
  requestedDomain?: string;
  domain?: string;
  domainValid?: boolean;
  serverIP?: string;
  resolvedIPs?: string[];
  dnsResolved?: boolean;
  dnsMatchesServer?: boolean;
  email?: string;
  emailProvided?: boolean;
  emailValid?: boolean;
  acmeEmailCleared?: boolean;
  ready?: boolean;
  liveReady?: boolean;
  issuerOrder?: string[];
  currentDomainMatch?: boolean;
  currentSslIssuer?: string;
  currentSslIssuerHint?: string;
  warnings?: string[];
  acmeDiagnostics?: DiagnosticBlock;
  acmeAssessment?: DiagnosticBlock;
  recentCaddyAcmeLogs?: string[];
  liveChecks?: Record<string, unknown>;
  sslIssuer?: string;
  sslIssuerHint?: string;
  sslFallbackUsed?: boolean;
}

interface BackupResponse {
  ok?: boolean;
  message?: string;
  archive?: string;
  verified?: boolean;
  [key: string]: unknown;
}

interface ProviderRecord {
  active?: boolean;
  configured?: boolean;
  defaultModel?: string;
  models?: string[];
  [key: string]: unknown;
}

interface ProvidersInfo {
  ok?: boolean;
  providers?: Record<string, ProviderRecord>;
}

interface ProviderModelsInfo {
  ok?: boolean;
  models?: Array<string | { id?: string; name?: string; model?: string; label?: string }>;
}

interface ChannelRecord {
  configured?: boolean;
  token?: string | null;
  appToken?: string | null;
  dmPolicy?: string | null;
  [key: string]: unknown;
}

interface ChannelsInfo {
  ok?: boolean;
  channels?: Record<string, ChannelRecord>;
}

interface OpenClawEnvironmentOption {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseUrl: string;
  isDefault: boolean;
  source: "database" | "environment";
}

interface OpenClawEnvironmentsPayload {
  environments: OpenClawEnvironmentOption[];
  defaultEnvironmentId?: string;
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

function toModelOptionLabel(model: string | { id?: string; name?: string; model?: string; label?: string }) {
  if (typeof model === "string") return model;
  return model.label ?? model.name ?? model.id ?? model.model ?? "unknown-model";
}

function boolLabel(value?: boolean) {
  return value ? "Yes" : "No";
}

async function requestOpenClaw<T>(path: string, init?: RequestInit): Promise<T> {
  const environmentId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("hitechclaw-ai-openclaw-environment")
      : null;

  const response = await fetch(`/api/openclaw-management${path}`, {
    headers: {
      ...getAuthHeaders(),
      ...(environmentId ? { "x-openclaw-environment-id": environmentId } : {}),
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
  const {
    openClawSection,
    setOpenClawSection,
    openClawEnvironmentId,
    setOpenClawEnvironmentId,
  } = useTenantFilter();
  const [serviceFilter, setServiceFilter] = useState<"openclaw" | "caddy">("openclaw");
  const [lines, setLines] = useState(150);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("anthropic/claude-sonnet-4-20250514");
  const [apiKey, setApiKey] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [environmentOptions, setEnvironmentOptions] = useState<OpenClawEnvironmentOption[]>([]);
  const [environmentLoading, setEnvironmentLoading] = useState(true);

  const activeEnvironment = useMemo(
    () => environmentOptions.find((environment) => environment.id === openClawEnvironmentId) ?? null,
    [environmentOptions, openClawEnvironmentId],
  );

  const info = useOpenClawFetch<ServiceInfo>("/info", 60000);
  const status = useOpenClawFetch<ServiceStatus>("/status", 20000);
  const system = useOpenClawFetch<SystemInfo>("/system", 45000);
  const upstream = useOpenClawFetch<UpstreamStatus>("/openclaw/status?all=true&usage=true&deep=false&timeoutMs=10000", 45000);
  const config = useOpenClawFetch<ConfigInfo>("/config", 45000, openClawSection === "overview" || openClawSection === "config");
  const sessions = useOpenClawFetch<SessionsInfo>("/sessions?agent=main&allAgents=false", 30000, openClawSection === "overview" || openClawSection === "sessions");
  const logs = useOpenClawFetch<LogsInfo>(`/logs?lines=${lines}&service=${serviceFilter}`, 20000, openClawSection === "runtime");
  const version = useOpenClawFetch<VersionInfo>("/version", 60000, openClawSection === "overview" || openClawSection === "runtime");
  const domain = useOpenClawFetch<DomainConfig>("/domain", 45000, openClawSection === "overview" || openClawSection === "config");
  const domainIssuer = useOpenClawFetch<DomainPreflight>("/domain/issuer", 60000, openClawSection === "config");
  const providers = useOpenClawFetch<ProvidersInfo>("/providers", 45000, openClawSection === "config");
  const providerModels = useOpenClawFetch<ProviderModelsInfo>(`/providers/${encodeURIComponent(provider)}/models`, 45000, openClawSection === "config" && Boolean(provider));
  const channels = useOpenClawFetch<ChannelsInfo>("/channels", 45000, openClawSection === "config");

  const [domainDraft, setDomainDraft] = useState("");
  const [domainEmail, setDomainEmail] = useState("");
  const [domainBusy, setDomainBusy] = useState<string | null>(null);
  const [domainPreflight, setDomainPreflight] = useState<DomainPreflight | null>(null);
  const [backupOutput, setBackupOutput] = useState("/opt/openclaw/backups/openclaw-backup.tgz");
  const [backupVerifyAfterCreate, setBackupVerifyAfterCreate] = useState(true);
  const [backupOnlyConfig, setBackupOnlyConfig] = useState(false);
  const [backupDryRun, setBackupDryRun] = useState(false);
  const [backupVerifyPath, setBackupVerifyPath] = useState("/opt/openclaw/backups/openclaw-backup.tgz");
  const [backupBusy, setBackupBusy] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResponse | null>(null);
  const [selectedChannel, setSelectedChannel] = useState("telegram");
  const [channelToken, setChannelToken] = useState("");
  const [channelAppToken, setChannelAppToken] = useState("");
  const [channelDmPolicy, setChannelDmPolicy] = useState("pairing");
  const [channelBusy, setChannelBusy] = useState<string | null>(null);

  const refreshEnvironments = useCallback(async () => {
    setEnvironmentLoading(true);
    try {
      const response = await fetch("/api/settings/openclaw/environments", {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load OpenClaw environments");
      }
      const payload = (await response.json()) as OpenClawEnvironmentsPayload;
      setEnvironmentOptions(payload.environments ?? []);
      if (!openClawEnvironmentId) {
        setOpenClawEnvironmentId(payload.defaultEnvironmentId ?? payload.environments?.[0]?.id ?? null);
      }
    } catch {
      setEnvironmentOptions([]);
    } finally {
      setEnvironmentLoading(false);
    }
  }, [openClawEnvironmentId, setOpenClawEnvironmentId]);

  useEffect(() => {
    void refreshEnvironments();
  }, [refreshEnvironments]);

  useEffect(() => {
    if (config.data?.provider) {
      setProvider(config.data.provider);
    }
    if (config.data?.model) {
      setModel(config.data.model);
    }
  }, [config.data?.model, config.data?.provider]);

  useEffect(() => {
    if (!domainDraft && domain.data?.domain) {
      setDomainDraft(domain.data.domain);
    }
    if (!domainEmail && domain.data?.acmeEmail) {
      setDomainEmail(domain.data.acmeEmail);
    }
  }, [domain.data?.acmeEmail, domain.data?.domain, domainDraft, domainEmail]);

  useEffect(() => {
    const currentChannel = channels.data?.channels?.[selectedChannel];
    if (currentChannel?.dmPolicy) {
      setChannelDmPolicy(String(currentChannel.dmPolicy));
    }
  }, [channels.data?.channels, selectedChannel]);

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
      domain.refresh(),
      domainIssuer.refresh(),
      providers.refresh(),
      providerModels.refresh(),
      channels.refresh(),
    ]);
  }, [channels, config, domain, domainIssuer, info, logs, providerModels, providers, sessions, status, system, upstream, version]);

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

  const handleDomainPreflight = useCallback(async (live = false) => {
    if (!domainDraft.trim()) {
      toast.error("Enter a domain first");
      return;
    }

    setDomainBusy(live ? "preflight-live" : "preflight");
    try {
      const query = new URLSearchParams({ domain: domainDraft.trim() });
      if (domainEmail.trim()) {
        query.set("email", domainEmail.trim());
      }

      const result = await requestOpenClaw<DomainPreflight>(`/domain/preflight${live ? "/live" : ""}?${query.toString()}`);
      setDomainPreflight(result);
      toast.success(result.ready || result.liveReady ? "Domain preflight passed" : "Domain preflight completed with warnings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Domain preflight failed");
    } finally {
      setDomainBusy(null);
    }
  }, [domainDraft, domainEmail]);

  const handleDomainUpdate = useCallback(async () => {
    if (!domainDraft.trim()) {
      toast.error("Enter a domain first");
      return;
    }

    if (!window.confirm(`Apply domain ${domainDraft.trim()} to the active OpenClaw environment?`)) {
      return;
    }

    setDomainBusy("apply");
    try {
      const result = await requestOpenClaw<DomainPreflight>("/domain", {
        method: "PUT",
        body: JSON.stringify({
          domain: domainDraft.trim(),
          email: domainEmail.trim() || null,
        }),
      });
      setDomainPreflight(result);
      toast.success(`Domain updated to ${result.domain ?? domainDraft.trim()}`);
      await Promise.all([domain.refresh(), domainIssuer.refresh(), info.refresh(), status.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update domain");
    } finally {
      setDomainBusy(null);
    }
  }, [domain, domainDraft, domainEmail, domainIssuer, info, status]);

  const handleCreateBackup = useCallback(async () => {
    setBackupBusy("create");
    try {
      const result = await requestOpenClaw<BackupResponse>("/backup/create", {
        method: "POST",
        body: JSON.stringify({
          output: backupOutput.trim() || undefined,
          verify: backupVerifyAfterCreate,
          onlyConfig: backupOnlyConfig,
          dryRun: backupDryRun,
        }),
      });
      setBackupResult(result);
      if (typeof result.archive === "string" && result.archive) {
        setBackupVerifyPath(result.archive);
      }
      toast.success(result.message ?? "Backup request completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed");
    } finally {
      setBackupBusy(null);
    }
  }, [backupDryRun, backupOnlyConfig, backupOutput, backupVerifyAfterCreate]);

  const handleVerifyBackup = useCallback(async () => {
    if (!backupVerifyPath.trim()) {
      toast.error("Enter an archive path first");
      return;
    }

    setBackupBusy("verify");
    try {
      const result = await requestOpenClaw<BackupResponse>("/backup/verify", {
        method: "POST",
        body: JSON.stringify({ archive: backupVerifyPath.trim() }),
      });
      setBackupResult(result);
      toast.success(result.message ?? "Backup verification completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup verification failed");
    } finally {
      setBackupBusy(null);
    }
  }, [backupVerifyPath]);

  const handleSaveChannel = useCallback(async () => {
    if (!channelToken.trim()) {
      toast.error("Enter the channel token first");
      return;
    }

    if (!window.confirm(`Update ${selectedChannel} channel credentials? OpenClaw may restart.`)) {
      return;
    }

    setChannelBusy("save");
    try {
      const payload: Record<string, unknown> = { token: channelToken.trim() };
      if (selectedChannel === "slack" && channelAppToken.trim()) {
        payload.appToken = channelAppToken.trim();
      }
      if (selectedChannel === "zalo") {
        payload.dmPolicy = channelDmPolicy.trim() || "pairing";
      }

      await requestOpenClaw(`/channels/${encodeURIComponent(selectedChannel)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setChannelToken("");
      setChannelAppToken("");
      toast.success(`${selectedChannel} channel updated`);
      await Promise.all([channels.refresh(), status.refresh(), logs.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update channel");
    } finally {
      setChannelBusy(null);
    }
  }, [channelAppToken, channelDmPolicy, channelToken, channels, logs, selectedChannel, status]);

  const handleDeleteChannel = useCallback(async () => {
    if (!window.confirm(`Remove ${selectedChannel} channel configuration from the active environment?`)) {
      return;
    }

    setChannelBusy("delete");
    try {
      await requestOpenClaw(`/channels/${encodeURIComponent(selectedChannel)}`, { method: "DELETE" });
      toast.success(`${selectedChannel} channel removed`);
      await Promise.all([channels.refresh(), status.refresh(), logs.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove channel");
    } finally {
      setChannelBusy(null);
    }
  }, [channels, logs, selectedChannel, status]);

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

  const providerEntries = useMemo(
    () => Object.entries(providers.data?.providers ?? {}),
    [providers.data?.providers],
  );

  const providerModelOptions = useMemo(
    () => (providerModels.data?.models ?? []).map((entry) => toModelOptionLabel(entry)),
    [providerModels.data?.models],
  );

  const channelEntries = useMemo(
    () => Object.entries(channels.data?.channels ?? {}),
    [channels.data?.channels],
  );

  const errors = [
    info.error,
    status.error,
    system.error,
    upstream.error,
    config.error,
    sessions.error,
    logs.error,
    version.error,
    domain.error,
    domainIssuer.error,
    providers.error,
    providerModels.error,
    channels.error,
  ].filter(Boolean);

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
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Target</span>
          <select
            value={openClawEnvironmentId ?? ""}
            onChange={(event) => setOpenClawEnvironmentId(event.target.value || null)}
            className="bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none"
          >
            {environmentOptions.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </select>
          {environmentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-tertiary)]" /> : null}
        </div>
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

      {activeEnvironment ? (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Managing <span className="font-semibold text-[var(--text-primary)]">{activeEnvironment.name}</span>
          <span className="ml-2 text-[var(--text-tertiary)]">{activeEnvironment.baseUrl}</span>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <DetailCard title="Provider & Model" icon={Bot}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Provider</span>
                  {providerEntries.length > 0 ? (
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    >
                      {providerEntries.map(([name]) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    />
                  )}
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Model</span>
                  {providerModelOptions.length > 0 ? (
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    >
                      {providerModelOptions.map((modelName) => (
                        <option key={modelName} value={modelName}>
                          {modelName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    />
                  )}
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

              {providerEntries.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {providerEntries.slice(0, 8).map(([name, details]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setProvider(name);
                        if (details.defaultModel) {
                          setModel(details.defaultModel);
                        }
                      }}
                      className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3 text-left transition hover:border-[var(--accent)]/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{name}</span>
                        <span className={`text-xs ${details.active ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}>
                          {details.active ? "active" : "available"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Default: {details.defaultModel ?? "—"} · Configured: {boolLabel(details.configured)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

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

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DetailCard title="Domain & SSL" icon={Globe}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Domain</span>
                  <input
                    value={domainDraft}
                    onChange={(event) => setDomainDraft(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="openclaw.example.com"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>ACME Email</span>
                  <input
                    value={domainEmail}
                    onChange={(event) => setDomainEmail(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="admin@example.com"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDomainPreflight(false)}
                  disabled={domainBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {domainBusy === "preflight" ? "Checking…" : "Run Preflight"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDomainPreflight(true)}
                  disabled={domainBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {domainBusy === "preflight-live" ? "Checking…" : "Run Live Check"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDomainUpdate()}
                  disabled={domainBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {domainBusy === "apply" ? "Applying…" : "Apply Domain"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ["Current domain", domain.data?.domain ?? info.data?.domain ?? "—"],
                  ["Server IP", domain.data?.ip ?? info.data?.ip ?? "—"],
                  ["SSL issuer", domainIssuer.data?.sslIssuer ?? domain.data?.sslIssuer ?? "—"],
                  ["Fallback active", boolLabel(domainIssuer.data?.sslFallbackUsed ?? domain.data?.sslFallbackUsed)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{label}</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </div>

              {domainPreflight || domainIssuer.data ? (
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">ACME Diagnostics</p>
                  <p className="mt-2 text-[var(--text-primary)]">
                    {(domainPreflight?.acmeDiagnostics?.summary ?? domainIssuer.data?.acmeDiagnostics?.summary) || "No diagnostics returned."}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Ready</span>
                      <p className="mt-1 text-[var(--text-primary)]">{boolLabel(domainPreflight?.ready ?? domainPreflight?.liveReady)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">DNS Matches Server</span>
                      <p className="mt-1 text-[var(--text-primary)]">{boolLabel(domainPreflight?.dnsMatchesServer)}</p>
                    </div>
                  </div>
                  {(domainPreflight?.warnings?.length ?? 0) > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--warning)]">
                      {domainPreflight?.warnings?.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </DetailCard>

            <DetailCard title="Backup" icon={Archive}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Archive output</span>
                  <input
                    value={backupOutput}
                    onChange={(event) => setBackupOutput(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={backupVerifyAfterCreate} onChange={(event) => setBackupVerifyAfterCreate(event.target.checked)} />
                  Verify after create
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={backupOnlyConfig} onChange={(event) => setBackupOnlyConfig(event.target.checked)} />
                  Config only
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <input type="checkbox" checked={backupDryRun} onChange={(event) => setBackupDryRun(event.target.checked)} />
                  Dry run only
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateBackup()}
                  disabled={backupBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {backupBusy === "create" ? "Creating…" : "Create Backup"}
                </button>
              </div>

              <div className="mt-4 border-t border-[var(--border)]/60 pt-4">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Verify archive</span>
                  <input
                    value={backupVerifyPath}
                    onChange={(event) => setBackupVerifyPath(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleVerifyBackup()}
                  disabled={backupBusy != null}
                  className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {backupBusy === "verify" ? "Verifying…" : "Verify Backup"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Backup Result</p>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(backupResult ?? { message: "No backup request executed yet." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ListCard title="Providers Catalog" icon={ShieldCheck}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {providerEntries.length === 0 ? (
                  <p>No provider inventory returned.</p>
                ) : (
                  providerEntries.map(([name, details]) => (
                    <div key={name} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProvider(name);
                            if (details.defaultModel) {
                              setModel(details.defaultModel);
                            }
                          }}
                          className="text-left font-medium text-[var(--text-primary)] transition hover:text-[var(--accent)]"
                        >
                          {name}
                        </button>
                        <span className={`text-xs ${details.active ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}>
                          {details.active ? "active" : "idle"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs">Default model: {details.defaultModel ?? "—"}</p>
                      <p className="mt-1 text-xs">Configured: {boolLabel(details.configured)}</p>
                      {(details.models?.length ?? 0) > 0 ? (
                        <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{details.models?.slice(0, 4).join(" · ")}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ListCard>

            <DetailCard title="Channels" icon={MessageSquare}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Channel</span>
                  <select
                    value={selectedChannel}
                    onChange={(event) => setSelectedChannel(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {(channelEntries.length > 0 ? channelEntries.map(([name]) => name) : ["telegram", "discord", "slack", "zalo"]).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Current Status</p>
                  <p className="mt-2 text-[var(--text-primary)]">
                    Configured: {boolLabel(channels.data?.channels?.[selectedChannel]?.configured)}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">{channels.data?.channels?.[selectedChannel]?.token ?? "token not set"}</p>
                </div>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Token</span>
                  <textarea
                    value={channelToken}
                    onChange={(event) => setChannelToken(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder={`Paste ${selectedChannel} token`}
                  />
                </label>
                {selectedChannel === "slack" ? (
                  <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                    <span>Slack app token</span>
                    <input
                      value={channelAppToken}
                      onChange={(event) => setChannelAppToken(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    />
                  </label>
                ) : null}
                {selectedChannel === "zalo" ? (
                  <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                    <span>DM Policy</span>
                    <select
                      value={channelDmPolicy}
                      onChange={(event) => setChannelDmPolicy(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    >
                      <option value="pairing">pairing</option>
                      <option value="open">open</option>
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveChannel()}
                  disabled={channelBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {channelBusy === "save" ? "Saving…" : "Save Channel"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteChannel()}
                  disabled={channelBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--danger)]/40 disabled:opacity-50"
                >
                  {channelBusy === "delete" ? "Removing…" : "Remove Channel"}
                </button>
              </div>
            </DetailCard>
          </div>
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