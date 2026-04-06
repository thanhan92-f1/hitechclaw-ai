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
  Network,
  Play,
  Plug,
  Puzzle,
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
  fetchedAt: string | null;
  cacheStatus: string | null;
};

type OpenClawResponseMeta = {
  fetchedAt: string | null;
  cacheStatus: string | null;
  environmentId: string | null;
  targetUrl: string | null;
};

type OpenClawRequestInit = RequestInit & {
  refresh?: boolean;
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
  gatewayPort?: string;
  version?: string;
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

interface ChannelCapabilitiesInfo {
  ok?: boolean;
  channel?: string;
  account?: string;
  capabilities?: Record<string, unknown> | Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ChannelResolveInfo {
  ok?: boolean;
  resolved?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ChannelLogsInfo {
  ok?: boolean;
  channel?: string;
  lines?: number;
  logs?: string;
  entries?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface HookEntry {
  name?: string;
  title?: string;
  description?: string;
  enabled?: boolean;
  eligible?: boolean;
  active?: boolean;
  source?: string;
  status?: string;
  [key: string]: unknown;
}

interface HooksInfo {
  ok?: boolean;
  hooks?: HookEntry[] | Record<string, HookEntry>;
  items?: HookEntry[];
  data?: HookEntry[];
  [key: string]: unknown;
}

interface HookCheckInfo {
  ok?: boolean;
  hooks?: HookEntry[] | Record<string, HookEntry>;
  results?: HookEntry[];
  eligible?: HookEntry[];
  blocked?: HookEntry[];
  [key: string]: unknown;
}

interface HookDetailInfo {
  ok?: boolean;
  hook?: HookEntry;
  [key: string]: unknown;
}

interface SkillEntry {
  skillKey?: string;
  title?: string;
  description?: string;
  source?: string;
  requiredBins?: string[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  content?: string;
  env?: Record<string, unknown>;
  config?: Record<string, unknown>;
  apiKey?: string | null;
  [key: string]: unknown;
}

interface SkillsInfo {
  ok?: boolean;
  agentId?: string;
  count?: number;
  skills?: SkillEntry[];
}

interface SkillsStatusInfo {
  ok?: boolean;
  agentId?: string;
  workspaceSkillsDir?: string;
  managedSkillsDir?: string;
  watch?: boolean;
  watchDebounceMs?: number;
  totalSkills?: number;
  enabledSkills?: number;
  disabledSkills?: string[];
  [key: string]: unknown;
}

interface SkillBinsInfo {
  ok?: boolean;
  agentId?: string;
  bins?: string[];
  count?: number;
}

interface SkillDetailInfo {
  ok?: boolean;
  skill?: SkillEntry;
}

interface SkillSearchInfo {
  ok?: boolean;
  results?: Array<Record<string, unknown>>;
  skills?: SkillEntry[];
  [key: string]: unknown;
}

interface DirectorySelfInfo {
  ok?: boolean;
  self?: Record<string, unknown>;
  account?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DirectoryPeersInfo {
  ok?: boolean;
  peers?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface DirectoryGroupsInfo {
  ok?: boolean;
  groups?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface DirectoryMembersInfo {
  ok?: boolean;
  members?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ModelsCatalogInfo {
  ok?: boolean;
  models?: Array<string | { id?: string; name?: string; model?: string; label?: string }>;
  [key: string]: unknown;
}

interface ModelsStatusInfo {
  ok?: boolean;
  defaultModel?: string;
  imageDefaultModel?: string;
  currentModel?: string;
  activeModel?: string;
  [key: string]: unknown;
}

interface ModelAuthOrderInfo {
  ok?: boolean;
  provider?: string;
  agentId?: string;
  order?: string[];
  [key: string]: unknown;
}

interface ModelAliasesInfo {
  ok?: boolean;
  aliases?: Array<Record<string, unknown>> | Record<string, string | Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ModelFallbacksInfo {
  ok?: boolean;
  models?: string[];
  fallbacks?: string[];
  items?: string[];
  [key: string]: unknown;
}

interface McpServersInfo {
  ok?: boolean;
  servers?: Array<Record<string, unknown> | string> | Record<string, unknown>;
  items?: Array<Record<string, unknown> | string>;
  data?: Array<Record<string, unknown> | string> | Record<string, unknown>;
  [key: string]: unknown;
}

interface McpServerDetailInfo {
  ok?: boolean;
  server?: Record<string, unknown>;
  item?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PluginEntry {
  id?: string;
  name?: string;
  title?: string;
  enabled?: boolean;
  active?: boolean;
  description?: string;
  version?: string;
  [key: string]: unknown;
}

interface PluginsInfo {
  ok?: boolean;
  plugins?: PluginEntry[] | Record<string, PluginEntry>;
  items?: PluginEntry[];
  data?: PluginEntry[];
  [key: string]: unknown;
}

interface PluginInspectInfo {
  ok?: boolean;
  plugins?: PluginEntry[] | Record<string, PluginEntry>;
  plugin?: PluginEntry;
  item?: PluginEntry;
  data?: PluginEntry | PluginEntry[];
  [key: string]: unknown;
}

interface GatewayUsageCostInfo {
  ok?: boolean;
  days?: number;
  totalCost?: number | string;
  cost?: number | string;
  currency?: string;
  [key: string]: unknown;
}

interface GatewayDiscoverInfo {
  ok?: boolean;
  gateways?: Array<Record<string, unknown>>;
  nodes?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface NodesInfo {
  ok?: boolean;
  nodes?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface NodeDetailInfo {
  ok?: boolean;
  node?: Record<string, unknown>;
  item?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SystemEventInfo {
  ok?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface SystemHeartbeatInfo {
  ok?: boolean;
  enabled?: boolean;
  lastHeartbeat?: Record<string, unknown>;
  heartbeat?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SystemPresenceInfo {
  ok?: boolean;
  presence?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface SecretsAuditInfo {
  ok?: boolean;
  summary?: string;
  findings?: Array<Record<string, unknown>>;
  issues?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface SecurityAuditInfo {
  ok?: boolean;
  summary?: string;
  findings?: Array<Record<string, unknown>>;
  issues?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
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

const OPENCLAW_SYNC_ACTIVE_MS = 0;
const OPENCLAW_SYNC_PASSIVE_MS = 0;
const OPENCLAW_ENVIRONMENTS_SYNC_MS = 10 * 60 * 1000;

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
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "medium",
        hour12: false,
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
}

function appendRefreshQuery(path: string) {
  const [pathWithSearch, hash = ""] = path.split("#", 2);
  const [pathname, search = ""] = pathWithSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("refresh", "1");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
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

function parseJsonObjectInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {} as Record<string, unknown>;
  }

  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function normalizeHookEntries(value?: HookEntry[] | Record<string, HookEntry> | null) {
  if (!value) return [] as Array<[string, HookEntry]>;
  if (Array.isArray(value)) {
    return value.map((hook, index) => [String(hook.name ?? hook.title ?? `hook-${index + 1}`), hook] as [string, HookEntry]);
  }
  return Object.entries(value);
}

function normalizeRecordItems(value: unknown, keyName: string) {
  if (!value) return [] as Array<Record<string, unknown>>;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return { [keyName]: key, ...(entry as Record<string, unknown>) };
      }
      return { [keyName]: key, value: entry };
    });
  }
  return [] as Array<Record<string, unknown>>;
}

function normalizeStringItems(value: unknown) {
  if (!value) return [] as string[];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter(Boolean);
  }
  return [] as string[];
}

function normalizeAliasEntries(value: unknown) {
  if (!value) return [] as Array<{ alias: string; model: string }>;
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry, index) => ({
        alias: String(entry.alias ?? entry.name ?? entry.id ?? `alias-${index + 1}`),
        model: String(entry.model ?? entry.target ?? entry.value ?? ""),
      }));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, string | Record<string, unknown>>).map(([alias, entry]) => ({
      alias,
      model:
        typeof entry === "string"
          ? entry
          : String(entry.model ?? entry.target ?? entry.value ?? ""),
    }));
  }
  return [] as Array<{ alias: string; model: string }>;
}

function normalizeLooseItems(value: unknown, keyName: string) {
  if (!value) return [] as Array<Record<string, unknown>>;
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          return entry as Record<string, unknown>;
        }
        return { [keyName]: String(entry ?? `${keyName}-${index + 1}`), value: entry };
      })
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return { [keyName]: key, ...(entry as Record<string, unknown>) };
      }
      return { [keyName]: key, value: entry };
    });
  }
  return [] as Array<Record<string, unknown>>;
}

async function requestOpenClawDetailed<T>(path: string, init?: OpenClawRequestInit): Promise<{ data: T; meta: OpenClawResponseMeta }> {
  const environmentId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("hitechclaw-ai-openclaw-environment")
      : null;

  const requestPath = init?.refresh ? appendRefreshQuery(path) : path;

  const response = await fetch(`/api/openclaw-management${requestPath}`, {
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
    if (message === "High-risk OpenClaw actions are disabled for this environment") {
      throw new Error("This OpenClaw action is currently unavailable for the selected target.");
    }
    throw new Error(message);
  }

  return {
    data: data as T,
    meta: {
      fetchedAt: response.headers.get("x-openclaw-fetched-at"),
      cacheStatus: response.headers.get("x-openclaw-cache"),
      environmentId: response.headers.get("x-openclaw-environment-id"),
      targetUrl: response.headers.get("x-openclaw-target-url"),
    },
  };
}

async function requestOpenClaw<T>(path: string, init?: OpenClawRequestInit): Promise<T> {
  const result = await requestOpenClawDetailed<T>(path, init);
  return result.data;
}

function useOpenClawFetch<T>(path: string, intervalMs = 30000, enabled = true) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: enabled,
    error: null,
    fetchedAt: null,
    cacheStatus: null,
  });

  const refresh = useCallback(async (options?: { refresh?: boolean }) => {
    if (!enabled) return;
    setState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const result = await requestOpenClawDetailed<T>(path, { refresh: options?.refresh });
      setState({
        data: result.data,
        loading: false,
        error: null,
        fetchedAt: result.meta.fetchedAt,
        cacheStatus: result.meta.cacheStatus,
      });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        loading: false,
        error: error instanceof Error ? error.message : "Request failed",
        fetchedAt: current.fetchedAt,
        cacheStatus: current.cacheStatus,
      }));
    }
  }, [enabled, path]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (intervalMs <= 0) {
      return;
    }
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

  const activeEnvironment = useMemo(
    () => environmentOptions.find((environment) => environment.id === openClawEnvironmentId) ?? null,
    [environmentOptions, openClawEnvironmentId],
  );
  const configSections: OpenClawSection[] = [
    "mcp",
    "gateway",
    "provider",
    "credentials",
    "domain",
    "backup",
    "channels",
    "plugins",
    "skills",
    "hooks",
    "directory",
    "models",
    "system",
  ];
  const isConfigSection = configSections.includes(openClawSection);
  const isMcpSection = openClawSection === "mcp";
  const isGatewaySection = openClawSection === "gateway";
  const isProviderSection = openClawSection === "provider";
  const isCredentialsSection = openClawSection === "credentials";
  const isDomainSection = openClawSection === "domain";
  const isBackupSection = openClawSection === "backup";
  const isChannelsSection = openClawSection === "channels";
  const isPluginsSection = openClawSection === "plugins";
  const isSkillsSection = openClawSection === "skills";
  const isHooksSection = openClawSection === "hooks";
  const isDirectorySection = openClawSection === "directory";
  const isModelsSection = openClawSection === "models";
  const isSystemSection = openClawSection === "system";

  const info = useOpenClawFetch<ServiceInfo>("/info", OPENCLAW_SYNC_PASSIVE_MS);
  const status = useOpenClawFetch<ServiceStatus>("/status", OPENCLAW_SYNC_ACTIVE_MS);
  const system = useOpenClawFetch<SystemInfo>("/system", OPENCLAW_SYNC_PASSIVE_MS);
  const upstream = useOpenClawFetch<UpstreamStatus>("/openclaw/status?all=true&usage=true&deep=false&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS);
  const mcpServers = useOpenClawFetch<McpServersInfo>("/mcp", OPENCLAW_SYNC_PASSIVE_MS, isMcpSection);
  const gatewayUsage = useOpenClawFetch<GatewayUsageCostInfo>("/gateway/usage-cost?days=30", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const gatewayDiscover = useOpenClawFetch<GatewayDiscoverInfo>("/gateway/discover?timeoutMs=2000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const nodesStatus = useOpenClawFetch<NodesInfo>("/nodes/status?connected=true&lastConnected=24h&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const nodesList = useOpenClawFetch<NodesInfo>("/nodes?connected=false&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const config = useOpenClawFetch<ConfigInfo>("/config", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isConfigSection);
  const sessions = useOpenClawFetch<SessionsInfo>("/sessions?agent=main&allAgents=false", OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "overview" || openClawSection === "sessions");
  const logs = useOpenClawFetch<LogsInfo>(`/logs?lines=${lines}&service=${serviceFilter}`, OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "runtime");
  const version = useOpenClawFetch<VersionInfo>("/version", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || openClawSection === "runtime");
  const domain = useOpenClawFetch<DomainConfig>("/domain", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isDomainSection);
  const domainIssuer = useOpenClawFetch<DomainPreflight>("/domain/issuer", OPENCLAW_SYNC_PASSIVE_MS, isDomainSection);
  const providers = useOpenClawFetch<ProvidersInfo>("/providers", OPENCLAW_SYNC_PASSIVE_MS, isProviderSection);
  const providerModels = useOpenClawFetch<ProviderModelsInfo>(`/providers/${encodeURIComponent(provider)}/models`, OPENCLAW_SYNC_PASSIVE_MS, isProviderSection && Boolean(provider));
  const channels = useOpenClawFetch<ChannelsInfo>("/channels", OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection);
  const channelsStatus = useOpenClawFetch<ChannelsInfo>("/channels/status?probe=true", OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection);
  const channelsUpstream = useOpenClawFetch<ChannelsInfo>("/channels/upstream?usage=true", OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection);
  const plugins = useOpenClawFetch<PluginsInfo>("/plugins?enabled=false&verbose=false", OPENCLAW_SYNC_PASSIVE_MS, isPluginsSection);
  const pluginsInspect = useOpenClawFetch<PluginInspectInfo>("/plugins/inspect?all=true", OPENCLAW_SYNC_PASSIVE_MS, isPluginsSection);
  const hooks = useOpenClawFetch<HooksInfo>("/hooks?eligible=true&verbose=true", OPENCLAW_SYNC_PASSIVE_MS, isHooksSection);
  const hookCheck = useOpenClawFetch<HookCheckInfo>("/hooks/check", OPENCLAW_SYNC_PASSIVE_MS, isHooksSection);

  const [skillAgentId, setSkillAgentId] = useState("main");
  const skills = useOpenClawFetch<SkillsInfo>(`/skills?agentId=${encodeURIComponent(skillAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection);
  const skillsStatus = useOpenClawFetch<SkillsStatusInfo>(`/skills/status?agentId=${encodeURIComponent(skillAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection);
  const skillBins = useOpenClawFetch<SkillBinsInfo>(`/skills/bins?agentId=${encodeURIComponent(skillAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection);
  const [directoryChannel, setDirectoryChannel] = useState("slack");
  const [directoryPeerQuery, setDirectoryPeerQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(20);
  const [selectedDirectoryGroup, setSelectedDirectoryGroup] = useState("");
  const directorySelf = useOpenClawFetch<DirectorySelfInfo>(`/directory/self?channel=${encodeURIComponent(directoryChannel)}`, OPENCLAW_SYNC_PASSIVE_MS, isDirectorySection);
  const directoryPeers = useOpenClawFetch<DirectoryPeersInfo>(`/directory/peers?channel=${encodeURIComponent(directoryChannel)}&query=${encodeURIComponent(directoryPeerQuery)}&limit=${directoryLimit}`, OPENCLAW_SYNC_PASSIVE_MS, isDirectorySection);
  const directoryGroups = useOpenClawFetch<DirectoryGroupsInfo>(`/directory/groups?channel=${encodeURIComponent(directoryChannel)}&limit=${directoryLimit}`, OPENCLAW_SYNC_PASSIVE_MS, isDirectorySection);
  const directoryMembers = useOpenClawFetch<DirectoryMembersInfo>(`/directory/groups/${encodeURIComponent(selectedDirectoryGroup)}/members?channel=${encodeURIComponent(directoryChannel)}&limit=50`, OPENCLAW_SYNC_PASSIVE_MS, isDirectorySection && Boolean(selectedDirectoryGroup));

  const [modelAgentId, setModelAgentId] = useState("main");
  const [authProvider, setAuthProvider] = useState("anthropic");
  const modelsCatalog = useOpenClawFetch<ModelsCatalogInfo>("/models", OPENCLAW_SYNC_PASSIVE_MS, isModelsSection);
  const modelsStatus = useOpenClawFetch<ModelsStatusInfo>(`/models/status?agentId=${encodeURIComponent(modelAgentId)}&probe=true`, OPENCLAW_SYNC_PASSIVE_MS, isModelsSection);
  const modelAuthOrder = useOpenClawFetch<ModelAuthOrderInfo>(`/models/auth-order?provider=${encodeURIComponent(authProvider)}&agentId=${encodeURIComponent(modelAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isModelsSection && Boolean(authProvider));
  const modelAliases = useOpenClawFetch<ModelAliasesInfo>("/models/aliases", OPENCLAW_SYNC_PASSIVE_MS, isModelsSection);
  const modelFallbacks = useOpenClawFetch<ModelFallbacksInfo>("/models/fallbacks", OPENCLAW_SYNC_PASSIVE_MS, isModelsSection);
  const imageFallbacks = useOpenClawFetch<ModelFallbacksInfo>("/models/image-fallbacks", OPENCLAW_SYNC_PASSIVE_MS, isModelsSection);
  const systemHeartbeatLast = useOpenClawFetch<SystemHeartbeatInfo>("/system/heartbeat/last?timeoutMs=30000", OPENCLAW_SYNC_PASSIVE_MS, isSystemSection);
  const systemPresence = useOpenClawFetch<SystemPresenceInfo>("/system/presence?timeoutMs=30000", OPENCLAW_SYNC_PASSIVE_MS, isSystemSection);

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
  const [channelAccount, setChannelAccount] = useState("default");
  const [channelLogLines, setChannelLogLines] = useState(200);
  const [channelResolveText, setChannelResolveText] = useState("@openclaw_ops\n123456789");
  const [channelResolveKind, setChannelResolveKind] = useState("auto");
  const [channelResolveResult, setChannelResolveResult] = useState<ChannelResolveInfo | null>(null);
  const [selectedMcpServer, setSelectedMcpServer] = useState("");
  const [mcpValueText, setMcpValueText] = useState('{\n  "command": "",\n  "args": []\n}');
  const [mcpBusy, setMcpBusy] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState("");
  const [pluginBusy, setPluginBusy] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState("");
  const [systemEventText, setSystemEventText] = useState("manual-health-check");
  const [systemEventMode, setSystemEventMode] = useState<"now" | "next-heartbeat">("now");
  const [systemBusy, setSystemBusy] = useState<string | null>(null);
  const [secretAllowExec, setSecretAllowExec] = useState(false);
  const [secretBusy, setSecretBusy] = useState<string | null>(null);
  const [secretReloadResult, setSecretReloadResult] = useState<Record<string, unknown> | null>(null);
  const [securityAuditDeep, setSecurityAuditDeep] = useState(false);
  const [selectedHook, setSelectedHook] = useState("");
  const [hookBusy, setHookBusy] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillSearchResults, setSkillSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [skillSearchBusy, setSkillSearchBusy] = useState(false);
  const [skillUpdateBusy, setSkillUpdateBusy] = useState(false);
  const [skillEnabled, setSkillEnabled] = useState(true);
  const [skillApiKey, setSkillApiKey] = useState("");
  const [skillEnvText, setSkillEnvText] = useState("{}");
  const [skillConfigText, setSkillConfigText] = useState("{}");
  const [skillRestart, setSkillRestart] = useState(false);
  const [modelBusy, setModelBusy] = useState<string | null>(null);
  const [defaultModelDraft, setDefaultModelDraft] = useState("");
  const [imageModelDraft, setImageModelDraft] = useState("");
  const [authOrderText, setAuthOrderText] = useState("");
  const [aliasName, setAliasName] = useState("");
  const [aliasModel, setAliasModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [imageFallbackModel, setImageFallbackModel] = useState("");

  const hookDetail = useOpenClawFetch<HookDetailInfo>(`/hooks/${encodeURIComponent(selectedHook)}`, OPENCLAW_SYNC_PASSIVE_MS, isHooksSection && Boolean(selectedHook));
  const skillDetail = useOpenClawFetch<SkillDetailInfo>(`/skills/${encodeURIComponent(selectedSkill)}?agentId=${encodeURIComponent(skillAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection && Boolean(selectedSkill));
  const mcpServerDetail = useOpenClawFetch<McpServerDetailInfo>(`/mcp/${encodeURIComponent(selectedMcpServer)}`, OPENCLAW_SYNC_PASSIVE_MS, isMcpSection && Boolean(selectedMcpServer));
  const nodeDetail = useOpenClawFetch<NodeDetailInfo>(`/nodes/${encodeURIComponent(selectedNode)}?timeoutMs=10000`, OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection && Boolean(selectedNode));
  const channelCapabilities = useOpenClawFetch<ChannelCapabilitiesInfo>(`/channels/capabilities?channel=${encodeURIComponent(selectedChannel)}&account=${encodeURIComponent(channelAccount)}`, OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection && Boolean(selectedChannel));
  const channelLogs = useOpenClawFetch<ChannelLogsInfo>(`/channels/logs?channel=${encodeURIComponent(selectedChannel || "all")}&lines=${channelLogLines}`, OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection);
  const secretsAudit = useOpenClawFetch<SecretsAuditInfo>(`/secrets/audit?check=false&allowExec=${secretAllowExec ? "true" : "false"}&timeoutMs=30000`, OPENCLAW_SYNC_PASSIVE_MS, isCredentialsSection);
  const securityAudit = useOpenClawFetch<SecurityAuditInfo>(`/security/audit?deep=${securityAuditDeep ? "true" : "false"}&timeoutMs=60000`, OPENCLAW_SYNC_PASSIVE_MS, isSystemSection);

  const refreshEnvironments = useCallback(async () => {
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
    }
  }, [openClawEnvironmentId, setOpenClawEnvironmentId]);

  useEffect(() => {
    void refreshEnvironments();
  }, [refreshEnvironments]);

  useEffect(() => {
    if (OPENCLAW_ENVIRONMENTS_SYNC_MS <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshEnvironments();
    }, OPENCLAW_ENVIRONMENTS_SYNC_MS);
    return () => window.clearInterval(timer);
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

  const mcpServerItems = useMemo(
    () => normalizeLooseItems(mcpServers.data?.servers ?? mcpServers.data?.items ?? mcpServers.data?.data ?? null, "name"),
    [mcpServers.data?.data, mcpServers.data?.items, mcpServers.data?.servers],
  );

  useEffect(() => {
    if (!mcpServerItems.some((item) => String(item.name ?? item.id ?? item.server ?? "") === selectedMcpServer)) {
      const firstServer = mcpServerItems[0];
      setSelectedMcpServer(String(firstServer?.name ?? firstServer?.id ?? firstServer?.server ?? ""));
    }
  }, [mcpServerItems, selectedMcpServer]);

  useEffect(() => {
    const server = mcpServerDetail.data?.server ?? mcpServerDetail.data?.item ?? mcpServerDetail.data?.data;
    if (server && selectedMcpServer) {
      setMcpValueText(JSON.stringify(server, null, 2));
    }
  }, [mcpServerDetail.data?.data, mcpServerDetail.data?.item, mcpServerDetail.data?.server, selectedMcpServer]);

  const pluginItems = useMemo(
    () => normalizeLooseItems(plugins.data?.plugins ?? plugins.data?.items ?? plugins.data?.data ?? null, "id"),
    [plugins.data?.data, plugins.data?.items, plugins.data?.plugins],
  );

  useEffect(() => {
    if (!pluginItems.some((item) => String(item.id ?? item.name ?? item.title ?? "") === selectedPlugin)) {
      const firstPlugin = pluginItems[0];
      setSelectedPlugin(String(firstPlugin?.id ?? firstPlugin?.name ?? firstPlugin?.title ?? ""));
    }
  }, [pluginItems, selectedPlugin]);

  const gatewayDiscoverItems = useMemo(
    () => normalizeRecordItems(gatewayDiscover.data?.gateways ?? gatewayDiscover.data?.nodes ?? gatewayDiscover.data?.results ?? gatewayDiscover.data?.items ?? null, "gatewayId"),
    [gatewayDiscover.data?.gateways, gatewayDiscover.data?.items, gatewayDiscover.data?.nodes, gatewayDiscover.data?.results],
  );

  const nodesStatusItems = useMemo(
    () => normalizeRecordItems(nodesStatus.data?.nodes ?? nodesStatus.data?.results ?? nodesStatus.data?.items ?? null, "nodeId"),
    [nodesStatus.data?.items, nodesStatus.data?.nodes, nodesStatus.data?.results],
  );

  const nodesListItems = useMemo(
    () => normalizeRecordItems(nodesList.data?.nodes ?? nodesList.data?.results ?? nodesList.data?.items ?? null, "nodeId"),
    [nodesList.data?.items, nodesList.data?.nodes, nodesList.data?.results],
  );

  useEffect(() => {
    const allNodes = [...nodesStatusItems, ...nodesListItems];
    if (!allNodes.some((item) => String(item.nodeId ?? item.id ?? item.name ?? "") === selectedNode)) {
      const firstNode = allNodes[0];
      setSelectedNode(String(firstNode?.nodeId ?? firstNode?.id ?? firstNode?.name ?? ""));
    }
  }, [nodesListItems, nodesStatusItems, selectedNode]);

  const hookEntries = useMemo(
    () => normalizeHookEntries(hooks.data?.hooks ?? hooks.data?.items ?? hooks.data?.data ?? null),
    [hooks.data?.data, hooks.data?.hooks, hooks.data?.items],
  );

  useEffect(() => {
    if (!hookEntries.some(([name]) => name === selectedHook)) {
      setSelectedHook(hookEntries[0]?.[0] ?? "");
    }
  }, [hookEntries, selectedHook]);

  useEffect(() => {
    const skillEntries = skills.data?.skills ?? [];
    if (!skillEntries.some((entry) => entry.skillKey === selectedSkill)) {
      setSelectedSkill(skillEntries[0]?.skillKey ?? "");
    }
  }, [selectedSkill, skills.data?.skills]);

  const directoryGroupItems = useMemo(
    () => normalizeRecordItems(directoryGroups.data?.groups ?? directoryGroups.data?.results ?? directoryGroups.data?.items ?? null, "groupId"),
    [directoryGroups.data?.groups, directoryGroups.data?.items, directoryGroups.data?.results],
  );

  useEffect(() => {
    if (!directoryGroupItems.some((group) => String(group.groupId ?? group.id ?? group.name ?? "") === selectedDirectoryGroup)) {
      const firstGroup = directoryGroupItems[0];
      setSelectedDirectoryGroup(String(firstGroup?.groupId ?? firstGroup?.id ?? firstGroup?.name ?? ""));
    }
  }, [directoryGroupItems, selectedDirectoryGroup]);

  useEffect(() => {
    if (!defaultModelDraft) {
      setDefaultModelDraft(
        modelsStatus.data?.defaultModel ??
          modelsStatus.data?.currentModel ??
          modelsStatus.data?.activeModel ??
          config.data?.model ??
          model,
      );
    }
  }, [config.data?.model, defaultModelDraft, model, modelsStatus.data?.activeModel, modelsStatus.data?.currentModel, modelsStatus.data?.defaultModel]);

  useEffect(() => {
    if (!imageModelDraft) {
      setImageModelDraft(modelsStatus.data?.imageDefaultModel ?? "");
    }
  }, [imageModelDraft, modelsStatus.data?.imageDefaultModel]);

  useEffect(() => {
    if (provider && authProvider === "anthropic") {
      setAuthProvider(provider);
    }
  }, [provider, authProvider]);

  useEffect(() => {
    setAuthOrderText((modelAuthOrder.data?.order ?? []).join("\n"));
  }, [modelAuthOrder.data?.order]);

  useEffect(() => {
    const listSkill = (skills.data?.skills ?? []).find((entry) => entry.skillKey === selectedSkill);
    const detailSkill = skillDetail.data?.skill;
    const sourceSkill = detailSkill?.skillKey === selectedSkill ? detailSkill : listSkill;
    if (!sourceSkill || !selectedSkill) return;

    setSkillEnabled(sourceSkill.enabled ?? true);
    setSkillApiKey(typeof sourceSkill.apiKey === "string" ? sourceSkill.apiKey : "");
    setSkillEnvText(JSON.stringify(sourceSkill.env ?? {}, null, 2));
    setSkillConfigText(JSON.stringify(sourceSkill.config ?? sourceSkill.metadata ?? {}, null, 2));
  }, [selectedSkill, skillDetail.data?.skill, skills.data?.skills]);

  const refreshAll = useCallback(async (forceFresh = false) => {
    await Promise.all([
      info.refresh({ refresh: forceFresh }),
      status.refresh({ refresh: forceFresh }),
      system.refresh({ refresh: forceFresh }),
      upstream.refresh({ refresh: forceFresh }),
      mcpServers.refresh({ refresh: forceFresh }),
      mcpServerDetail.refresh({ refresh: forceFresh }),
      gatewayUsage.refresh({ refresh: forceFresh }),
      gatewayDiscover.refresh({ refresh: forceFresh }),
      nodesStatus.refresh({ refresh: forceFresh }),
      nodesList.refresh({ refresh: forceFresh }),
      nodeDetail.refresh({ refresh: forceFresh }),
      config.refresh({ refresh: forceFresh }),
      sessions.refresh({ refresh: forceFresh }),
      logs.refresh({ refresh: forceFresh }),
      version.refresh({ refresh: forceFresh }),
      domain.refresh({ refresh: forceFresh }),
      domainIssuer.refresh({ refresh: forceFresh }),
      providers.refresh({ refresh: forceFresh }),
      providerModels.refresh({ refresh: forceFresh }),
      channels.refresh({ refresh: forceFresh }),
      channelsStatus.refresh({ refresh: forceFresh }),
      channelsUpstream.refresh({ refresh: forceFresh }),
      channelCapabilities.refresh({ refresh: forceFresh }),
      channelLogs.refresh({ refresh: forceFresh }),
      plugins.refresh({ refresh: forceFresh }),
      pluginsInspect.refresh({ refresh: forceFresh }),
      hooks.refresh({ refresh: forceFresh }),
      hookCheck.refresh({ refresh: forceFresh }),
      hookDetail.refresh({ refresh: forceFresh }),
      skills.refresh({ refresh: forceFresh }),
      skillsStatus.refresh({ refresh: forceFresh }),
      skillBins.refresh({ refresh: forceFresh }),
      skillDetail.refresh({ refresh: forceFresh }),
      directorySelf.refresh({ refresh: forceFresh }),
      directoryPeers.refresh({ refresh: forceFresh }),
      directoryGroups.refresh({ refresh: forceFresh }),
      directoryMembers.refresh({ refresh: forceFresh }),
      modelsCatalog.refresh({ refresh: forceFresh }),
      modelsStatus.refresh({ refresh: forceFresh }),
      modelAuthOrder.refresh({ refresh: forceFresh }),
      modelAliases.refresh({ refresh: forceFresh }),
      modelFallbacks.refresh({ refresh: forceFresh }),
      imageFallbacks.refresh({ refresh: forceFresh }),
      systemHeartbeatLast.refresh({ refresh: forceFresh }),
      systemPresence.refresh({ refresh: forceFresh }),
      secretsAudit.refresh({ refresh: forceFresh }),
      securityAudit.refresh({ refresh: forceFresh }),
    ]);
  }, [channelCapabilities, channelLogs, channels, channelsStatus, channelsUpstream, config, directoryGroups, directoryMembers, directoryPeers, directorySelf, domain, domainIssuer, gatewayDiscover, gatewayUsage, hookCheck, hookDetail, hooks, imageFallbacks, info, logs, mcpServerDetail, mcpServers, modelAliases, modelAuthOrder, modelFallbacks, modelsCatalog, modelsStatus, nodeDetail, nodesList, nodesStatus, plugins, pluginsInspect, providerModels, providers, secretsAudit, securityAudit, sessions, skillBins, skillDetail, skills, skillsStatus, status, system, systemHeartbeatLast, systemPresence, upstream, version]);

  const lastUpdatedAt = useMemo(() => {
    const timestamps = [
      info.fetchedAt,
      status.fetchedAt,
      system.fetchedAt,
      upstream.fetchedAt,
      mcpServers.fetchedAt,
      mcpServerDetail.fetchedAt,
      gatewayUsage.fetchedAt,
      gatewayDiscover.fetchedAt,
      nodesStatus.fetchedAt,
      nodesList.fetchedAt,
      nodeDetail.fetchedAt,
      config.fetchedAt,
      sessions.fetchedAt,
      logs.fetchedAt,
      version.fetchedAt,
      domain.fetchedAt,
      domainIssuer.fetchedAt,
      providers.fetchedAt,
      providerModels.fetchedAt,
      channels.fetchedAt,
      channelsStatus.fetchedAt,
      channelsUpstream.fetchedAt,
      channelCapabilities.fetchedAt,
      channelLogs.fetchedAt,
      plugins.fetchedAt,
      pluginsInspect.fetchedAt,
      hooks.fetchedAt,
      hookCheck.fetchedAt,
      hookDetail.fetchedAt,
      skills.fetchedAt,
      skillsStatus.fetchedAt,
      skillBins.fetchedAt,
      skillDetail.fetchedAt,
      directorySelf.fetchedAt,
      directoryPeers.fetchedAt,
      directoryGroups.fetchedAt,
      directoryMembers.fetchedAt,
      modelsCatalog.fetchedAt,
      modelsStatus.fetchedAt,
      modelAuthOrder.fetchedAt,
      modelAliases.fetchedAt,
      modelFallbacks.fetchedAt,
      imageFallbacks.fetchedAt,
      systemHeartbeatLast.fetchedAt,
      systemPresence.fetchedAt,
      secretsAudit.fetchedAt,
      securityAudit.fetchedAt,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps)).toISOString();
  }, [
    channels.fetchedAt,
    channelsStatus.fetchedAt,
    channelsUpstream.fetchedAt,
    channelCapabilities.fetchedAt,
    channelLogs.fetchedAt,
    config.fetchedAt,
    directoryGroups.fetchedAt,
    directoryMembers.fetchedAt,
    directoryPeers.fetchedAt,
    directorySelf.fetchedAt,
    domain.fetchedAt,
    domainIssuer.fetchedAt,
    gatewayDiscover.fetchedAt,
    gatewayUsage.fetchedAt,
    hookCheck.fetchedAt,
    hookDetail.fetchedAt,
    hooks.fetchedAt,
    imageFallbacks.fetchedAt,
    info.fetchedAt,
    logs.fetchedAt,
    mcpServerDetail.fetchedAt,
    mcpServers.fetchedAt,
    modelAliases.fetchedAt,
    modelAuthOrder.fetchedAt,
    modelFallbacks.fetchedAt,
    modelsCatalog.fetchedAt,
    modelsStatus.fetchedAt,
    nodeDetail.fetchedAt,
    nodesList.fetchedAt,
    nodesStatus.fetchedAt,
    plugins.fetchedAt,
    pluginsInspect.fetchedAt,
    providerModels.fetchedAt,
    providers.fetchedAt,
    sessions.fetchedAt,
    skillBins.fetchedAt,
    skillDetail.fetchedAt,
    skills.fetchedAt,
    skillsStatus.fetchedAt,
    status.fetchedAt,
    system.fetchedAt,
    systemHeartbeatLast.fetchedAt,
    systemPresence.fetchedAt,
    secretsAudit.fetchedAt,
    securityAudit.fetchedAt,
    upstream.fetchedAt,
    version.fetchedAt,
  ]);

  const cacheSummary = useMemo(() => {
    const statuses = [
      info.cacheStatus,
      status.cacheStatus,
      system.cacheStatus,
      upstream.cacheStatus,
      mcpServers.cacheStatus,
      mcpServerDetail.cacheStatus,
      gatewayUsage.cacheStatus,
      gatewayDiscover.cacheStatus,
      nodesStatus.cacheStatus,
      nodesList.cacheStatus,
      nodeDetail.cacheStatus,
      config.cacheStatus,
      sessions.cacheStatus,
      logs.cacheStatus,
      version.cacheStatus,
      domain.cacheStatus,
      domainIssuer.cacheStatus,
      providers.cacheStatus,
      providerModels.cacheStatus,
      channels.cacheStatus,
      channelsStatus.cacheStatus,
      channelsUpstream.cacheStatus,
      channelCapabilities.cacheStatus,
      channelLogs.cacheStatus,
      plugins.cacheStatus,
      pluginsInspect.cacheStatus,
      hooks.cacheStatus,
      hookCheck.cacheStatus,
      hookDetail.cacheStatus,
      skills.cacheStatus,
      skillsStatus.cacheStatus,
      skillBins.cacheStatus,
      skillDetail.cacheStatus,
      directorySelf.cacheStatus,
      directoryPeers.cacheStatus,
      directoryGroups.cacheStatus,
      directoryMembers.cacheStatus,
      modelsCatalog.cacheStatus,
      modelsStatus.cacheStatus,
      modelAuthOrder.cacheStatus,
      modelAliases.cacheStatus,
      modelFallbacks.cacheStatus,
      imageFallbacks.cacheStatus,
      systemHeartbeatLast.cacheStatus,
      systemPresence.cacheStatus,
      secretsAudit.cacheStatus,
      securityAudit.cacheStatus,
    ].filter((value): value is string => Boolean(value));

    if (statuses.includes("stale-if-error")) return "Showing cached fallback data";
    if (statuses.includes("miss")) return "Fresh OpenClaw data loaded";
    if (statuses.includes("hit") || statuses.includes("stale")) return "Serving cached OpenClaw data";
    return "Refresh manually when you need the latest OpenClaw state";
  }, [
    channels.cacheStatus,
    channelsStatus.cacheStatus,
    channelsUpstream.cacheStatus,
    channelCapabilities.cacheStatus,
    channelLogs.cacheStatus,
    config.cacheStatus,
    directoryGroups.cacheStatus,
    directoryMembers.cacheStatus,
    directoryPeers.cacheStatus,
    directorySelf.cacheStatus,
    domain.cacheStatus,
    domainIssuer.cacheStatus,
    gatewayDiscover.cacheStatus,
    gatewayUsage.cacheStatus,
    hookCheck.cacheStatus,
    hookDetail.cacheStatus,
    hooks.cacheStatus,
    imageFallbacks.cacheStatus,
    info.cacheStatus,
    logs.cacheStatus,
    mcpServerDetail.cacheStatus,
    mcpServers.cacheStatus,
    modelAliases.cacheStatus,
    modelAuthOrder.cacheStatus,
    modelFallbacks.cacheStatus,
    modelsCatalog.cacheStatus,
    modelsStatus.cacheStatus,
    nodeDetail.cacheStatus,
    nodesList.cacheStatus,
    nodesStatus.cacheStatus,
    plugins.cacheStatus,
    pluginsInspect.cacheStatus,
    providerModels.cacheStatus,
    providers.cacheStatus,
    sessions.cacheStatus,
    skillBins.cacheStatus,
    skillDetail.cacheStatus,
    skills.cacheStatus,
    skillsStatus.cacheStatus,
    status.cacheStatus,
    system.cacheStatus,
    systemHeartbeatLast.cacheStatus,
    systemPresence.cacheStatus,
    secretsAudit.cacheStatus,
    securityAudit.cacheStatus,
    upstream.cacheStatus,
    version.cacheStatus,
  ]);

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

  const handleResolveChannelTargets = useCallback(async () => {
    const entries = channelResolveText
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!selectedChannel.trim() || entries.length === 0) {
      toast.error("Enter at least one channel target to resolve");
      return;
    }

    setChannelBusy("resolve");
    try {
      const result = await requestOpenClaw<ChannelResolveInfo>("/channels/resolve", {
        method: "POST",
        body: JSON.stringify({ channel: selectedChannel.trim(), entries, kind: channelResolveKind }),
      });
      setChannelResolveResult(result);
      toast.success(`Resolved ${entries.length} channel target${entries.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve channel targets");
    } finally {
      setChannelBusy(null);
    }
  }, [channelResolveKind, channelResolveText, selectedChannel]);

  const handleSaveMcpServer = useCallback(async () => {
    if (!selectedMcpServer.trim()) {
      toast.error("Enter an MCP server name first");
      return;
    }

    setMcpBusy("save");
    try {
      const value = parseJsonObjectInput(mcpValueText, "MCP server value");
      await requestOpenClaw(`/mcp/${encodeURIComponent(selectedMcpServer.trim())}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      toast.success(`MCP server ${selectedMcpServer.trim()} saved`);
      await Promise.all([mcpServers.refresh(), mcpServerDetail.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save MCP server");
    } finally {
      setMcpBusy(null);
    }
  }, [mcpServerDetail, mcpServers, mcpValueText, selectedMcpServer]);

  const handleDeleteMcpServer = useCallback(async () => {
    if (!selectedMcpServer.trim()) {
      toast.error("Choose an MCP server first");
      return;
    }

    setMcpBusy("delete");
    try {
      await requestOpenClaw(`/mcp/${encodeURIComponent(selectedMcpServer.trim())}`, { method: "DELETE" });
      toast.success(`MCP server ${selectedMcpServer.trim()} removed`);
      await Promise.all([mcpServers.refresh(), mcpServerDetail.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove MCP server");
    } finally {
      setMcpBusy(null);
    }
  }, [mcpServerDetail, mcpServers, selectedMcpServer]);

  const handleTogglePlugin = useCallback(async (enabled: boolean) => {
    if (!selectedPlugin.trim()) {
      toast.error("Choose a plugin first");
      return;
    }

    setPluginBusy(enabled ? "enable" : "disable");
    try {
      await requestOpenClaw(`/plugins/${encodeURIComponent(selectedPlugin.trim())}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
      });
      toast.success(`Plugin ${selectedPlugin.trim()} ${enabled ? "enabled" : "disabled"}`);
      await Promise.all([plugins.refresh(), pluginsInspect.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${enabled ? "enable" : "disable"} plugin`);
    } finally {
      setPluginBusy(null);
    }
  }, [plugins, pluginsInspect, selectedPlugin]);

  const handlePostSystemEvent = useCallback(async () => {
    if (!systemEventText.trim()) {
      toast.error("Enter a system event first");
      return;
    }

    setSystemBusy("event");
    try {
      const result = await requestOpenClaw<SystemEventInfo>("/system/events", {
        method: "POST",
        body: JSON.stringify({ text: systemEventText.trim(), mode: systemEventMode, timeoutMs: 30000 }),
      });
      toast.success(result.message ?? "System event posted");
      await Promise.all([systemHeartbeatLast.refresh(), systemPresence.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post system event");
    } finally {
      setSystemBusy(null);
    }
  }, [systemEventMode, systemEventText, systemHeartbeatLast, systemPresence]);

  const handleToggleHeartbeat = useCallback(async (enabled: boolean) => {
    setSystemBusy(enabled ? "heartbeat-enable" : "heartbeat-disable");
    try {
      await requestOpenClaw(`/system/heartbeat/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({ timeoutMs: 30000 }),
      });
      toast.success(`Heartbeat ${enabled ? "enabled" : "disabled"}`);
      await Promise.all([systemHeartbeatLast.refresh(), systemPresence.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${enabled ? "enable" : "disable"} heartbeat`);
    } finally {
      setSystemBusy(null);
    }
  }, [systemHeartbeatLast, systemPresence]);

  const handleReloadSecrets = useCallback(async () => {
    setSecretBusy("reload");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>("/secrets/reload", {
        method: "POST",
        body: JSON.stringify({ timeoutMs: 30000 }),
      });
      setSecretReloadResult(result);
      toast.success(String(result.message ?? "Secrets reloaded"));
      await secretsAudit.refresh({ refresh: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reload secrets");
    } finally {
      setSecretBusy(null);
    }
  }, [secretsAudit]);

  const handleRefreshSecurityAudit = useCallback(async () => {
    setSystemBusy("security-audit");
    try {
      await securityAudit.refresh({ refresh: true });
      toast.success("Security audit refreshed");
    } catch {
      toast.error("Failed to refresh security audit");
    } finally {
      setSystemBusy(null);
    }
  }, [securityAudit]);

  const handleToggleHook = useCallback(async (enabled: boolean) => {
    if (!selectedHook) {
      toast.error("Choose a hook first");
      return;
    }

    setHookBusy(enabled ? "enable" : "disable");
    try {
      await requestOpenClaw(`/hooks/${encodeURIComponent(selectedHook)}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
      });
      toast.success(`Hook ${selectedHook} ${enabled ? "enabled" : "disabled"}`);
      await Promise.all([hooks.refresh(), hookCheck.refresh(), hookDetail.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${enabled ? "enable" : "disable"} hook`);
    } finally {
      setHookBusy(null);
    }
  }, [hookCheck, hookDetail, hooks, selectedHook]);

  const handleSkillSearch = useCallback(async () => {
    setSkillSearchBusy(true);
    try {
      const query = new URLSearchParams();
      if (skillSearchQuery.trim()) {
        query.set("query", skillSearchQuery.trim());
      }
      query.set("limit", "10");

      const result = await requestOpenClaw<SkillSearchInfo>(`/skills/search?${query.toString()}`);
      const nextResults = result.results ?? result.skills ?? [];
      setSkillSearchResults(nextResults as Array<Record<string, unknown>>);
      toast.success(`Found ${nextResults.length} skill search results`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Skill search failed");
    } finally {
      setSkillSearchBusy(false);
    }
  }, [skillSearchQuery]);

  const handleUpdateSkill = useCallback(async () => {
    if (!selectedSkill) {
      toast.error("Choose a skill first");
      return;
    }

    setSkillUpdateBusy(true);
    try {
      const env = parseJsonObjectInput(skillEnvText, "Skill env");
      const configValues = parseJsonObjectInput(skillConfigText, "Skill config");

      await requestOpenClaw("/skills/update", {
        method: "POST",
        body: JSON.stringify({
          skillKey: selectedSkill,
          enabled: skillEnabled,
          apiKey: skillApiKey.trim(),
          env,
          config: configValues,
          restart: skillRestart,
        }),
      });

      toast.success(`Skill ${selectedSkill} updated`);
      await Promise.all([skills.refresh(), skillsStatus.refresh(), skillBins.refresh(), skillDetail.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Skill update failed");
    } finally {
      setSkillUpdateBusy(false);
    }
  }, [selectedSkill, skillApiKey, skillBins, skillConfigText, skillDetail, skillEnabled, skillEnvText, skillRestart, skills, skillsStatus]);

  const handleSetModel = useCallback(async (endpoint: "/models/default" | "/models/image-default", value: string, action: string) => {
    if (!value.trim()) {
      toast.error("Enter a model first");
      return;
    }

    setModelBusy(action);
    try {
      await requestOpenClaw(endpoint, {
        method: "PUT",
        body: JSON.stringify({ model: value.trim() }),
      });
      toast.success(`${action === "default" ? "Default" : "Image"} model updated`);
      await Promise.all([modelsCatalog.refresh(), modelsStatus.refresh(), config.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Model update failed");
    } finally {
      setModelBusy(null);
    }
  }, [config, modelsCatalog, modelsStatus]);

  const handleSaveAuthOrder = useCallback(async () => {
    const order = authOrderText
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!authProvider.trim()) {
      toast.error("Enter a provider first");
      return;
    }

    if (order.length === 0) {
      toast.error("Enter at least one auth order entry");
      return;
    }

    setModelBusy("auth-order");
    try {
      await requestOpenClaw("/models/auth-order", {
        method: "PUT",
        body: JSON.stringify({
          provider: authProvider.trim(),
          agentId: modelAgentId.trim() || "main",
          order,
        }),
      });
      toast.success("Model auth order updated");
      await modelAuthOrder.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save auth order");
    } finally {
      setModelBusy(null);
    }
  }, [authOrderText, authProvider, modelAgentId, modelAuthOrder]);

  const handleClearAuthOrder = useCallback(async () => {
    if (!authProvider.trim()) {
      toast.error("Enter a provider first");
      return;
    }

    setModelBusy("auth-order-clear");
    try {
      await requestOpenClaw("/models/auth-order", {
        method: "DELETE",
        body: JSON.stringify({
          provider: authProvider.trim(),
          agentId: modelAgentId.trim() || "main",
        }),
      });
      toast.success("Model auth order cleared");
      setAuthOrderText("");
      await modelAuthOrder.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear auth order");
    } finally {
      setModelBusy(null);
    }
  }, [authProvider, modelAgentId, modelAuthOrder]);

  const handleSaveAlias = useCallback(async () => {
    if (!aliasName.trim() || !aliasModel.trim()) {
      toast.error("Enter both alias and target model");
      return;
    }

    setModelBusy("alias-save");
    try {
      await requestOpenClaw("/models/aliases", {
        method: "POST",
        body: JSON.stringify({ alias: aliasName.trim(), model: aliasModel.trim() }),
      });
      toast.success(`Alias ${aliasName.trim()} saved`);
      setAliasName("");
      setAliasModel("");
      await modelAliases.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save alias");
    } finally {
      setModelBusy(null);
    }
  }, [aliasModel, aliasName, modelAliases]);

  const handleDeleteAlias = useCallback(async (alias: string) => {
    setModelBusy(`alias-delete-${alias}`);
    try {
      await requestOpenClaw(`/models/aliases/${encodeURIComponent(alias)}`, { method: "DELETE" });
      toast.success(`Alias ${alias} removed`);
      await modelAliases.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove alias");
    } finally {
      setModelBusy(null);
    }
  }, [modelAliases]);

  const handleAddFallback = useCallback(async (kind: "fallbacks" | "image-fallbacks", value: string) => {
    if (!value.trim()) {
      toast.error("Enter a fallback model first");
      return;
    }

    setModelBusy(`add-${kind}`);
    try {
      await requestOpenClaw(`/models/${kind}`, {
        method: "POST",
        body: JSON.stringify({ model: value.trim() }),
      });
      toast.success(`${kind === "fallbacks" ? "Fallback" : "Image fallback"} added`);
      if (kind === "fallbacks") {
        setFallbackModel("");
        await modelFallbacks.refresh();
      } else {
        setImageFallbackModel("");
        await imageFallbacks.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add fallback");
    } finally {
      setModelBusy(null);
    }
  }, [imageFallbacks, modelFallbacks]);

  const handleRemoveFallback = useCallback(async (kind: "fallbacks" | "image-fallbacks", value?: string) => {
    setModelBusy(`remove-${kind}`);
    try {
      await requestOpenClaw(
        value ? `/models/${kind}/${encodeURIComponent(value)}` : `/models/${kind}`,
        { method: "DELETE" },
      );
      toast.success(`${kind === "fallbacks" ? "Fallback" : "Image fallback"} removed`);
      if (kind === "fallbacks") {
        await modelFallbacks.refresh();
      } else {
        await imageFallbacks.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove fallback");
    } finally {
      setModelBusy(null);
    }
  }, [imageFallbacks, modelFallbacks]);

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

  const hookCheckEntries = useMemo(
    () => normalizeHookEntries(hookCheck.data?.hooks ?? hookCheck.data?.results ?? null),
    [hookCheck.data?.hooks, hookCheck.data?.results],
  );

  const selectedHookData = useMemo(() => {
    const listMatch = hookEntries.find(([name]) => name === selectedHook)?.[1];
    return hookDetail.data?.hook ?? listMatch ?? null;
  }, [hookDetail.data?.hook, hookEntries, selectedHook]);

  const selectedSkillData = useMemo(() => {
    const listMatch = (skills.data?.skills ?? []).find((entry) => entry.skillKey === selectedSkill);
    return skillDetail.data?.skill ?? listMatch ?? null;
  }, [selectedSkill, skillDetail.data?.skill, skills.data?.skills]);

  const directorySelfData = useMemo(
    () => directorySelf.data?.self ?? directorySelf.data?.account ?? directorySelf.data?.profile ?? null,
    [directorySelf.data?.account, directorySelf.data?.profile, directorySelf.data?.self],
  );

  const directoryPeerItems = useMemo(
    () => normalizeRecordItems(directoryPeers.data?.peers ?? directoryPeers.data?.results ?? directoryPeers.data?.items ?? null, "peerId"),
    [directoryPeers.data?.items, directoryPeers.data?.peers, directoryPeers.data?.results],
  );

  const directoryMemberItems = useMemo(
    () => normalizeRecordItems(directoryMembers.data?.members ?? directoryMembers.data?.results ?? directoryMembers.data?.items ?? null, "memberId"),
    [directoryMembers.data?.items, directoryMembers.data?.members, directoryMembers.data?.results],
  );

  const modelCatalogOptions = useMemo(
    () => (modelsCatalog.data?.models ?? []).map((entry) => toModelOptionLabel(entry)),
    [modelsCatalog.data?.models],
  );

  const aliasEntries = useMemo(
    () => normalizeAliasEntries(modelAliases.data?.aliases ?? modelAliases.data?.items ?? null),
    [modelAliases.data?.aliases, modelAliases.data?.items],
  );

  const selectedPluginData = useMemo(() => {
    const inspected = pluginsInspect.data?.plugin ?? pluginsInspect.data?.item;
    if (inspected && String(inspected.id ?? inspected.name ?? inspected.title ?? "") === selectedPlugin) {
      return inspected;
    }

    const inspectItems = normalizeLooseItems(
      pluginsInspect.data?.plugins ?? pluginsInspect.data?.data ?? null,
      "id",
    );
    const inspectMatch = inspectItems.find((item) => String(item.id ?? item.name ?? item.title ?? "") === selectedPlugin);
    if (inspectMatch) {
      return inspectMatch;
    }

    return pluginItems.find((item) => String(item.id ?? item.name ?? item.title ?? "") === selectedPlugin) ?? null;
  }, [pluginItems, pluginsInspect.data?.data, pluginsInspect.data?.item, pluginsInspect.data?.plugin, pluginsInspect.data?.plugins, selectedPlugin]);

  const selectedMcpServerData = useMemo(
    () => mcpServerDetail.data?.server ?? mcpServerDetail.data?.item ?? mcpServerDetail.data?.data ?? null,
    [mcpServerDetail.data?.data, mcpServerDetail.data?.item, mcpServerDetail.data?.server],
  );

  const selectedNodeData = useMemo(
    () => nodeDetail.data?.node ?? nodeDetail.data?.item ?? nodeDetail.data?.data ?? null,
    [nodeDetail.data?.data, nodeDetail.data?.item, nodeDetail.data?.node],
  );

  const systemPresenceItems = useMemo(
    () => normalizeRecordItems(systemPresence.data?.presence ?? systemPresence.data?.entries ?? systemPresence.data?.items ?? null, "entryId"),
    [systemPresence.data?.entries, systemPresence.data?.items, systemPresence.data?.presence],
  );

  const channelUpstreamItems = useMemo(
    () => normalizeRecordItems(channelsUpstream.data?.channels ?? null, "channel"),
    [channelsUpstream.data?.channels],
  );

  const secretsFindingItems = useMemo(
    () => normalizeRecordItems(secretsAudit.data?.findings ?? secretsAudit.data?.issues ?? secretsAudit.data?.items ?? null, "finding"),
    [secretsAudit.data?.findings, secretsAudit.data?.issues, secretsAudit.data?.items],
  );

  const securityFindingItems = useMemo(
    () => normalizeRecordItems(securityAudit.data?.findings ?? securityAudit.data?.issues ?? securityAudit.data?.items ?? null, "finding"),
    [securityAudit.data?.findings, securityAudit.data?.issues, securityAudit.data?.items],
  );

  const fallbackEntries = useMemo(
    () => normalizeStringItems(modelFallbacks.data?.models ?? modelFallbacks.data?.fallbacks ?? modelFallbacks.data?.items ?? null),
    [modelFallbacks.data?.fallbacks, modelFallbacks.data?.items, modelFallbacks.data?.models],
  );

  const imageFallbackEntries = useMemo(
    () => normalizeStringItems(imageFallbacks.data?.models ?? imageFallbacks.data?.fallbacks ?? imageFallbacks.data?.items ?? null),
    [imageFallbacks.data?.fallbacks, imageFallbacks.data?.items, imageFallbacks.data?.models],
  );

  const errors = [
    info.error,
    status.error,
    system.error,
    upstream.error,
    mcpServers.error,
    mcpServerDetail.error,
    gatewayUsage.error,
    gatewayDiscover.error,
    nodesStatus.error,
    nodesList.error,
    nodeDetail.error,
    config.error,
    sessions.error,
    logs.error,
    version.error,
    domain.error,
    domainIssuer.error,
    providers.error,
    providerModels.error,
    channels.error,
    channelsStatus.error,
    channelsUpstream.error,
    channelCapabilities.error,
    channelLogs.error,
    plugins.error,
    pluginsInspect.error,
    hooks.error,
    hookCheck.error,
    hookDetail.error,
    skills.error,
    skillsStatus.error,
    skillBins.error,
    skillDetail.error,
    directorySelf.error,
    directoryPeers.error,
    directoryGroups.error,
    directoryMembers.error,
    modelsCatalog.error,
    modelsStatus.error,
    modelAuthOrder.error,
    modelAliases.error,
    modelFallbacks.error,
    imageFallbacks.error,
    systemHeartbeatLast.error,
    systemPresence.error,
    secretsAudit.error,
    securityAudit.error,
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
              onClick={() => void refreshAll(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      {errors.length > 0 ? (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {errors[0]}
        </div>
      ) : null}

      {activeEnvironment ? (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Managing <span className="font-semibold text-[var(--text-primary)]">{activeEnvironment.name}</span>
          <span className="ml-2 text-[var(--text-tertiary)]">{activeEnvironment.baseUrl}</span>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
            <span>Last updated: {fmtDate(lastUpdatedAt ?? undefined)} (Asia/Ho_Chi_Minh)</span>
            <span>{cacheSummary}</span>
          </div>
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

      {openClawSection === "mcp" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <ListCard title="MCP Servers" icon={Plug}>
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              {mcpServerItems.length === 0 ? (
                <p>No MCP servers returned.</p>
              ) : (
                mcpServerItems.map((item, index) => {
                  const name = String(item.name ?? item.id ?? item.server ?? `server-${index + 1}`);
                  const active = name === selectedMcpServer;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedMcpServer(name)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                          : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                      }`}
                    >
                      <p className="font-medium text-[var(--text-primary)]">{name}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.command ?? item.transport ?? item.type ?? "No command metadata")}</p>
                    </button>
                  );
                })
              )}
            </div>
          </ListCard>

          <DetailCard title="MCP Server Detail" icon={Plug}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Server Name</span>
                <input
                  value={selectedMcpServer}
                  onChange={(event) => setSelectedMcpServer(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  placeholder="context7"
                />
              </label>
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Value (JSON)</span>
                <textarea
                  value={mcpValueText}
                  onChange={(event) => setMcpValueText(event.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveMcpServer()}
                disabled={mcpBusy != null}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {mcpBusy === "save" ? "Saving…" : "Save MCP Server"}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteMcpServer()}
                disabled={mcpBusy != null || !selectedMcpServer}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--danger)]/40 disabled:opacity-50"
              >
                {mcpBusy === "delete" ? "Removing…" : "Remove MCP Server"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Selected MCP Payload</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                {JSON.stringify(selectedMcpServerData ?? { message: "No MCP server detail returned." }, null, 2)}
              </pre>
            </div>
          </DetailCard>
        </div>
      ) : null}

      {openClawSection === "gateway" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Usage Window" value={`${gatewayUsage.data?.days ?? 30} days`} subtitle={String(gatewayUsage.data?.currency ?? "currency unknown")} icon={Network} />
            <StatCard label="Gateway Cost" value={String(gatewayUsage.data?.totalCost ?? gatewayUsage.data?.cost ?? "—")} subtitle="Gateway usage summary" icon={Activity} />
            <StatCard label="Discovered Gateways" value={String(gatewayDiscoverItems.length)} subtitle="gateway discover" icon={Server} />
            <StatCard label="Known Nodes" value={String(nodesStatusItems.length + nodesListItems.length)} subtitle="status + inventory" icon={Database} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.1fr]">
            <ListCard title="Gateway Discovery" icon={Network}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {gatewayDiscoverItems.length === 0 ? (
                  <p>No gateway discovery data returned.</p>
                ) : (
                  gatewayDiscoverItems.slice(0, 10).map((item, index) => (
                    <div key={`${String(item.gatewayId ?? item.id ?? item.name ?? index)}`} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                      <p className="font-medium text-[var(--text-primary)]">{String(item.name ?? item.gatewayId ?? item.id ?? `gateway-${index + 1}`)}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.host ?? item.url ?? item.address ?? "No endpoint")}</p>
                    </div>
                  ))
                )}
              </div>
            </ListCard>

            <ListCard title="Node Fleet" icon={Database}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {[...nodesStatusItems, ...nodesListItems].length === 0 ? (
                  <p>No nodes returned.</p>
                ) : (
                  [...nodesStatusItems, ...nodesListItems].slice(0, 12).map((item, index) => {
                    const nodeId = String(item.nodeId ?? item.id ?? item.name ?? `node-${index + 1}`);
                    const active = nodeId === selectedNode;
                    return (
                      <button
                        key={nodeId}
                        type="button"
                        onClick={() => setSelectedNode(nodeId)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                            : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <p className="font-medium text-[var(--text-primary)]">{nodeId}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.status ?? item.connected ?? item.lastConnected ?? "No node status")}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </ListCard>

            <DetailCard title="Node Detail" icon={Server}>
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Selected Node</p>
                <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(selectedNodeData ?? { message: "No node selected or no node detail returned." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isConfigSection ? (
        <div className="space-y-4">
          {isProviderSection || isCredentialsSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            {isProviderSection ? (
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
            ) : null}

            {isCredentialsSection ? (
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

              <div className="mt-5 border-t border-[var(--border)]/60 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Secrets</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Reload runtime secret refs and inspect unresolved or plaintext findings.</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" checked={secretAllowExec} onChange={(event) => setSecretAllowExec(event.target.checked)} />
                    Allow exec checks
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleReloadSecrets()}
                    disabled={secretBusy != null}
                    className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                  >
                    {secretBusy === "reload" ? "Reloading…" : "Reload Secrets"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void secretsAudit.refresh({ refresh: true })}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                  >
                    Refresh Audit
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Audit Summary</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{secretsAudit.data?.summary ?? "No secret audit summary returned."}</p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">Findings: {secretsFindingItems.length}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Reload Result</p>
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                      {JSON.stringify(secretReloadResult ?? { message: "No secrets reload executed yet." }, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Secrets Audit JSON</p>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(secretsAudit.data ?? { message: "No secrets audit returned." }, null, 2)}
                  </pre>
                </div>
              </div>
            </ListCard>
            ) : null}
          </div>
          ) : null}

          {isDomainSection || isBackupSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {isDomainSection ? (
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
            ) : null}

            {isBackupSection ? (
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
            ) : null}
          </div>
          ) : null}

          {isProviderSection || isChannelsSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {isProviderSection ? (
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
            ) : null}

            {isChannelsSection ? (
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

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Upstream Channel Status</p>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(channelsStatus.data ?? { message: "No upstream channel status returned." }, null, 2)}
                </pre>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Upstream Inventory</p>
                    <span className="text-xs text-[var(--text-secondary)]">{channelUpstreamItems.length} item(s)</span>
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(channelsUpstream.data ?? { message: "No upstream channel inventory returned." }, null, 2)}
                  </pre>
                </div>

                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Account</span>
                      <input
                        value={channelAccount}
                        onChange={(event) => setChannelAccount(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void channelCapabilities.refresh({ refresh: true })}
                        className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                      >
                        Refresh Caps
                      </button>
                    </div>
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(channelCapabilities.data ?? { message: "No channel capabilities returned." }, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px_140px]">
                  <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <span>Resolve Entries</span>
                    <textarea
                      value={channelResolveText}
                      onChange={(event) => setChannelResolveText(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      placeholder="@openclaw_ops\n123456789"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <span>Kind</span>
                    <select
                      value={channelResolveKind}
                      onChange={(event) => setChannelResolveKind(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    >
                      <option value="auto">auto</option>
                      <option value="user">user</option>
                      <option value="group">group</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void handleResolveChannelTargets()}
                      disabled={channelBusy != null}
                      className="w-full rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {channelBusy === "resolve" ? "Resolving…" : "Resolve Targets"}
                    </button>
                  </div>
                </div>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(channelResolveResult ?? { message: "No channel targets resolved yet." }, null, 2)}
                </pre>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Channel Logs</p>
                  <select
                    value={channelLogLines}
                    onChange={(event) => setChannelLogLines(Number(event.target.value))}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  >
                    {[100, 200, 300, 500].map((value) => (
                      <option key={value} value={value}>{value} lines</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void channelLogs.refresh({ refresh: true })}
                    className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                  >
                    Refresh Logs
                  </button>
                </div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {channelLogs.data?.logs ?? JSON.stringify(channelLogs.data ?? { message: "No channel logs returned." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
            ) : null}
          </div>
          ) : null}

          {isPluginsSection || isSystemSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {isPluginsSection ? (
            <DetailCard title="Plugins" icon={Puzzle}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  {pluginItems.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                      No plugins returned.
                    </div>
                  ) : (
                    pluginItems.map((item, index) => {
                      const pluginId = String(item.id ?? item.name ?? item.title ?? `plugin-${index + 1}`);
                      const active = pluginId === selectedPlugin;
                      return (
                        <button
                          key={pluginId}
                          type="button"
                          onClick={() => setSelectedPlugin(pluginId)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                              : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                          }`}
                        >
                          <p className="font-medium text-[var(--text-primary)]">{pluginId}</p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.version ?? item.description ?? "No plugin metadata")}</p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div>
                  {selectedPluginData ? (
                    <>
                      <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{String(selectedPluginData.title ?? selectedPluginData.name ?? selectedPluginData.id ?? selectedPlugin)}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(selectedPluginData.version ?? "Version unavailable")}</p>
                          </div>
                          <span className={`text-xs ${(selectedPluginData.enabled || selectedPluginData.active) ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}>
                            {(selectedPluginData.enabled || selectedPluginData.active) ? "enabled" : "disabled"}
                          </span>
                        </div>
                        <p className="mt-3">{String(selectedPluginData.description ?? "No plugin description returned.")}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleTogglePlugin(true)}
                          disabled={pluginBusy != null || !selectedPlugin}
                          className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                        >
                          {pluginBusy === "enable" ? "Enabling…" : "Enable Plugin"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTogglePlugin(false)}
                          disabled={pluginBusy != null || !selectedPlugin}
                          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50"
                        >
                          {pluginBusy === "disable" ? "Disabling…" : "Disable Plugin"}
                        </button>
                      </div>

                      <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Plugin Inspect Data</p>
                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                          {JSON.stringify(selectedPluginData, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                      No plugin selected.
                    </div>
                  )}
                </div>
              </div>
            </DetailCard>
            ) : null}

            {isSystemSection ? (
            <DetailCard title="System" icon={ShieldCheck}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>System Event</span>
                  <input
                    value={systemEventText}
                    onChange={(event) => setSystemEventText(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="manual-health-check"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Mode</span>
                  <select
                    value={systemEventMode}
                    onChange={(event) => setSystemEventMode(event.target.value as "now" | "next-heartbeat")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    <option value="now">now</option>
                    <option value="next-heartbeat">next-heartbeat</option>
                  </select>
                </label>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Presence Entries</p>
                  <p className="mt-2 text-[var(--text-primary)]">{systemPresenceItems.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handlePostSystemEvent()}
                  disabled={systemBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {systemBusy === "event" ? "Posting…" : "Post System Event"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleHeartbeat(true)}
                  disabled={systemBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {systemBusy === "heartbeat-enable" ? "Enabling…" : "Enable Heartbeat"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleHeartbeat(false)}
                  disabled={systemBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50"
                >
                  {systemBusy === "heartbeat-disable" ? "Disabling…" : "Disable Heartbeat"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Heartbeat</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(systemHeartbeatLast.data ?? { message: "No heartbeat data returned." }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Presence Snapshot</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(systemPresence.data ?? { message: "No system presence returned." }, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Security Audit</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Inspect security foot-guns without applying fixes.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input type="checkbox" checked={securityAuditDeep} onChange={(event) => setSecurityAuditDeep(event.target.checked)} />
                      Deep audit
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleRefreshSecurityAudit()}
                      disabled={systemBusy != null}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                    >
                      {systemBusy === "security-audit" ? "Refreshing…" : "Refresh Audit"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Summary</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{securityAudit.data?.summary ?? "No security audit summary returned."}</p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">Findings: {securityFindingItems.length}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Mode</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{securityAuditDeep ? "Deep checks enabled" : "Standard checks only"}</p>
                  </div>
                </div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(securityAudit.data ?? { message: "No security audit returned." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
            ) : null}
          </div>
          ) : null}

          {isSkillsSection || isHooksSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {isSkillsSection ? (
            <DetailCard title="Skills" icon={Puzzle}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Agent</span>
                  <input
                    value={skillAgentId}
                    onChange={(event) => setSkillAgentId(event.target.value || "main")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Skill</span>
                  <select
                    value={selectedSkill}
                    onChange={(event) => setSelectedSkill(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {(skills.data?.skills ?? []).map((entry) => {
                      const value = entry.skillKey ?? "";
                      return (
                        <option key={value} value={value}>
                          {entry.title ?? value}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Total Skills</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{skillsStatus.data?.totalSkills ?? skills.data?.count ?? 0}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Enabled</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{skillsStatus.data?.enabledSkills ?? 0}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Watch Mode</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{boolLabel(skillsStatus.data?.watch)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={skillSearchQuery}
                  onChange={(event) => setSkillSearchQuery(event.target.value)}
                  placeholder="Search ClawHub skills"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSkillSearch()}
                  disabled={skillSearchBusy}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {skillSearchBusy ? "Searching…" : "Search Skills"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                <div className="flex flex-wrap gap-2">
                  {(skillBins.data?.bins ?? []).length > 0 ? (
                    (skillBins.data?.bins ?? []).map((bin) => (
                      <span key={bin} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-primary)]">
                        {bin}
                      </span>
                    ))
                  ) : (
                    <span>No declared binary dependencies.</span>
                  )}
                </div>
                {(skillsStatus.data?.disabledSkills ?? []).length > 0 ? (
                  <p className="mt-3 text-xs text-[var(--warning)]">
                    Disabled: {(skillsStatus.data?.disabledSkills ?? []).join(", ")}
                  </p>
                ) : null}
              </div>

              {selectedSkillData ? (
                <>
                  <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{selectedSkillData.title ?? selectedSkillData.skillKey ?? "Selected skill"}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{selectedSkillData.source ?? "workspace"}</p>
                      </div>
                      <span className={`text-xs ${selectedSkillData.enabled ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}>
                        {selectedSkillData.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">{selectedSkillData.description ?? "No skill description returned."}</p>
                  </div>

                  <label className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" checked={skillEnabled} onChange={(event) => setSkillEnabled(event.target.checked)} />
                    Enabled in active environment
                  </label>

                  <label className="mt-4 block space-y-2 text-sm text-[var(--text-secondary)]">
                    <span>Skill API key</span>
                    <textarea
                      value={skillApiKey}
                      onChange={(event) => setSkillApiKey(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      placeholder="Optional skill-specific secret"
                    />
                  </label>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Env Overrides (JSON)</span>
                      <textarea
                        value={skillEnvText}
                        onChange={(event) => setSkillEnvText(event.target.value)}
                        rows={8}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Config Overrides (JSON)</span>
                      <textarea
                        value={skillConfigText}
                        onChange={(event) => setSkillConfigText(event.target.value)}
                        rows={8}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" checked={skillRestart} onChange={(event) => setSkillRestart(event.target.checked)} />
                    Restart OpenClaw after saving
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleUpdateSkill()}
                      disabled={skillUpdateBusy}
                      className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {skillUpdateBusy ? "Saving…" : "Save Skill Config"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Skill Content Preview</p>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                      {selectedSkillData.content ?? "No raw SKILL.md content returned for this skill."}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                  No skills available for the selected agent.
                </div>
              )}

              {skillSearchResults.length > 0 ? (
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Search Results</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {skillSearchResults.slice(0, 5).map((result, index) => (
                      <div key={`${String(result["skillKey"] ?? result["id"] ?? index)}`} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                        <p className="font-medium text-[var(--text-primary)]">{String(result["title"] ?? result["skillKey"] ?? result["id"] ?? "skill")}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(result["description"] ?? result["summary"] ?? "No description")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </DetailCard>
            ) : null}

            {isHooksSection ? (
            <DetailCard title="Hooks" icon={Wrench}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Hook</span>
                  <select
                    value={selectedHook}
                    onChange={(event) => setSelectedHook(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {hookEntries.map(([name, entry]) => (
                      <option key={name} value={name}>
                        {entry.title ?? name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Eligible Hooks</p>
                  <p className="mt-1 text-[var(--text-primary)]">{hookEntries.filter(([, hook]) => hook.eligible !== false).length}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Enabled Hooks</p>
                  <p className="mt-1 text-[var(--text-primary)]">{hookEntries.filter(([, hook]) => hook.enabled || hook.active).length}</p>
                </div>
              </div>

              {selectedHookData ? (
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{selectedHookData.title ?? selectedHookData.name ?? selectedHook}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{selectedHookData.source ?? selectedHookData.status ?? "local hook"}</p>
                    </div>
                    <span className={`text-xs ${(selectedHookData.enabled || selectedHookData.active) ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}>
                      {(selectedHookData.enabled || selectedHookData.active) ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{selectedHookData.description ?? "No hook description returned."}</p>

                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Eligible</span>
                      <p className="mt-1 text-[var(--text-primary)]">{boolLabel(selectedHookData.eligible !== false)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Enabled</span>
                      <p className="mt-1 text-[var(--text-primary)]">{boolLabel(Boolean(selectedHookData.enabled || selectedHookData.active))}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Check Entries</span>
                      <p className="mt-1 text-[var(--text-primary)]">{hookCheckEntries.length}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                  No hooks were returned by the active OpenClaw environment.
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleHook(true)}
                  disabled={hookBusy != null || !selectedHook}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {hookBusy === "enable" ? "Enabling…" : "Enable Hook"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleHook(false)}
                  disabled={hookBusy != null || !selectedHook}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50"
                >
                  {hookBusy === "disable" ? "Disabling…" : "Disable Hook"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Hook Check Snapshot</p>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(hookCheck.data ?? { message: "No hook check data returned." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
            ) : null}
          </div>
          ) : null}

          {isDirectorySection || isModelsSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {isDirectorySection ? (
            <DetailCard title="Directory" icon={Database}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px]">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Channel</span>
                  <select
                    value={directoryChannel}
                    onChange={(event) => setDirectoryChannel(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {["slack", "discord", "telegram", "zalo"].map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Limit</span>
                  <select
                    value={directoryLimit}
                    onChange={(event) => setDirectoryLimit(Number(event.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {[10, 20, 50].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Connected Identity</p>
                <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(directorySelfData ?? { message: "No channel identity returned." }, null, 2)}
                </pre>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={directoryPeerQuery}
                  onChange={(event) => setDirectoryPeerQuery(event.target.value)}
                  placeholder="Search peers or contacts"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void directoryPeers.refresh();
                    void directoryGroups.refresh();
                    void directorySelf.refresh();
                  }}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                >
                  Refresh Directory
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Peers</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {directoryPeerItems.length === 0 ? (
                      <p>No peers returned.</p>
                    ) : (
                      directoryPeerItems.slice(0, 8).map((peer, index) => (
                        <div key={`${String(peer.peerId ?? peer.id ?? peer.name ?? index)}`} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                          <p className="font-medium text-[var(--text-primary)]">{String(peer.name ?? peer.displayName ?? peer.peerId ?? peer.id ?? "peer")}</p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(peer.handle ?? peer.username ?? peer.email ?? peer.id ?? "—")}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <span>Group</span>
                    <select
                      value={selectedDirectoryGroup}
                      onChange={(event) => setSelectedDirectoryGroup(event.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    >
                      {directoryGroupItems.map((group, index) => {
                        const value = String(group.groupId ?? group.id ?? group.name ?? `group-${index + 1}`);
                        return (
                          <option key={value} value={value}>
                            {String(group.name ?? group.title ?? value)}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {directoryMemberItems.length === 0 ? (
                      <p>No group members returned.</p>
                    ) : (
                      directoryMemberItems.slice(0, 8).map((member, index) => (
                        <div key={`${String(member.memberId ?? member.id ?? member.name ?? index)}`} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                          <p className="font-medium text-[var(--text-primary)]">{String(member.name ?? member.displayName ?? member.memberId ?? member.id ?? "member")}</p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(member.role ?? member.username ?? member.email ?? "—")}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DetailCard>
            ) : null}

            {isModelsSection ? (
            <DetailCard title="Models" icon={Bot}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Agent</span>
                  <input
                    value={modelAgentId}
                    onChange={(event) => setModelAgentId(event.target.value || "main")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Auth Provider</span>
                  <input
                    value={authProvider}
                    onChange={(event) => setAuthProvider(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Catalog</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{modelCatalogOptions.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Default</p>
                  <p className="mt-1 truncate text-sm text-[var(--text-primary)]">{modelsStatus.data?.defaultModel ?? modelsStatus.data?.currentModel ?? config.data?.model ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Image Default</p>
                  <p className="mt-1 truncate text-sm text-[var(--text-primary)]">{modelsStatus.data?.imageDefaultModel ?? "—"}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Default Model</span>
                  <input
                    list="openclaw-model-catalog"
                    value={defaultModelDraft}
                    onChange={(event) => setDefaultModelDraft(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Image Model</span>
                  <input
                    list="openclaw-model-catalog"
                    value={imageModelDraft}
                    onChange={(event) => setImageModelDraft(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <datalist id="openclaw-model-catalog">
                {modelCatalogOptions.map((modelName) => (
                  <option key={modelName} value={modelName} />
                ))}
              </datalist>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSetModel("/models/default", defaultModelDraft, "default")}
                  disabled={modelBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {modelBusy === "default" ? "Saving…" : "Set Default"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSetModel("/models/image-default", imageModelDraft, "image-default")}
                  disabled={modelBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {modelBusy === "image-default" ? "Saving…" : "Set Image Model"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Auth Order</p>
                <textarea
                  value={authOrderText}
                  onChange={(event) => setAuthOrderText(event.target.value)}
                  rows={5}
                  className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                  placeholder="anthropic:default\nanthropic:manual"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveAuthOrder()}
                    disabled={modelBusy != null}
                    className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                  >
                    {modelBusy === "auth-order" ? "Saving…" : "Save Auth Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClearAuthOrder()}
                    disabled={modelBusy != null}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50"
                  >
                    {modelBusy === "auth-order-clear" ? "Clearing…" : "Clear Auth Order"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Aliases</p>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <input
                      value={aliasName}
                      onChange={(event) => setAliasName(event.target.value)}
                      placeholder="fast-chat"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                    />
                    <input
                      list="openclaw-model-catalog"
                      value={aliasModel}
                      onChange={(event) => setAliasModel(event.target.value)}
                      placeholder="anthropic/claude-sonnet-4"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveAlias()}
                      disabled={modelBusy != null}
                      className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {modelBusy === "alias-save" ? "Saving…" : "Save Alias"}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {aliasEntries.length === 0 ? (
                      <p>No aliases configured.</p>
                    ) : (
                      aliasEntries.slice(0, 8).map((entry) => (
                        <div key={entry.alias} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)]/50 px-3 py-2">
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{entry.alias}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{entry.model || "—"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAlias(entry.alias)}
                            disabled={modelBusy != null}
                            className="text-xs font-medium text-[var(--danger)] disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Fallbacks</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        list="openclaw-model-catalog"
                        value={fallbackModel}
                        onChange={(event) => setFallbackModel(event.target.value)}
                        placeholder="openai/gpt-4.1-mini"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddFallback("fallbacks", fallbackModel)}
                        disabled={modelBusy != null}
                        className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                      {fallbackEntries.length === 0 ? (
                        <p>No fallback models configured.</p>
                      ) : (
                        fallbackEntries.map((entry) => (
                          <div key={entry} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)]/50 px-3 py-2">
                            <span className="text-[var(--text-primary)]">{entry}</span>
                            <button
                              type="button"
                              onClick={() => void handleRemoveFallback("fallbacks", entry)}
                              disabled={modelBusy != null}
                              className="text-xs font-medium text-[var(--danger)] disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {fallbackEntries.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveFallback("fallbacks")}
                        disabled={modelBusy != null}
                        className="mt-3 text-xs font-medium text-[var(--warning)] disabled:opacity-50"
                      >
                        Clear all fallbacks
                      </button>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Image Fallbacks</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        list="openclaw-model-catalog"
                        value={imageFallbackModel}
                        onChange={(event) => setImageFallbackModel(event.target.value)}
                        placeholder="openai/gpt-image-1"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddFallback("image-fallbacks", imageFallbackModel)}
                        disabled={modelBusy != null}
                        className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                      {imageFallbackEntries.length === 0 ? (
                        <p>No image fallback models configured.</p>
                      ) : (
                        imageFallbackEntries.map((entry) => (
                          <div key={entry} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)]/50 px-3 py-2">
                            <span className="text-[var(--text-primary)]">{entry}</span>
                            <button
                              type="button"
                              onClick={() => void handleRemoveFallback("image-fallbacks", entry)}
                              disabled={modelBusy != null}
                              className="text-xs font-medium text-[var(--danger)] disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {imageFallbackEntries.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveFallback("image-fallbacks")}
                        disabled={modelBusy != null}
                        className="mt-3 text-xs font-medium text-[var(--warning)] disabled:opacity-50"
                      >
                        Clear all image fallbacks
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </DetailCard>
            ) : null}
          </div>
          ) : null}
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