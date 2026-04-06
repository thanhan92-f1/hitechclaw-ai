"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Brain,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
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
  Smartphone,
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

interface UpdateStatusInfo {
  ok?: boolean;
  channel?: string;
  currentVersion?: string;
  installedVersion?: string;
  latestVersion?: string;
  availableVersion?: string;
  updateAvailable?: boolean;
  [key: string]: unknown;
}

interface UpdateRunResult {
  ok?: boolean;
  status?: string;
  message?: string;
  [key: string]: unknown;
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

interface BackupHistoryRecord {
  id?: string;
  action?: string;
  archivePath?: string;
  archive?: string;
  verified?: boolean | null;
  status?: string;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

interface BackupHistoryResponse {
  items?: BackupHistoryRecord[];
  environmentId?: string;
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

interface CustomProvidersInfo {
  ok?: boolean;
  providers?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  templates?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
  customProviders?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
  activeProvider?: string;
  activeModel?: string;
  [key: string]: unknown;
}

interface ChatGptOAuthStatusInfo {
  ok?: boolean;
  exists?: boolean;
  configured?: boolean;
  hasToken?: boolean;
  hasRefreshToken?: boolean;
  provider?: string;
  model?: string;
  agentId?: string;
  expiresAt?: string;
  tokenExpiresAt?: string;
  [key: string]: unknown;
}

interface ChatGptOAuthStartInfo {
  ok?: boolean;
  sessionId?: string;
  oauthUrl?: string;
  url?: string;
  [key: string]: unknown;
}

interface BindingRecord {
  agentId?: string;
  match?: Record<string, unknown>;
  [key: string]: unknown;
}

interface BindingsInfo {
  ok?: boolean;
  count?: number;
  bindings?: BindingRecord[];
}

interface EnvironmentInfo {
  ok?: boolean;
  env?: Record<string, string | null>;
}

interface CliProxyResult {
  ok?: boolean;
  output?: string;
  command?: string;
  [key: string]: unknown;
}

interface SelfUpdateFileResult {
  file?: string;
  ok?: boolean;
  [key: string]: unknown;
}

interface SelfUpdateResult {
  ok?: boolean;
  message?: string;
  files?: SelfUpdateFileResult[];
  [key: string]: unknown;
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

interface SkillsCheckInfo {
  ok?: boolean;
  summary?: string;
  checks?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  ready?: Array<Record<string, unknown>>;
  missing?: Array<Record<string, unknown>>;
  [key: string]: unknown;
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

interface CustomSkillRecord {
  skillKey?: string;
  title?: string;
  description?: string;
  summary?: string;
  content?: string;
  path?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface CustomSkillsInfo {
  ok?: boolean;
  agentId?: string;
  skills?: CustomSkillRecord[];
  items?: CustomSkillRecord[];
  results?: CustomSkillRecord[];
  [key: string]: unknown;
}

interface CustomSkillDetailInfo {
  ok?: boolean;
  skill?: CustomSkillRecord;
  item?: CustomSkillRecord;
  data?: CustomSkillRecord;
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

interface AuthUserInfo {
  ok?: boolean;
  exists?: boolean;
  configured?: boolean;
  username?: string;
  user?: {
    username?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ManagedAuthRecord {
  environmentId?: string;
  username?: string;
  passwordConfigured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ManagedAuthRecordResponse {
  record?: ManagedAuthRecord | null;
  environmentId?: string;
}

interface CronStatusInfo {
  ok?: boolean;
  enabled?: boolean;
  running?: boolean;
  status?: string;
  jobs?: number;
  totalJobs?: number;
  [key: string]: unknown;
}

interface CronJobsInfo {
  ok?: boolean;
  jobs?: Array<Record<string, unknown>> | Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ConfigSchemaInfo {
  ok?: boolean;
  count?: number;
  roots?: string[];
  schema?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface ConfigFileInfo {
  ok?: boolean;
  path?: string;
  file?: string;
  content?: string;
  raw?: string;
  size?: number;
  mtime?: string;
  [key: string]: unknown;
}

interface MemoryStatusInfo {
  ok?: boolean;
  agentId?: string;
  summary?: string;
  embedding?: Record<string, unknown>;
  index?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MemorySearchInfo {
  ok?: boolean;
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  matches?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface DoctorMemoryStatusInfo {
  ok?: boolean;
  agentId?: string;
  provider?: string;
  embedding?: Record<string, unknown>;
  note?: string;
  [key: string]: unknown;
}

interface DevicesInfo {
  ok?: boolean;
  devices?: Array<Record<string, unknown>>;
  pending?: Array<Record<string, unknown>>;
  paired?: Array<Record<string, unknown>>;
  requests?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface AgentsInfo {
  ok?: boolean;
  agents?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface AgentDetailInfo {
  ok?: boolean;
  agent?: Record<string, unknown>;
  item?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AgentApiKeysInfo {
  ok?: boolean;
  keys?: Record<string, unknown>;
  apiKeys?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AgentFilesInfo {
  ok?: boolean;
  agentId?: string;
  workspace?: string;
  files?: Array<Record<string, unknown>>;
  count?: number;
  [key: string]: unknown;
}

interface AgentFileInfo {
  ok?: boolean;
  agentId?: string;
  workspace?: string;
  file?: Record<string, unknown>;
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

function toModelOptionValue(model: string | { id?: string; name?: string; model?: string; label?: string }) {
  if (typeof model === "string") return model;
  return model.id ?? model.model ?? model.name ?? model.label ?? "unknown-model";
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

function parseJsonValueInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
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

async function requestOpenClawSettings<T>(path: string, environmentId?: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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

async function requestOpenClawDetailed<T>(path: string, init?: OpenClawRequestInit): Promise<{ data: T; meta: OpenClawResponseMeta }> {
  const environmentId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("hitechclaw-ai-openclaw-environment")
      : null;
  const sanitizeOpenClawErrorMessage = (message: string) => {
    const normalized = message.trim();

    if (/Workspace file ['"].+['"] not found/i.test(normalized) && /timed out/i.test(normalized)) {
      return "Agent workspace file is unavailable right now. Refresh and choose another file if needed.";
    }

    if (/Workspace file ['"].+['"] not found/i.test(normalized)) {
      return "Selected agent workspace file was not found. Choose another file and try again.";
    }

    if (/openclaw environment not found/i.test(normalized)) {
      return "Selected OpenClaw target is unavailable right now. Refresh targets or choose another target.";
    }

    if (/no openclaw environment configured in database/i.test(normalized)) {
      return "No OpenClaw target is configured yet. Add one in Settings → OpenClaw.";
    }

    if (/management api is not configured for the selected environment/i.test(normalized)) {
      return "Selected OpenClaw target is missing management credentials. Update it in Settings → OpenClaw.";
    }

    if (/spawnsync\s+openclaw\s+etimedout/i.test(normalized) || /etimedout/i.test(normalized) || /timed out/i.test(normalized)) {
      return "OpenClaw request timed out. Use Refresh to load the latest data again.";
    }

    if (/unknown option\s+['"]--channel['"]/i.test(normalized)) {
      return "This OpenClaw target does not support release channel selection for update status.";
    }

    if (/pairing required/i.test(normalized)) {
      return "OpenClaw gateway is not paired for the selected target. Pair the gateway first, then try again.";
    }

    if (/gateway connect failed|gateway closed \(1008\)|GatewayClientRequestError/i.test(normalized)) {
      return "OpenClaw gateway is currently unavailable for the selected target. Check gateway connectivity and pairing, then try again.";
    }

    if (/Command failed:\s*openclaw gateway call/i.test(normalized)) {
      return "OpenClaw gateway command failed for the selected target. Verify gateway setup, then try again.";
    }

    return normalized;
  };

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
        ? sanitizeOpenClawErrorMessage((data as { error: string }).error)
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

function getOpenClawEmptyStateMessage(message: string | null | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (shouldHideOpenClawErrorMessage(message)) {
    return fallback;
  }

  return message;
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
        error: error instanceof Error ? error.message : "OpenClaw request failed",
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

function shouldHideOpenClawErrorMessage(message: string | null | undefined) {
  if (!message) return false;

  return [
    "OpenClaw request timed out. Use Refresh to load the latest data again.",
    "This OpenClaw target does not support release channel selection for update status.",
    "Agent workspace file is unavailable right now. Refresh and choose another file if needed.",
    "Selected agent workspace file was not found. Choose another file and try again.",
    "Selected OpenClaw target is unavailable right now. Refresh targets or choose another target.",
    "No OpenClaw target is configured yet. Add one in Settings → OpenClaw.",
    "Selected OpenClaw target is missing management credentials. Update it in Settings → OpenClaw.",
    "OpenClaw gateway is not paired for the selected target. Pair the gateway first, then try again.",
    "OpenClaw gateway is currently unavailable for the selected target. Check gateway connectivity and pairing, then try again.",
    "OpenClaw gateway command failed for the selected target. Verify gateway setup, then try again.",
  ].includes(message);
}

function formatOpenClawActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return shouldHideOpenClawErrorMessage(error.message) ? fallback : error.message;
}

export function OpenClawManagement() {
  const {
    openClawSection,
    openClawEnvironmentId,
    setOpenClawEnvironmentId,
  } = useTenantFilter();
  const [serviceFilter, setServiceFilter] = useState<"openclaw" | "caddy">("openclaw");
  const [lines, setLines] = useState(50);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("anthropic/claude-sonnet-4-20250514");
  const [apiKey, setApiKey] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const [providerAdminBusy, setProviderAdminBusy] = useState<string | null>(null);
  const [selectedCustomProvider, setSelectedCustomProvider] = useState("");
  const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState("");
  const [customProviderApi, setCustomProviderApi] = useState("openai-completions");
  const [customProviderModel, setCustomProviderModel] = useState("");
  const [customProviderModelName, setCustomProviderModelName] = useState("");
  const [customProviderApiKey, setCustomProviderApiKey] = useState("");
  const [customProviderClearApiKey, setCustomProviderClearApiKey] = useState(false);
  const [providerModelIdDraft, setProviderModelIdDraft] = useState("");
  const [providerModelNameDraft, setProviderModelNameDraft] = useState("");
  const [chatGptOAuthAgentId, setChatGptOAuthAgentId] = useState("main");
  const [chatGptOAuthModel, setChatGptOAuthModel] = useState("openai-codex/gpt-5.4");
  const [chatGptOAuthSessionId, setChatGptOAuthSessionId] = useState("");
  const [chatGptOAuthRedirectUrl, setChatGptOAuthRedirectUrl] = useState("");
  const [chatGptOAuthSwitchProvider, setChatGptOAuthSwitchProvider] = useState(true);
  const [chatGptOAuthBusy, setChatGptOAuthBusy] = useState<string | null>(null);
  const [chatGptOAuthStartResult, setChatGptOAuthStartResult] = useState<ChatGptOAuthStartInfo | null>(null);
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
    "chatgpt",
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
  const isUpdateSection = openClawSection === "update";
  const isProviderSection = openClawSection === "provider";
  const isChatGptSection = openClawSection === "chatgpt";
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
  const isAuthSection = openClawSection === "auth";
  const isCronSection = openClawSection === "cron";
  const isConfigAdvancedSection = openClawSection === "config-advanced";
  const isBindingsSection = openClawSection === "bindings";
  const isEnvironmentSection = openClawSection === "environment";
  const isCliProxySection = openClawSection === "cli-proxy";
  const isSelfUpdateSection = openClawSection === "self-update";
  const isMemorySection = openClawSection === "memory";
  const isDevicesSection = openClawSection === "devices";
  const isAgentsSection = openClawSection === "agents";

  const info = useOpenClawFetch<ServiceInfo>("/info", OPENCLAW_SYNC_PASSIVE_MS);
  const status = useOpenClawFetch<ServiceStatus>("/status", OPENCLAW_SYNC_ACTIVE_MS);
  const system = useOpenClawFetch<SystemInfo>("/system", OPENCLAW_SYNC_PASSIVE_MS);
  const upstream = useOpenClawFetch<UpstreamStatus>("/openclaw/status?all=true&usage=true&deep=false&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS);
  const mcpServers = useOpenClawFetch<McpServersInfo>("/mcp", OPENCLAW_SYNC_PASSIVE_MS, isMcpSection);
  const gatewayUsage = useOpenClawFetch<GatewayUsageCostInfo>("/gateway/usage-cost?days=30", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const gatewayDiscover = useOpenClawFetch<GatewayDiscoverInfo>("/gateway/discover?timeoutMs=2000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const nodesStatus = useOpenClawFetch<NodesInfo>("/nodes/status?connected=true&lastConnected=24h&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const nodesList = useOpenClawFetch<NodesInfo>("/nodes?connected=false&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS, isGatewaySection);
  const config = useOpenClawFetch<ConfigInfo>("/config", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isConfigSection || isConfigAdvancedSection);
  const sessions = useOpenClawFetch<SessionsInfo>("/sessions?agent=main&allAgents=false", OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "overview" || openClawSection === "sessions");
  const logs = useOpenClawFetch<LogsInfo>(`/logs?lines=${lines}&service=${serviceFilter}`, OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "runtime");
  const version = useOpenClawFetch<VersionInfo>("/version", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || openClawSection === "runtime");
  const updateStatus = useOpenClawFetch<UpdateStatusInfo>("/update/status", OPENCLAW_SYNC_PASSIVE_MS, isUpdateSection);
  const domain = useOpenClawFetch<DomainConfig>("/domain", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isDomainSection);
  const domainIssuer = useOpenClawFetch<DomainPreflight>("/domain/issuer", OPENCLAW_SYNC_PASSIVE_MS, isDomainSection);
  const providers = useOpenClawFetch<ProvidersInfo>("/providers", OPENCLAW_SYNC_PASSIVE_MS, isProviderSection);
  const providerModels = useOpenClawFetch<ProviderModelsInfo>(`/providers/${encodeURIComponent(provider)}/models`, OPENCLAW_SYNC_PASSIVE_MS, isProviderSection && Boolean(provider));
  const customProviders = useOpenClawFetch<CustomProvidersInfo>("/config/custom-providers", OPENCLAW_SYNC_PASSIVE_MS, isProviderSection);
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
  const skillsCheck = useOpenClawFetch<SkillsCheckInfo>("/skills/check", OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection);
  const customSkills = useOpenClawFetch<CustomSkillsInfo>(`/skills/custom?agentId=${encodeURIComponent(skillAgentId)}&includeContent=false`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection);
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
  const authUser = useOpenClawFetch<AuthUserInfo>("/auth/user", OPENCLAW_SYNC_PASSIVE_MS, isAuthSection);
  const [cronIncludeDisabled, setCronIncludeDisabled] = useState(true);
  const cronStatus = useOpenClawFetch<CronStatusInfo>("/cron/status", OPENCLAW_SYNC_PASSIVE_MS, isCronSection);
  const cronJobs = useOpenClawFetch<CronJobsInfo>(`/cron/jobs?all=${cronIncludeDisabled ? "true" : "false"}`, OPENCLAW_SYNC_PASSIVE_MS, isCronSection);
  const configSchema = useOpenClawFetch<ConfigSchemaInfo>("/config/schema", OPENCLAW_SYNC_PASSIVE_MS, isConfigAdvancedSection);
  const configFile = useOpenClawFetch<ConfigFileInfo>("/config/file", OPENCLAW_SYNC_PASSIVE_MS, isConfigAdvancedSection);
  const bindings = useOpenClawFetch<BindingsInfo>("/bindings", OPENCLAW_SYNC_PASSIVE_MS, isBindingsSection);
  const environmentVariables = useOpenClawFetch<EnvironmentInfo>("/env", OPENCLAW_SYNC_PASSIVE_MS, isEnvironmentSection);
  const [memoryAgentId, setMemoryAgentId] = useState("main");
  const [memorySearchQuery, setMemorySearchQuery] = useState("deployment");
  const [memorySearchMaxResults, setMemorySearchMaxResults] = useState(5);
  const memoryStatus = useOpenClawFetch<MemoryStatusInfo>(`/memory/status?agentId=${encodeURIComponent(memoryAgentId)}&deep=true`, OPENCLAW_SYNC_PASSIVE_MS, isMemorySection);
  const doctorMemoryStatus = useOpenClawFetch<DoctorMemoryStatusInfo>("/doctor/memory-status", OPENCLAW_SYNC_PASSIVE_MS, isMemorySection);
  const [memoryBusy, setMemoryBusy] = useState<string | null>(null);
  const [memoryIndexForce, setMemoryIndexForce] = useState(true);
  const [memoryIndexResult, setMemoryIndexResult] = useState<Record<string, unknown> | null>(null);
  const [memorySearchResult, setMemorySearchResult] = useState<MemorySearchInfo | null>(null);
  const devicesLegacy = useOpenClawFetch<DevicesInfo>("/devices", OPENCLAW_SYNC_PASSIVE_MS, isDevicesSection);
  const devicesPairing = useOpenClawFetch<DevicesInfo>("/devices/pairing", OPENCLAW_SYNC_PASSIVE_MS, isDevicesSection);
  const [devicesBusy, setDevicesBusy] = useState<string | null>(null);
  const [selectedDeviceRequestId, setSelectedDeviceRequestId] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [deviceTokenRole, setDeviceTokenRole] = useState("operator");
  const [deviceTokenScopesText, setDeviceTokenScopesText] = useState("operator.read\noperator.write");
  const [deviceActionResult, setDeviceActionResult] = useState<Record<string, unknown> | null>(null);
  const agents = useOpenClawFetch<AgentsInfo>("/agents", OPENCLAW_SYNC_PASSIVE_MS, isAgentsSection);
  const [selectedAgentId, setSelectedAgentId] = useState("main");
  const agentDetail = useOpenClawFetch<AgentDetailInfo>(`/agents/${encodeURIComponent(selectedAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isAgentsSection && Boolean(selectedAgentId));
  const agentApiKeys = useOpenClawFetch<AgentApiKeysInfo>(`/agents/${encodeURIComponent(selectedAgentId)}/api-key`, OPENCLAW_SYNC_PASSIVE_MS, isAgentsSection && Boolean(selectedAgentId));
  const agentFiles = useOpenClawFetch<AgentFilesInfo>(`/agents/${encodeURIComponent(selectedAgentId)}/files`, OPENCLAW_SYNC_PASSIVE_MS, isAgentsSection && Boolean(selectedAgentId));
  const [selectedAgentFileName, setSelectedAgentFileName] = useState("");
  const agentFile = useOpenClawFetch<AgentFileInfo>(`/agents/${encodeURIComponent(selectedAgentId)}/files/${encodeURIComponent(selectedAgentFileName)}`, OPENCLAW_SYNC_PASSIVE_MS, isAgentsSection && Boolean(selectedAgentId) && Boolean(selectedAgentFileName));
  const chatGptOAuthStatus = useOpenClawFetch<ChatGptOAuthStatusInfo>(`/config/chatgpt-oauth/status?agentId=${encodeURIComponent(chatGptOAuthAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isChatGptSection && Boolean(chatGptOAuthAgentId));
  const [agentsBusy, setAgentsBusy] = useState<string | null>(null);
  const [agentCreateId, setAgentCreateId] = useState("ops");
  const [agentCreateName, setAgentCreateName] = useState("Operations Agent");
  const [agentCreateModel, setAgentCreateModel] = useState("anthropic/claude-sonnet-4-20250514");
  const [agentCreateDefault, setAgentCreateDefault] = useState(false);
  const [agentNameDraft, setAgentNameDraft] = useState("");
  const [agentModelDraft, setAgentModelDraft] = useState("");
  const [agentWorkspaceDraft, setAgentWorkspaceDraft] = useState("");
  const [agentDeleteData, setAgentDeleteData] = useState(true);
  const [agentApiKeyProvider, setAgentApiKeyProvider] = useState("anthropic");
  const [agentApiKeyValue, setAgentApiKeyValue] = useState("");
  const [agentFilesContent, setAgentFilesContent] = useState("");

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
  const [backupHistoryItems, setBackupHistoryItems] = useState<BackupHistoryRecord[]>([]);
  const [backupHistoryLoading, setBackupHistoryLoading] = useState(false);
  const [backupHistoryError, setBackupHistoryError] = useState<string | null>(null);
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
  const pluginInspectDetail = useOpenClawFetch<PluginInspectInfo>(`/plugins/inspect?id=${encodeURIComponent(selectedPlugin)}`, OPENCLAW_SYNC_PASSIVE_MS, isPluginsSection && Boolean(selectedPlugin));
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
  const [selectedCustomSkill, setSelectedCustomSkill] = useState("");
  const [customSkillPayloadText, setCustomSkillPayloadText] = useState(`{
  "agentId": "main",
  "skillKey": "custom-vps-audit",
  "title": "Custom VPS Audit",
  "description": "Detailed custom skill for auditing OpenClaw deployments.",
  "summary": "Use this skill when the user asks for a structured OpenClaw VPS audit.",
  "workflow": [
    "Review service status and recent logs.",
    "Inspect providers, channels, bindings, and runtime config.",
    "Return a prioritized remediation plan."
  ],
  "safetyNotes": [
    "Mask all keys and secrets.",
    "Ask before any destructive change."
  ]
}`);
  const [customSkillValidateContent, setCustomSkillValidateContent] = useState("");
  const [customSkillBusy, setCustomSkillBusy] = useState<string | null>(null);
  const [customSkillActionResult, setCustomSkillActionResult] = useState<Record<string, unknown> | null>(null);
  const [customSkillValidateResult, setCustomSkillValidateResult] = useState<Record<string, unknown> | null>(null);
  const [customSkillRenderResult, setCustomSkillRenderResult] = useState<Record<string, unknown> | null>(null);
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
  const [authBusy, setAuthBusy] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNewPassword, setAuthNewPassword] = useState("");
  const [managedAuthRecord, setManagedAuthRecord] = useState<ManagedAuthRecord | null>(null);
  const [managedAuthLoading, setManagedAuthLoading] = useState(false);
  const [managedAuthError, setManagedAuthError] = useState<string | null>(null);
  const [cronBusy, setCronBusy] = useState<string | null>(null);
  const [selectedCronJob, setSelectedCronJob] = useState("");
  const [cronCreateText, setCronCreateText] = useState(`{
  "name": "heartbeat-reminder",
  "schedule": {
    "kind": "interval",
    "everyMs": 3600000
  },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": {
    "kind": "systemEvent",
    "text": "hourly-health-check"
  }
}`);
  const [cronPatchText, setCronPatchText] = useState(`{
  "patch": {
    "enabled": false
  }
}`);
  const [cronRunMode, setCronRunMode] = useState<"force" | "due">("force");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [configAdvancedBusy, setConfigAdvancedBusy] = useState<string | null>(null);
  const [configLookupPath, setConfigLookupPath] = useState("gateway.auth.token");
  const [configGetResult, setConfigGetResult] = useState<Record<string, unknown> | null>(null);
  const [configLookupResult, setConfigLookupResult] = useState<Record<string, unknown> | null>(null);
  const [configValidationResult, setConfigValidationResult] = useState<Record<string, unknown> | null>(null);
  const [configPatchText, setConfigPatchText] = useState(`{
  "skills": {
    "load": {
      "watch": true,
      "watchDebounceMs": 500
    }
  }
}`);
  const [configPatchRestart, setConfigPatchRestart] = useState(false);
  const [configRawPath, setConfigRawPath] = useState("agents.defaults.subagents.maxConcurrent");
  const [configRawValueText, setConfigRawValueText] = useState("12");
  const [configRawRemove, setConfigRawRemove] = useState(false);
  const [configApplyTarget, setConfigApplyTarget] = useState<"openclaw" | "caddy" | "all" | "none">("openclaw");
  const [bindingsBusy, setBindingsBusy] = useState<string | null>(null);
  const [selectedBindingIndex, setSelectedBindingIndex] = useState("");
  const [bindingPayloadText, setBindingPayloadText] = useState(`{
  "agentId": "main",
  "match": {
    "channel": "telegram",
    "accountId": "ops-bot"
  }
}`);
  const [bindingActionResult, setBindingActionResult] = useState<Record<string, unknown> | null>(null);
  const [environmentBusy, setEnvironmentBusy] = useState<string | null>(null);
  const [envKeyDraft, setEnvKeyDraft] = useState("CUSTOM_ENV_VAR");
  const [envValueDraft, setEnvValueDraft] = useState("your_value_here");
  const [environmentActionResult, setEnvironmentActionResult] = useState<Record<string, unknown> | null>(null);
  const [cliCommand, setCliCommand] = useState("models scan");
  const [cliBusy, setCliBusy] = useState(false);
  const [cliResult, setCliResult] = useState<CliProxyResult | null>(null);
  const [selfUpdateBusy, setSelfUpdateBusy] = useState(false);
  const [selfUpdateResult, setSelfUpdateResult] = useState<SelfUpdateResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateNote, setUpdateNote] = useState("Manual maintenance update");
  const [updateRestartDelayMs, setUpdateRestartDelayMs] = useState("5000");
  const [updateTimeoutMs, setUpdateTimeoutMs] = useState("120000");
  const [updateRunResult, setUpdateRunResult] = useState<UpdateRunResult | null>(null);

  const hookDetail = useOpenClawFetch<HookDetailInfo>(`/hooks/${encodeURIComponent(selectedHook)}`, OPENCLAW_SYNC_PASSIVE_MS, isHooksSection && Boolean(selectedHook));
  const skillDetail = useOpenClawFetch<SkillDetailInfo>(`/skills/${encodeURIComponent(selectedSkill)}?agentId=${encodeURIComponent(skillAgentId)}`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection && Boolean(selectedSkill));
  const customSkillDetail = useOpenClawFetch<CustomSkillDetailInfo>(`/skills/custom/${encodeURIComponent(selectedCustomSkill)}?agentId=${encodeURIComponent(skillAgentId)}&includeContent=true`, OPENCLAW_SYNC_PASSIVE_MS, isSkillsSection && Boolean(selectedCustomSkill));
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
      const nextEnvironments = payload.environments ?? [];
      const fallbackEnvironmentId = payload.defaultEnvironmentId ?? nextEnvironments[0]?.id ?? null;
      setEnvironmentOptions(nextEnvironments);
      if (!openClawEnvironmentId || !nextEnvironments.some((environment) => environment.id === openClawEnvironmentId)) {
        setOpenClawEnvironmentId(fallbackEnvironmentId);
      }
    } catch {
      // Preserve the last known environment list during transient failures.
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

  const loadManagedAuthRecord = useCallback(async () => {
    setManagedAuthLoading(true);
    try {
      const payload = await requestOpenClawSettings<ManagedAuthRecordResponse>("/api/settings/openclaw/auth-record", openClawEnvironmentId);
      setManagedAuthRecord(payload.record ?? null);
      setManagedAuthError(null);
    } catch (error) {
      setManagedAuthRecord(null);
      setManagedAuthError(error instanceof Error ? error.message : "Failed to load managed auth record");
    } finally {
      setManagedAuthLoading(false);
    }
  }, [openClawEnvironmentId]);

  const saveManagedAuthRecord = useCallback(async (username: string, password: string) => {
    await requestOpenClawSettings<ManagedAuthRecordResponse>("/api/settings/openclaw/auth-record", openClawEnvironmentId, {
      method: "PUT",
      body: JSON.stringify({ username, password }),
    });
    await loadManagedAuthRecord();
  }, [loadManagedAuthRecord, openClawEnvironmentId]);

  const removeManagedAuthRecord = useCallback(async () => {
    await requestOpenClawSettings("/api/settings/openclaw/auth-record", openClawEnvironmentId, {
      method: "DELETE",
    });
    await loadManagedAuthRecord();
  }, [loadManagedAuthRecord, openClawEnvironmentId]);

  const loadBackupHistory = useCallback(async () => {
    setBackupHistoryLoading(true);
    try {
      const payload = await requestOpenClawSettings<BackupHistoryResponse>("/api/settings/openclaw/backup-history?limit=20", openClawEnvironmentId);
      setBackupHistoryItems(payload.items ?? []);
      setBackupHistoryError(null);
    } catch (error) {
      setBackupHistoryItems([]);
      setBackupHistoryError(error instanceof Error ? error.message : "Failed to load backup inventory");
    } finally {
      setBackupHistoryLoading(false);
    }
  }, [openClawEnvironmentId]);

  const recordBackupHistory = useCallback(async (entry: {
    action: "create" | "verify";
    archivePath?: string;
    verified?: boolean | null;
    status?: string;
    message?: string;
    payload?: Record<string, unknown>;
  }) => {
    if (!entry.archivePath?.trim()) {
      return;
    }

    await requestOpenClawSettings("/api/settings/openclaw/backup-history", openClawEnvironmentId, {
      method: "POST",
      body: JSON.stringify({
        action: entry.action,
        archivePath: entry.archivePath.trim(),
        verified: entry.verified ?? null,
        status: entry.status ?? "ok",
        message: entry.message ?? "",
        payload: entry.payload,
      }),
    });

    await loadBackupHistory();
  }, [loadBackupHistory, openClawEnvironmentId]);

  useEffect(() => {
    if (!isAuthSection) {
      return;
    }
    void loadManagedAuthRecord();
  }, [isAuthSection, loadManagedAuthRecord]);

  useEffect(() => {
    if (!isBackupSection) {
      return;
    }
    void loadBackupHistory();
  }, [isBackupSection, loadBackupHistory]);

  useEffect(() => {
    if (authUsername.trim()) {
      return;
    }

    const preferredUsername = managedAuthRecord?.username ?? authUser.data?.username ?? authUser.data?.user?.username ?? "";
    if (preferredUsername) {
      setAuthUsername(preferredUsername);
    }
  }, [authUser.data?.user?.username, authUser.data?.username, authUsername, managedAuthRecord?.username]);

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

  const customSkillItems = useMemo(
    () => normalizeRecordItems(customSkills.data?.skills ?? customSkills.data?.items ?? customSkills.data?.results ?? null, "skillKey"),
    [customSkills.data?.items, customSkills.data?.results, customSkills.data?.skills],
  );

  useEffect(() => {
    if (!customSkillItems.some((item) => String(item.skillKey ?? item.id ?? item.name ?? "") === selectedCustomSkill)) {
      setSelectedCustomSkill(String(customSkillItems[0]?.skillKey ?? customSkillItems[0]?.id ?? customSkillItems[0]?.name ?? ""));
    }
  }, [customSkillItems, selectedCustomSkill]);

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
    if (!authUsername) {
      setAuthUsername(authUser.data?.username ?? authUser.data?.user?.username ?? "");
    }
  }, [authUser.data?.user?.username, authUser.data?.username, authUsername]);

  useEffect(() => {
    const agentItems = normalizeRecordItems(agents.data?.agents ?? agents.data?.items ?? agents.data?.results ?? null, "agentId");
    if (!agentItems.some((item) => String(item.agentId ?? item.id ?? item.name ?? "") === selectedAgentId)) {
      const firstAgent = agentItems[0];
      setSelectedAgentId(String(firstAgent?.agentId ?? firstAgent?.id ?? firstAgent?.name ?? "main"));
    }
  }, [agents.data?.agents, agents.data?.items, agents.data?.results, selectedAgentId]);

  useEffect(() => {
    const detail = agentDetail.data?.agent ?? agentDetail.data?.item ?? agentDetail.data?.data;
    if (!detail) {
      return;
    }

    setAgentNameDraft(String(detail.name ?? detail.title ?? detail.id ?? selectedAgentId));
    setAgentModelDraft(String(detail.model ?? detail.defaultModel ?? ""));
    setAgentWorkspaceDraft(String(detail.workspace ?? detail.workspaceDir ?? ""));
  }, [agentDetail.data?.agent, agentDetail.data?.data, agentDetail.data?.item, selectedAgentId]);

  useEffect(() => {
    const fileItems = agentFiles.data?.files ?? [];
    if (!fileItems.some((item) => String(item.name ?? "") === selectedAgentFileName)) {
      setSelectedAgentFileName(String(fileItems[0]?.name ?? ""));
    }
  }, [agentFiles.data?.files, selectedAgentFileName]);

  useEffect(() => {
    const content = agentFile.data?.file?.content;
    if (typeof content === "string") {
      setAgentFilesContent(content);
    }
  }, [agentFile.data?.file]);

  useEffect(() => {
    const pendingItems = normalizeRecordItems(devicesPairing.data?.pending ?? devicesPairing.data?.requests ?? null, "requestId");
    if (!pendingItems.some((item) => String(item.requestId ?? item.id ?? item.name ?? "") === selectedDeviceRequestId)) {
      setSelectedDeviceRequestId(String(pendingItems[0]?.requestId ?? pendingItems[0]?.id ?? pendingItems[0]?.name ?? ""));
    }
  }, [devicesPairing.data?.pending, devicesPairing.data?.requests, selectedDeviceRequestId]);

  useEffect(() => {
    const pairedItems = normalizeRecordItems(devicesPairing.data?.paired ?? devicesPairing.data?.devices ?? null, "deviceId");
    if (!pairedItems.some((item) => String(item.deviceId ?? item.id ?? item.name ?? "") === selectedDeviceId)) {
      setSelectedDeviceId(String(pairedItems[0]?.deviceId ?? pairedItems[0]?.id ?? pairedItems[0]?.name ?? ""));
    }
  }, [devicesPairing.data?.devices, devicesPairing.data?.paired, selectedDeviceId]);

  useEffect(() => {
    setAuthOrderText((modelAuthOrder.data?.order ?? []).join("\n"));
  }, [modelAuthOrder.data?.order]);

  const bindingItems = useMemo(
    () => (bindings.data?.bindings ?? []).map((binding, index) => ({ ...binding, bindingIndex: index })),
    [bindings.data?.bindings],
  );

  useEffect(() => {
    if (!bindingItems.some((item) => String(item.bindingIndex) === selectedBindingIndex)) {
      setSelectedBindingIndex(bindingItems.length > 0 ? String(bindingItems[0]?.bindingIndex ?? "") : "");
    }
  }, [bindingItems, selectedBindingIndex]);

  useEffect(() => {
    const selectedBinding = bindingItems.find((item) => String(item.bindingIndex) === selectedBindingIndex) ?? null;
    if (selectedBinding) {
      setBindingPayloadText(JSON.stringify({ agentId: selectedBinding.agentId ?? "", match: selectedBinding.match ?? {} }, null, 2));
    }
  }, [bindingItems, selectedBindingIndex]);

  const environmentEntries = useMemo(
    () => Object.entries(environmentVariables.data?.env ?? {}),
    [environmentVariables.data?.env],
  );

  const authEffectiveUsername = useMemo(
    () => managedAuthRecord?.username ?? authUser.data?.username ?? authUser.data?.user?.username ?? authUsername,
    [authUser.data?.user?.username, authUser.data?.username, authUsername, managedAuthRecord?.username],
  );

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

  useEffect(() => {
    const detail = customSkillDetail.data?.skill ?? customSkillDetail.data?.item ?? customSkillDetail.data?.data;
    if (typeof detail?.content === "string") {
      setCustomSkillValidateContent(detail.content);
    }
  }, [customSkillDetail.data?.data, customSkillDetail.data?.item, customSkillDetail.data?.skill, selectedCustomSkill]);

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
      updateStatus.refresh({ refresh: forceFresh }),
      domain.refresh({ refresh: forceFresh }),
      domainIssuer.refresh({ refresh: forceFresh }),
      providers.refresh({ refresh: forceFresh }),
      providerModels.refresh({ refresh: forceFresh }),
      chatGptOAuthStatus.refresh({ refresh: forceFresh }),
      customProviders.refresh({ refresh: forceFresh }),
      channels.refresh({ refresh: forceFresh }),
      channelsStatus.refresh({ refresh: forceFresh }),
      channelsUpstream.refresh({ refresh: forceFresh }),
      channelCapabilities.refresh({ refresh: forceFresh }),
      channelLogs.refresh({ refresh: forceFresh }),
      plugins.refresh({ refresh: forceFresh }),
      pluginsInspect.refresh({ refresh: forceFresh }),
      pluginInspectDetail.refresh({ refresh: forceFresh }),
      hooks.refresh({ refresh: forceFresh }),
      hookCheck.refresh({ refresh: forceFresh }),
      hookDetail.refresh({ refresh: forceFresh }),
      skills.refresh({ refresh: forceFresh }),
      skillsStatus.refresh({ refresh: forceFresh }),
      skillsCheck.refresh({ refresh: forceFresh }),
      skillBins.refresh({ refresh: forceFresh }),
      skillDetail.refresh({ refresh: forceFresh }),
      customSkills.refresh({ refresh: forceFresh }),
      customSkillDetail.refresh({ refresh: forceFresh }),
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
      authUser.refresh({ refresh: forceFresh }),
      cronStatus.refresh({ refresh: forceFresh }),
      cronJobs.refresh({ refresh: forceFresh }),
      configSchema.refresh({ refresh: forceFresh }),
      configFile.refresh({ refresh: forceFresh }),
      bindings.refresh({ refresh: forceFresh }),
      environmentVariables.refresh({ refresh: forceFresh }),
      memoryStatus.refresh({ refresh: forceFresh }),
      doctorMemoryStatus.refresh({ refresh: forceFresh }),
      devicesLegacy.refresh({ refresh: forceFresh }),
      devicesPairing.refresh({ refresh: forceFresh }),
      agents.refresh({ refresh: forceFresh }),
      agentDetail.refresh({ refresh: forceFresh }),
      agentApiKeys.refresh({ refresh: forceFresh }),
      agentFiles.refresh({ refresh: forceFresh }),
      agentFile.refresh({ refresh: forceFresh }),
    ]);
  }, [agentApiKeys, agentDetail, agentFile, agentFiles, agents, authUser, bindings, channelCapabilities, channelLogs, channels, channelsStatus, channelsUpstream, chatGptOAuthStatus, config, configFile, configSchema, cronJobs, cronStatus, customProviders, customSkillDetail, customSkills, devicesLegacy, devicesPairing, directoryGroups, directoryMembers, directoryPeers, directorySelf, doctorMemoryStatus, domain, domainIssuer, environmentVariables, gatewayDiscover, gatewayUsage, hookCheck, hookDetail, hooks, imageFallbacks, info, logs, mcpServerDetail, mcpServers, memoryStatus, modelAliases, modelAuthOrder, modelFallbacks, modelsCatalog, modelsStatus, nodeDetail, nodesList, nodesStatus, pluginInspectDetail, plugins, pluginsInspect, providerModels, providers, secretsAudit, securityAudit, sessions, skillBins, skillDetail, skills, skillsCheck, skillsStatus, status, system, systemHeartbeatLast, systemPresence, updateStatus, upstream, version]);

  const handleManualRefresh = useCallback(async () => {
    try {
      await Promise.all([refreshAll(true), refreshEnvironments()]);
      toast.success("OpenClaw data refreshed");
    } catch {
      toast.error("Refresh completed with partial errors. Review the latest data panels.");
    }
  }, [refreshAll, refreshEnvironments]);

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
      updateStatus.fetchedAt,
      domain.fetchedAt,
      domainIssuer.fetchedAt,
      providers.fetchedAt,
      providerModels.fetchedAt,
      chatGptOAuthStatus.fetchedAt,
      customProviders.fetchedAt,
      channels.fetchedAt,
      channelsStatus.fetchedAt,
      channelsUpstream.fetchedAt,
      channelCapabilities.fetchedAt,
      channelLogs.fetchedAt,
      plugins.fetchedAt,
      pluginsInspect.fetchedAt,
      pluginInspectDetail.fetchedAt,
      hooks.fetchedAt,
      hookCheck.fetchedAt,
      hookDetail.fetchedAt,
      skills.fetchedAt,
      skillsStatus.fetchedAt,
      skillsCheck.fetchedAt,
      skillBins.fetchedAt,
      skillDetail.fetchedAt,
      customSkills.fetchedAt,
      customSkillDetail.fetchedAt,
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
      authUser.fetchedAt,
      cronStatus.fetchedAt,
      cronJobs.fetchedAt,
      configSchema.fetchedAt,
      configFile.fetchedAt,
      bindings.fetchedAt,
      environmentVariables.fetchedAt,
      memoryStatus.fetchedAt,
      doctorMemoryStatus.fetchedAt,
      devicesLegacy.fetchedAt,
      devicesPairing.fetchedAt,
      agents.fetchedAt,
      agentDetail.fetchedAt,
      agentApiKeys.fetchedAt,
      agentFiles.fetchedAt,
      agentFile.fetchedAt,
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
    customProviders.fetchedAt,
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
    chatGptOAuthStatus.fetchedAt,
    hookCheck.fetchedAt,
    hookDetail.fetchedAt,
    hooks.fetchedAt,
    imageFallbacks.fetchedAt,
    info.fetchedAt,
    logs.fetchedAt,
    mcpServerDetail.fetchedAt,
    mcpServers.fetchedAt,
    customSkillDetail.fetchedAt,
    customSkills.fetchedAt,
    modelAliases.fetchedAt,
    modelAuthOrder.fetchedAt,
    modelFallbacks.fetchedAt,
    modelsCatalog.fetchedAt,
    modelsStatus.fetchedAt,
    nodeDetail.fetchedAt,
    nodesList.fetchedAt,
    nodesStatus.fetchedAt,
    plugins.fetchedAt,
    pluginInspectDetail.fetchedAt,
    pluginsInspect.fetchedAt,
    providerModels.fetchedAt,
    providers.fetchedAt,
    sessions.fetchedAt,
    skillBins.fetchedAt,
    skillDetail.fetchedAt,
    skills.fetchedAt,
    skillsCheck.fetchedAt,
    skillsStatus.fetchedAt,
    status.fetchedAt,
    system.fetchedAt,
    systemHeartbeatLast.fetchedAt,
    systemPresence.fetchedAt,
    updateStatus.fetchedAt,
    secretsAudit.fetchedAt,
    securityAudit.fetchedAt,
    authUser.fetchedAt,
    cronStatus.fetchedAt,
    cronJobs.fetchedAt,
    configSchema.fetchedAt,
    configFile.fetchedAt,
    memoryStatus.fetchedAt,
    doctorMemoryStatus.fetchedAt,
    devicesLegacy.fetchedAt,
    devicesPairing.fetchedAt,
    agents.fetchedAt,
    agentDetail.fetchedAt,
    agentApiKeys.fetchedAt,
    agentFiles.fetchedAt,
    agentFile.fetchedAt,
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
      updateStatus.cacheStatus,
      domain.cacheStatus,
      domainIssuer.cacheStatus,
      providers.cacheStatus,
      providerModels.cacheStatus,
      chatGptOAuthStatus.cacheStatus,
      customProviders.cacheStatus,
      channels.cacheStatus,
      channelsStatus.cacheStatus,
      channelsUpstream.cacheStatus,
      channelCapabilities.cacheStatus,
      channelLogs.cacheStatus,
      plugins.cacheStatus,
      pluginsInspect.cacheStatus,
      pluginInspectDetail.cacheStatus,
      hooks.cacheStatus,
      hookCheck.cacheStatus,
      hookDetail.cacheStatus,
      skills.cacheStatus,
      skillsStatus.cacheStatus,
      skillsCheck.cacheStatus,
      skillBins.cacheStatus,
      skillDetail.cacheStatus,
      customSkills.cacheStatus,
      customSkillDetail.cacheStatus,
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
      authUser.cacheStatus,
      cronStatus.cacheStatus,
      cronJobs.cacheStatus,
      configSchema.cacheStatus,
      configFile.cacheStatus,
      bindings.cacheStatus,
      environmentVariables.cacheStatus,
      memoryStatus.cacheStatus,
      doctorMemoryStatus.cacheStatus,
      devicesLegacy.cacheStatus,
      devicesPairing.cacheStatus,
      agents.cacheStatus,
      agentDetail.cacheStatus,
      agentApiKeys.cacheStatus,
      agentFiles.cacheStatus,
      agentFile.cacheStatus,
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
    customProviders.cacheStatus,
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
    chatGptOAuthStatus.cacheStatus,
    hookCheck.cacheStatus,
    hookDetail.cacheStatus,
    hooks.cacheStatus,
    imageFallbacks.cacheStatus,
    info.cacheStatus,
    logs.cacheStatus,
    mcpServerDetail.cacheStatus,
    mcpServers.cacheStatus,
    customSkillDetail.cacheStatus,
    customSkills.cacheStatus,
    modelAliases.cacheStatus,
    modelAuthOrder.cacheStatus,
    modelFallbacks.cacheStatus,
    modelsCatalog.cacheStatus,
    modelsStatus.cacheStatus,
    nodeDetail.cacheStatus,
    nodesList.cacheStatus,
    nodesStatus.cacheStatus,
    plugins.cacheStatus,
    pluginInspectDetail.cacheStatus,
    pluginsInspect.cacheStatus,
    providerModels.cacheStatus,
    providers.cacheStatus,
    sessions.cacheStatus,
    skillBins.cacheStatus,
    skillDetail.cacheStatus,
    skills.cacheStatus,
    skillsCheck.cacheStatus,
    skillsStatus.cacheStatus,
    status.cacheStatus,
    system.cacheStatus,
    systemHeartbeatLast.cacheStatus,
    systemPresence.cacheStatus,
    updateStatus.cacheStatus,
    secretsAudit.cacheStatus,
    securityAudit.cacheStatus,
    authUser.cacheStatus,
    bindings.cacheStatus,
    cronStatus.cacheStatus,
    cronJobs.cacheStatus,
    configSchema.cacheStatus,
    configFile.cacheStatus,
    environmentVariables.cacheStatus,
    memoryStatus.cacheStatus,
    doctorMemoryStatus.cacheStatus,
    devicesLegacy.cacheStatus,
    devicesPairing.cacheStatus,
    agents.cacheStatus,
    agentDetail.cacheStatus,
    agentApiKeys.cacheStatus,
    agentFiles.cacheStatus,
    agentFile.cacheStatus,
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
      toast.error(formatOpenClawActionError(error, `Failed to ${action}`));
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
      toast.error(formatOpenClawActionError(error, "Failed to start upgrade"));
    } finally {
      setRuntimeBusy(null);
    }
  }, [logs, status, version]);

  const handleRunManagedUpdate = useCallback(async () => {
    setUpdateBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (updateNote.trim()) {
        payload.note = updateNote.trim();
      }
      const restartDelayMs = Number(updateRestartDelayMs);
      if (Number.isFinite(restartDelayMs) && restartDelayMs >= 0) {
        payload.restartDelayMs = restartDelayMs;
      }
      const timeoutMs = Number(updateTimeoutMs);
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        payload.timeoutMs = timeoutMs;
      }

      const result = await requestOpenClaw<UpdateRunResult>("/update/run", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setUpdateRunResult(result);
      toast.success(result.message ?? "Managed update started");
      await Promise.all([updateStatus.refresh({ refresh: true }), status.refresh({ refresh: true }), version.refresh({ refresh: true }), logs.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to run managed update"));
    } finally {
      setUpdateBusy(false);
    }
  }, [logs, status, updateNote, updateRestartDelayMs, updateStatus, updateTimeoutMs, version]);

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
      toast.error(formatOpenClawActionError(error, "Failed to update provider"));
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
      toast.error(formatOpenClawActionError(error, "API key validation failed"));
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
      toast.error(formatOpenClawActionError(error, "Failed to update API key"));
    } finally {
      setConfigBusy(false);
    }
  }, [apiKey, config, provider]);

  const handleDeleteApiKey = useCallback(async () => {
    if (!provider.trim()) {
      toast.error("Enter a provider first");
      return;
    }

    if (!window.confirm(`Delete API key for ${provider.trim()} in the active environment?`)) {
      return;
    }

    setConfigBusy(true);
    try {
      await requestOpenClaw("/config/api-key", {
        method: "DELETE",
        body: JSON.stringify({ provider: provider.trim(), agentId: "main" }),
      });
      toast.success(`API key removed for ${provider.trim()}`);
      await config.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to remove API key"));
    } finally {
      setConfigBusy(false);
    }
  }, [config, provider]);

  const handleCreateCustomProvider = useCallback(async () => {
    if (!customProviderBaseUrl.trim() || !customProviderModel.trim()) {
      toast.error("Enter both base URL and model");
      return;
    }

    setProviderAdminBusy("custom-provider-create");
    try {
      const payload: Record<string, unknown> = {
        baseUrl: customProviderBaseUrl.trim(),
        model: customProviderModel.trim(),
        api: customProviderApi.trim() || "openai-completions",
      };

      if (customProviderModelName.trim()) {
        payload.modelName = customProviderModelName.trim();
      }
      if (customProviderApiKey.trim()) {
        payload.apiKey = customProviderApiKey.trim();
      }

      const result = await requestOpenClaw<Record<string, unknown>>("/config/custom-provider", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const nextProvider = String(result.provider ?? result.name ?? result.slug ?? provider);
      const nextModel = String(result.model ?? customProviderModel.trim());

      toast.success(`Custom provider ${nextProvider} created`);
      setProvider(nextProvider);
      setModel(nextModel);
      setSelectedCustomProvider(nextProvider);
      setCustomProviderApiKey("");
      setCustomProviderClearApiKey(false);
      await Promise.all([
        customProviders.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        providerModels.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
        status.refresh({ refresh: true }),
        upstream.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create custom provider"));
    } finally {
      setProviderAdminBusy(null);
    }
  }, [config, customProviderApi, customProviderApiKey, customProviderBaseUrl, customProviderModel, customProviderModelName, customProviders, provider, providerModels, providers, status, upstream]);

  const handleUpdateCustomProvider = useCallback(async () => {
    if (!selectedCustomProvider.trim()) {
      toast.error("Select a custom provider first");
      return;
    }
    if (!customProviderBaseUrl.trim() || !customProviderModel.trim()) {
      toast.error("Enter both base URL and model");
      return;
    }

    setProviderAdminBusy("custom-provider-update");
    try {
      const payload: Record<string, unknown> = {
        baseUrl: customProviderBaseUrl.trim(),
        model: customProviderModel.trim(),
        api: customProviderApi.trim() || "openai-completions",
      };

      if (customProviderModelName.trim()) {
        payload.modelName = customProviderModelName.trim();
      }
      if (customProviderClearApiKey) {
        payload.apiKey = "";
      } else if (customProviderApiKey.trim()) {
        payload.apiKey = customProviderApiKey.trim();
      }

      const targetProvider = selectedCustomProvider.trim();
      const result = await requestOpenClaw<Record<string, unknown>>(`/config/custom-provider/${encodeURIComponent(targetProvider)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const nextProvider = String(result.provider ?? result.name ?? targetProvider);
      const nextModel = String(result.model ?? customProviderModel.trim());

      toast.success(`Custom provider ${nextProvider} updated`);
      setProvider(nextProvider);
      setModel(nextModel);
      setSelectedCustomProvider(nextProvider);
      setCustomProviderApiKey("");
      setCustomProviderClearApiKey(false);
      await Promise.all([
        customProviders.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        providerModels.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
        status.refresh({ refresh: true }),
        upstream.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update custom provider"));
    } finally {
      setProviderAdminBusy(null);
    }
  }, [config, customProviderApi, customProviderApiKey, customProviderBaseUrl, customProviderClearApiKey, customProviderModel, customProviderModelName, customProviders, providerModels, providers, selectedCustomProvider, status, upstream]);

  const handleDeleteCustomProvider = useCallback(async () => {
    if (!selectedCustomProvider.trim()) {
      toast.error("Select a custom provider first");
      return;
    }

    const targetProvider = selectedCustomProvider.trim();
    if (!window.confirm(`Delete custom provider ${targetProvider}?`)) {
      return;
    }

    setProviderAdminBusy("custom-provider-delete");
    try {
      await requestOpenClaw(`/config/custom-provider/${encodeURIComponent(targetProvider)}`, { method: "DELETE" });
      toast.success(`Custom provider ${targetProvider} deleted`);
      setSelectedCustomProvider("");
      setCustomProviderApiKey("");
      setCustomProviderClearApiKey(false);
      await Promise.all([
        customProviders.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        providerModels.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
        status.refresh({ refresh: true }),
        upstream.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete custom provider"));
    } finally {
      setProviderAdminBusy(null);
    }
  }, [config, customProviders, providerModels, providers, selectedCustomProvider, status, upstream]);

  const handleAddProviderModel = useCallback(async () => {
    if (!provider.trim() || !providerModelIdDraft.trim()) {
      toast.error("Enter both provider and model ID");
      return;
    }

    setProviderAdminBusy("provider-model-add");
    try {
      const payload: Record<string, unknown> = { id: providerModelIdDraft.trim() };
      if (providerModelNameDraft.trim()) {
        payload.name = providerModelNameDraft.trim();
      }

      await requestOpenClaw(`/providers/${encodeURIComponent(provider.trim())}/models`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success(`Model ${providerModelIdDraft.trim()} added to ${provider.trim()}`);
      setModel(providerModelIdDraft.trim());
      setProviderModelIdDraft("");
      setProviderModelNameDraft("");
      await Promise.all([
        providerModels.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to add provider model"));
    } finally {
      setProviderAdminBusy(null);
    }
  }, [config, provider, providerModelIdDraft, providerModelNameDraft, providerModels, providers]);

  const handleDeleteProviderModel = useCallback(async () => {
    if (!provider.trim() || !providerModelIdDraft.trim()) {
      toast.error("Enter both provider and model ID");
      return;
    }

    if (!window.confirm(`Delete model ${providerModelIdDraft.trim()} from ${provider.trim()}?`)) {
      return;
    }

    setProviderAdminBusy("provider-model-delete");
    try {
      await requestOpenClaw(`/providers/${encodeURIComponent(provider.trim())}/models/${encodeURIComponent(providerModelIdDraft.trim())}`, {
        method: "DELETE",
      });

      toast.success(`Model ${providerModelIdDraft.trim()} removed from ${provider.trim()}`);
      setProviderModelIdDraft("");
      setProviderModelNameDraft("");
      await Promise.all([
        providerModels.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to remove provider model"));
    } finally {
      setProviderAdminBusy(null);
    }
  }, [config, provider, providerModelIdDraft, providerModels, providers]);

  const handleStartChatGptOAuth = useCallback(async () => {
    if (!chatGptOAuthAgentId.trim()) {
      toast.error("Enter an agent ID first");
      return;
    }

    setChatGptOAuthBusy("start");
    try {
      const result = await requestOpenClaw<ChatGptOAuthStartInfo>("/config/chatgpt-oauth/start", {
        method: "POST",
        body: JSON.stringify({ agentId: chatGptOAuthAgentId.trim() }),
      });

      setChatGptOAuthStartResult(result);
      setChatGptOAuthSessionId(String(result.sessionId ?? ""));
      toast.success(`OAuth started for ${chatGptOAuthAgentId.trim()}`);
      await chatGptOAuthStatus.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to start ChatGPT OAuth"));
    } finally {
      setChatGptOAuthBusy(null);
    }
  }, [chatGptOAuthAgentId, chatGptOAuthStatus]);

  const handleCompleteChatGptOAuth = useCallback(async () => {
    if (!chatGptOAuthSessionId.trim() || !chatGptOAuthRedirectUrl.trim()) {
      toast.error("Enter both session ID and redirect URL");
      return;
    }

    setChatGptOAuthBusy("complete");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>("/config/chatgpt-oauth/complete", {
        method: "POST",
        body: JSON.stringify({
          sessionId: chatGptOAuthSessionId.trim(),
          redirectUrl: chatGptOAuthRedirectUrl.trim(),
          model: chatGptOAuthModel.trim() || undefined,
          switchProvider: chatGptOAuthSwitchProvider,
        }),
      });

      toast.success(`ChatGPT OAuth completed for ${chatGptOAuthAgentId.trim()}`);
      if (chatGptOAuthSwitchProvider) {
        setProvider(String(result.provider ?? "openai-codex"));
        if (chatGptOAuthModel.trim()) {
          setModel(chatGptOAuthModel.trim());
        }
      }
      await Promise.all([
        chatGptOAuthStatus.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
        providers.refresh({ refresh: true }),
        providerModels.refresh({ refresh: true }),
        status.refresh({ refresh: true }),
        upstream.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to complete ChatGPT OAuth"));
    } finally {
      setChatGptOAuthBusy(null);
    }
  }, [chatGptOAuthAgentId, chatGptOAuthModel, chatGptOAuthRedirectUrl, chatGptOAuthSessionId, chatGptOAuthStatus, chatGptOAuthSwitchProvider, config, providerModels, providers, status, upstream]);

  const handleRefreshChatGptOAuth = useCallback(async () => {
    if (!chatGptOAuthAgentId.trim()) {
      toast.error("Enter an agent ID first");
      return;
    }

    setChatGptOAuthBusy("refresh");
    try {
      await requestOpenClaw("/config/chatgpt-oauth/refresh", {
        method: "POST",
        body: JSON.stringify({ agentId: chatGptOAuthAgentId.trim() }),
      });

      toast.success(`OAuth token refreshed for ${chatGptOAuthAgentId.trim()}`);
      await Promise.all([
        chatGptOAuthStatus.refresh({ refresh: true }),
        config.refresh({ refresh: true }),
      ]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to refresh ChatGPT OAuth token"));
    } finally {
      setChatGptOAuthBusy(null);
    }
  }, [chatGptOAuthAgentId, chatGptOAuthStatus, config]);

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
      toast.error(formatOpenClawActionError(error, "Cleanup failed"));
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
      toast.error(formatOpenClawActionError(error, "Domain preflight failed"));
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
      toast.error(formatOpenClawActionError(error, "Failed to update domain"));
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
      try {
        await recordBackupHistory({
          action: "create",
          archivePath: typeof result.archive === "string" ? result.archive : backupOutput.trim() || undefined,
          verified: typeof result.verified === "boolean" ? result.verified : null,
          status: result.ok === false ? "failed" : "completed",
          message: result.message ?? "Backup request completed",
          payload: result,
        });
      } catch {
        // Ignore local history persistence failures so the primary action still succeeds.
      }
      toast.success(result.message ?? "Backup request completed");
    } catch (error) {
      void recordBackupHistory({
        action: "create",
        archivePath: backupOutput.trim() || undefined,
        status: "failed",
        message: formatOpenClawActionError(error, "Backup failed"),
      }).catch(() => undefined);
      toast.error(formatOpenClawActionError(error, "Backup failed"));
    } finally {
      setBackupBusy(null);
    }
  }, [backupDryRun, backupOnlyConfig, backupOutput, backupVerifyAfterCreate, recordBackupHistory]);

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
      try {
        await recordBackupHistory({
          action: "verify",
          archivePath: backupVerifyPath.trim(),
          verified: typeof result.verified === "boolean" ? result.verified : true,
          status: result.ok === false ? "failed" : "completed",
          message: result.message ?? "Backup verification completed",
          payload: result,
        });
      } catch {
        // Ignore local history persistence failures so the primary action still succeeds.
      }
      toast.success(result.message ?? "Backup verification completed");
    } catch (error) {
      void recordBackupHistory({
        action: "verify",
        archivePath: backupVerifyPath.trim(),
        verified: false,
        status: "failed",
        message: formatOpenClawActionError(error, "Backup verification failed"),
      }).catch(() => undefined);
      toast.error(formatOpenClawActionError(error, "Backup verification failed"));
    } finally {
      setBackupBusy(null);
    }
  }, [backupVerifyPath, recordBackupHistory]);

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
      toast.error(formatOpenClawActionError(error, "Failed to update channel"));
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
      toast.error(formatOpenClawActionError(error, "Failed to remove channel"));
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
      toast.error(formatOpenClawActionError(error, "Failed to resolve channel targets"));
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
      toast.error(formatOpenClawActionError(error, "Failed to save MCP server"));
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
      toast.error(formatOpenClawActionError(error, "Failed to remove MCP server"));
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
      await Promise.all([plugins.refresh(), pluginsInspect.refresh(), pluginInspectDetail.refresh()]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, `Failed to ${enabled ? "enable" : "disable"} plugin`));
    } finally {
      setPluginBusy(null);
    }
  }, [pluginInspectDetail, plugins, pluginsInspect, selectedPlugin]);

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
      toast.error(formatOpenClawActionError(error, "Failed to post system event"));
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
      toast.error(formatOpenClawActionError(error, `Failed to ${enabled ? "enable" : "disable"} heartbeat`));
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
      toast.error(formatOpenClawActionError(error, "Failed to reload secrets"));
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

  const handleReset = useCallback(async () => {
    if (resetConfirmText.trim() !== "RESET") {
      toast.error('Type RESET to confirm destructive reset');
      return;
    }

    setRuntimeBusy("reset");
    try {
      const result = await requestOpenClaw<{ message?: string }>("/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: "RESET" }),
      });
      toast.success(result.message ?? "Reset dispatched");
      setResetConfirmText("");
      await refreshAll(true);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to reset service"));
    } finally {
      setRuntimeBusy(null);
    }
  }, [refreshAll, resetConfirmText]);

  const handleCreateAuthUser = useCallback(async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      toast.error("Enter both username and password");
      return;
    }

    setAuthBusy("create");
    try {
      await requestOpenClaw("/auth/create-user", {
        method: "POST",
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });
      await saveManagedAuthRecord(authUsername.trim(), authPassword);
      toast.success(`Login user ${authUsername.trim()} created`);
      setAuthPassword("");
      await authUser.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create login user"));
    } finally {
      setAuthBusy(null);
    }
  }, [authPassword, authUser, authUsername, saveManagedAuthRecord]);

  const handleChangeAuthPassword = useCallback(async () => {
    if (!authNewPassword.trim()) {
      toast.error("Enter a new password first");
      return;
    }

    setAuthBusy("password");
    try {
      await requestOpenClaw("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ password: authNewPassword }),
      });
      await saveManagedAuthRecord(authEffectiveUsername.trim() || authUsername.trim(), authNewPassword);
      toast.success("Login password updated");
      setAuthNewPassword("");
      await authUser.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update password"));
    } finally {
      setAuthBusy(null);
    }
  }, [authEffectiveUsername, authNewPassword, authUser, authUsername, saveManagedAuthRecord]);

  const handleDeleteAuthUser = useCallback(async () => {
    const username = authUser.data?.username ?? authUser.data?.user?.username ?? authUsername;
    if (!window.confirm(`Delete login user ${username || "configured user"}?`)) {
      return;
    }

    setAuthBusy("delete");
    try {
      await requestOpenClaw("/auth/user", { method: "DELETE" });
      await removeManagedAuthRecord();
      toast.success("Login user removed");
      setAuthNewPassword("");
      setAuthPassword("");
      await authUser.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete login user"));
    } finally {
      setAuthBusy(null);
    }
  }, [authUser, authUsername, removeManagedAuthRecord]);

  const handleCreateCronJob = useCallback(async () => {
    setCronBusy("create");
    try {
      const payload = parseJsonObjectInput(cronCreateText, "Cron job payload");
      await requestOpenClaw("/cron/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Cron job created");
      await Promise.all([cronStatus.refresh({ refresh: true }), cronJobs.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create cron job"));
    } finally {
      setCronBusy(null);
    }
  }, [cronCreateText, cronJobs, cronStatus]);

  const handlePatchCronJob = useCallback(async () => {
    if (!selectedCronJob.trim()) {
      toast.error("Choose a cron job first");
      return;
    }

    setCronBusy("patch");
    try {
      const payload = parseJsonObjectInput(cronPatchText, "Cron patch payload");
      await requestOpenClaw(`/cron/jobs/${encodeURIComponent(selectedCronJob.trim())}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(`Cron job ${selectedCronJob.trim()} updated`);
      await Promise.all([cronStatus.refresh({ refresh: true }), cronJobs.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to patch cron job"));
    } finally {
      setCronBusy(null);
    }
  }, [cronJobs, cronPatchText, cronStatus, selectedCronJob]);

  const handleRunCronJob = useCallback(async () => {
    if (!selectedCronJob.trim()) {
      toast.error("Choose a cron job first");
      return;
    }

    setCronBusy("run");
    try {
      await requestOpenClaw(`/cron/jobs/${encodeURIComponent(selectedCronJob.trim())}/run`, {
        method: "POST",
        body: JSON.stringify({ mode: cronRunMode }),
      });
      toast.success(`Cron job ${selectedCronJob.trim()} executed`);
      await Promise.all([cronStatus.refresh({ refresh: true }), cronJobs.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to run cron job"));
    } finally {
      setCronBusy(null);
    }
  }, [cronJobs, cronRunMode, cronStatus, selectedCronJob]);

  const handleLookupConfig = useCallback(async () => {
    if (!configLookupPath.trim()) {
      toast.error("Enter a config path first");
      return;
    }

    setConfigAdvancedBusy("lookup");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/config/schema/lookup?path=${encodeURIComponent(configLookupPath.trim())}`);
      setConfigLookupResult(result);
      toast.success("Config path loaded");
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to lookup config path"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [configLookupPath]);

  const handleGetConfigValue = useCallback(async () => {
    if (!configLookupPath.trim()) {
      toast.error("Enter a config path first");
      return;
    }

    setConfigAdvancedBusy("get");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/config/get?path=${encodeURIComponent(configLookupPath.trim())}`);
      setConfigGetResult(result);
      toast.success("Config value loaded");
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to load config value"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [configLookupPath]);

  const handleValidateConfig = useCallback(async () => {
    setConfigAdvancedBusy("validate");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>("/config/validate");
      setConfigValidationResult(result);
      toast.success("Config validation completed");
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Config validation failed"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, []);

  const handlePatchConfig = useCallback(async () => {
    setConfigAdvancedBusy("patch");
    try {
      const patch = parseJsonObjectInput(configPatchText, "Config patch");
      await requestOpenClaw("/config", {
        method: "PATCH",
        body: JSON.stringify({ patch, restart: configPatchRestart }),
      });
      toast.success("Config patch applied");
      await Promise.all([config.refresh({ refresh: true }), configSchema.refresh({ refresh: true }), configFile.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to patch config"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [config, configFile, configPatchRestart, configPatchText, configSchema]);

  const handleSetRawConfigPath = useCallback(async () => {
    if (!configRawPath.trim()) {
      toast.error("Enter a config path first");
      return;
    }

    setConfigAdvancedBusy("raw");
    try {
      const body: Record<string, unknown> = {
        path: configRawPath.trim(),
        restart: false,
      };

      if (configRawRemove) {
        body.remove = true;
      } else {
        body.value = parseJsonValueInput(configRawValueText, "Config raw value");
      }

      await requestOpenClaw("/config/raw", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast.success(`Config path ${configRawPath.trim()} updated`);
      await Promise.all([config.refresh({ refresh: true }), configSchema.refresh({ refresh: true }), configFile.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update raw config path"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [config, configFile, configRawPath, configRawRemove, configRawValueText, configSchema]);

  const handleUnsetConfigValue = useCallback(async () => {
    if (!configRawPath.trim()) {
      toast.error("Enter a config path first");
      return;
    }

    setConfigAdvancedBusy("unset");
    try {
      await requestOpenClaw("/config/unset", {
        method: "DELETE",
        body: JSON.stringify({
          path: configRawPath.trim(),
          restart: false,
        }),
      });
      toast.success(`Config path ${configRawPath.trim()} removed`);
      await Promise.all([config.refresh({ refresh: true }), configSchema.refresh({ refresh: true }), configFile.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to unset config value"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [config, configFile, configRawPath, configSchema]);

  const handleApplyConfig = useCallback(async () => {
    setConfigAdvancedBusy("apply");
    try {
      await requestOpenClaw("/config/apply", {
        method: "POST",
        body: JSON.stringify({ restartTarget: configApplyTarget }),
      });
      toast.success(`Configuration applied (${configApplyTarget})`);
      await refreshAll(true);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to apply config"));
    } finally {
      setConfigAdvancedBusy(null);
    }
  }, [configApplyTarget, refreshAll]);

  const handleCreateBinding = useCallback(async () => {
    setBindingsBusy("create");
    try {
      const payload = parseJsonObjectInput(bindingPayloadText, "Binding payload");
      const result = await requestOpenClaw<Record<string, unknown>>("/bindings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBindingActionResult(result);
      toast.success("Binding created");
      await bindings.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create binding"));
    } finally {
      setBindingsBusy(null);
    }
  }, [bindingPayloadText, bindings]);

  const handleUpdateBinding = useCallback(async () => {
    if (!selectedBindingIndex.trim()) {
      toast.error("Choose a binding first");
      return;
    }

    setBindingsBusy("update");
    try {
      const payload = parseJsonObjectInput(bindingPayloadText, "Binding payload");
      const result = await requestOpenClaw<Record<string, unknown>>(`/bindings/${encodeURIComponent(selectedBindingIndex.trim())}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setBindingActionResult(result);
      toast.success(`Binding ${selectedBindingIndex.trim()} updated`);
      await bindings.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update binding"));
    } finally {
      setBindingsBusy(null);
    }
  }, [bindingPayloadText, bindings, selectedBindingIndex]);

  const handleDeleteBinding = useCallback(async () => {
    if (!selectedBindingIndex.trim()) {
      toast.error("Choose a binding first");
      return;
    }
    if (!window.confirm(`Delete binding ${selectedBindingIndex.trim()}?`)) {
      return;
    }

    setBindingsBusy("delete");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/bindings/${encodeURIComponent(selectedBindingIndex.trim())}`, {
        method: "DELETE",
      });
      setBindingActionResult(result);
      toast.success(`Binding ${selectedBindingIndex.trim()} deleted`);
      await bindings.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete binding"));
    } finally {
      setBindingsBusy(null);
    }
  }, [bindings, selectedBindingIndex]);

  const handleSetEnvironmentVariable = useCallback(async () => {
    if (!envKeyDraft.trim()) {
      toast.error("Enter an environment variable key first");
      return;
    }

    setEnvironmentBusy("set");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/env/${encodeURIComponent(envKeyDraft.trim())}`, {
        method: "PUT",
        body: JSON.stringify({ value: envValueDraft }),
      });
      setEnvironmentActionResult(result);
      toast.success(`Environment variable ${envKeyDraft.trim()} saved`);
      await environmentVariables.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to save environment variable"));
    } finally {
      setEnvironmentBusy(null);
    }
  }, [envKeyDraft, envValueDraft, environmentVariables]);

  const handleDeleteEnvironmentVariable = useCallback(async (key?: string) => {
    const targetKey = (key ?? envKeyDraft).trim();
    if (!targetKey) {
      toast.error("Choose an environment variable first");
      return;
    }
    if (!window.confirm(`Delete environment variable ${targetKey}?`)) {
      return;
    }

    setEnvironmentBusy("delete");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/env/${encodeURIComponent(targetKey)}`, {
        method: "DELETE",
      });
      setEnvironmentActionResult(result);
      toast.success(`Environment variable ${targetKey} deleted`);
      await environmentVariables.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete environment variable"));
    } finally {
      setEnvironmentBusy(null);
    }
  }, [envKeyDraft, environmentVariables]);

  const handleRunCliCommand = useCallback(async () => {
    if (!cliCommand.trim()) {
      toast.error("Enter a CLI command first");
      return;
    }

    setCliBusy(true);
    try {
      const result = await requestOpenClaw<CliProxyResult>("/cli", {
        method: "POST",
        body: JSON.stringify({ command: cliCommand.trim() }),
      });
      setCliResult(result);
      if (result.ok === false) {
        toast.error("CLI command returned an error result");
      } else {
        toast.success("CLI command completed");
      }
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to run CLI command"));
    } finally {
      setCliBusy(false);
    }
  }, [cliCommand]);

  const handleSelfUpdate = useCallback(async () => {
    if (!window.confirm("Run OpenClaw self update? The management API may restart during this operation.")) {
      return;
    }

    setSelfUpdateBusy(true);
    try {
      const result = await requestOpenClaw<SelfUpdateResult>("/self-update", {
        method: "POST",
      });
      setSelfUpdateResult(result);
      toast.success(result.message ?? "Self update started");
      await refreshAll(true);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to run self update"));
    } finally {
      setSelfUpdateBusy(false);
    }
  }, [refreshAll]);

  const handleReindexMemory = useCallback(async () => {
    setMemoryBusy("index");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>("/memory/index", {
        method: "POST",
        body: JSON.stringify({
          agentId: memoryAgentId.trim() || "main",
          force: memoryIndexForce,
          timeoutMs: 120000,
        }),
      });
      setMemoryIndexResult(result);
      toast.success("Memory reindex started");
      await Promise.all([memoryStatus.refresh({ refresh: true }), doctorMemoryStatus.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Memory reindex failed"));
    } finally {
      setMemoryBusy(null);
    }
  }, [doctorMemoryStatus, memoryAgentId, memoryIndexForce, memoryStatus]);

  const handleSearchMemory = useCallback(async () => {
    if (!memorySearchQuery.trim()) {
      toast.error("Enter a memory query first");
      return;
    }

    setMemoryBusy("search");
    try {
      const query = new URLSearchParams({
        query: memorySearchQuery.trim(),
        agentId: memoryAgentId.trim() || "main",
        maxResults: String(memorySearchMaxResults),
      });
      const result = await requestOpenClaw<MemorySearchInfo>(`/memory/search?${query.toString()}`);
      setMemorySearchResult(result);
      const count = (result.results ?? result.items ?? result.matches ?? []).length;
      toast.success(`Found ${count} memory result${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Memory search failed"));
    } finally {
      setMemoryBusy(null);
    }
  }, [memoryAgentId, memorySearchMaxResults, memorySearchQuery]);

  const handleApproveDeviceLegacy = useCallback(async () => {
    if (!selectedDeviceRequestId.trim()) {
      toast.error("Choose a device request first");
      return;
    }

    setDevicesBusy("approve-legacy");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/devices/approve/${encodeURIComponent(selectedDeviceRequestId.trim())}`, {
        method: "POST",
      });
      setDeviceActionResult(result);
      toast.success(`Approved legacy request ${selectedDeviceRequestId.trim()}`);
      await Promise.all([devicesLegacy.refresh({ refresh: true }), devicesPairing.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to approve legacy device request"));
    } finally {
      setDevicesBusy(null);
    }
  }, [devicesLegacy, devicesPairing, selectedDeviceRequestId]);

  const handleDevicePairingAction = useCallback(async (action: "approve" | "reject") => {
    if (!selectedDeviceRequestId.trim()) {
      toast.error("Choose a pairing request first");
      return;
    }

    setDevicesBusy(`pair-${action}`);
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/devices/pairing/${action}`, {
        method: "POST",
        body: JSON.stringify({ requestId: selectedDeviceRequestId.trim() }),
      });
      setDeviceActionResult(result);
      toast.success(`Pairing request ${action}d`);
      await devicesPairing.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, `Failed to ${action} pairing request`));
    } finally {
      setDevicesBusy(null);
    }
  }, [devicesPairing, selectedDeviceRequestId]);

  const handleRemovePairedDevice = useCallback(async () => {
    if (!selectedDeviceId.trim()) {
      toast.error("Choose a paired device first");
      return;
    }

    setDevicesBusy("remove-device");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/devices/${encodeURIComponent(selectedDeviceId.trim())}/pairing`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      setDeviceActionResult(result);
      toast.success(`Removed paired device ${selectedDeviceId.trim()}`);
      await devicesPairing.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to remove paired device"));
    } finally {
      setDevicesBusy(null);
    }
  }, [devicesPairing, selectedDeviceId]);

  const handleDeviceTokenAction = useCallback(async (action: "rotate" | "revoke") => {
    if (!selectedDeviceId.trim()) {
      toast.error("Choose a paired device first");
      return;
    }

    setDevicesBusy(`token-${action}`);
    try {
      const body: Record<string, unknown> = { role: deviceTokenRole.trim() || "operator" };
      if (action === "rotate") {
        body.scopes = deviceTokenScopesText
          .split(/\r?\n|,/) 
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
      const result = await requestOpenClaw<Record<string, unknown>>(`/devices/${encodeURIComponent(selectedDeviceId.trim())}/tokens/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDeviceActionResult(result);
      toast.success(`Device token ${action}d`);
      await devicesPairing.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, `Failed to ${action} device token`));
    } finally {
      setDevicesBusy(null);
    }
  }, [deviceTokenRole, deviceTokenScopesText, devicesPairing, selectedDeviceId]);

  const handleCreateAgent = useCallback(async () => {
    if (!agentCreateId.trim() || !agentCreateName.trim()) {
      toast.error("Enter agent id and name");
      return;
    }

    setAgentsBusy("create-agent");
    try {
      await requestOpenClaw("/agents", {
        method: "POST",
        body: JSON.stringify({
          id: agentCreateId.trim(),
          name: agentCreateName.trim(),
          model: agentCreateModel.trim() || undefined,
          default: agentCreateDefault,
        }),
      });
      toast.success(`Agent ${agentCreateId.trim()} created`);
      setSelectedAgentId(agentCreateId.trim());
      await agents.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create agent"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentCreateDefault, agentCreateId, agentCreateModel, agentCreateName, agents]);

  const handleUpdateAgent = useCallback(async () => {
    if (!selectedAgentId.trim()) {
      toast.error("Choose an agent first");
      return;
    }

    setAgentsBusy("update-agent");
    try {
      await requestOpenClaw(`/agents/${encodeURIComponent(selectedAgentId.trim())}`, {
        method: "PUT",
        body: JSON.stringify({
          name: agentNameDraft.trim() || undefined,
          model: agentModelDraft.trim() || undefined,
          workspace: agentWorkspaceDraft.trim() || undefined,
        }),
      });
      toast.success(`Agent ${selectedAgentId.trim()} updated`);
      await Promise.all([agents.refresh({ refresh: true }), agentDetail.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update agent"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentDetail, agentModelDraft, agentNameDraft, agentWorkspaceDraft, agents, selectedAgentId]);

  const handleDeleteAgent = useCallback(async () => {
    if (!selectedAgentId.trim()) {
      toast.error("Choose an agent first");
      return;
    }

    setAgentsBusy("delete-agent");
    try {
      await requestOpenClaw(`/agents/${encodeURIComponent(selectedAgentId.trim())}`, {
        method: "DELETE",
        body: JSON.stringify({ deleteData: agentDeleteData }),
      });
      toast.success(`Agent ${selectedAgentId.trim()} deleted`);
      await Promise.all([agents.refresh({ refresh: true }), agentDetail.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete agent"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentDeleteData, agentDetail, agents, selectedAgentId]);

  const handleSetDefaultAgent = useCallback(async () => {
    if (!selectedAgentId.trim()) {
      toast.error("Choose an agent first");
      return;
    }

    setAgentsBusy("default-agent");
    try {
      await requestOpenClaw(`/agents/${encodeURIComponent(selectedAgentId.trim())}/default`, { method: "PUT" });
      toast.success(`Agent ${selectedAgentId.trim()} set as default`);
      await Promise.all([agents.refresh({ refresh: true }), agentDetail.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to set default agent"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentDetail, agents, selectedAgentId]);

  const handleSaveAgentApiKey = useCallback(async () => {
    if (!selectedAgentId.trim() || !agentApiKeyProvider.trim() || !agentApiKeyValue.trim()) {
      toast.error("Enter agent, provider, and API key");
      return;
    }

    setAgentsBusy("agent-api-key");
    try {
      await requestOpenClaw(`/agents/${encodeURIComponent(selectedAgentId.trim())}/api-key`, {
        method: "PUT",
        body: JSON.stringify({ provider: agentApiKeyProvider.trim(), apiKey: agentApiKeyValue.trim() }),
      });
      toast.success(`Saved API key for ${agentApiKeyProvider.trim()}`);
      setAgentApiKeyValue("");
      await agentApiKeys.refresh({ refresh: true });
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to save agent API key"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentApiKeyProvider, agentApiKeyValue, agentApiKeys, selectedAgentId]);

  const handleSaveAgentFile = useCallback(async () => {
    if (!selectedAgentId.trim() || !selectedAgentFileName.trim()) {
      toast.error("Choose an agent and file first");
      return;
    }

    setAgentsBusy("agent-file");
    try {
      await requestOpenClaw(`/agents/${encodeURIComponent(selectedAgentId.trim())}/files/${encodeURIComponent(selectedAgentFileName.trim())}`, {
        method: "PUT",
        body: JSON.stringify({ content: agentFilesContent }),
      });
      toast.success(`Saved ${selectedAgentFileName.trim()}`);
      await Promise.all([agentFiles.refresh({ refresh: true }), agentFile.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to save agent workspace file"));
    } finally {
      setAgentsBusy(null);
    }
  }, [agentFile, agentFiles, agentFilesContent, selectedAgentFileName, selectedAgentId]);

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
      toast.error(formatOpenClawActionError(error, `Failed to ${enabled ? "enable" : "disable"} hook`));
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
      toast.error(formatOpenClawActionError(error, "Skill search failed"));
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
      toast.error(formatOpenClawActionError(error, "Skill update failed"));
    } finally {
      setSkillUpdateBusy(false);
    }
  }, [selectedSkill, skillApiKey, skillBins, skillConfigText, skillDetail, skillEnabled, skillEnvText, skillRestart, skills, skillsStatus]);

  const handleCreateCustomSkill = useCallback(async () => {
    setCustomSkillBusy("create");
    try {
      const payload = parseJsonObjectInput(customSkillPayloadText, "Custom skill payload");
      payload.agentId = String(payload.agentId ?? skillAgentId ?? "main");

      const result = await requestOpenClaw<Record<string, unknown>>("/skills/custom", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCustomSkillActionResult(result);
      setSelectedCustomSkill(String(result.skillKey ?? payload.skillKey ?? ""));
      toast.success(String(result.message ?? "Custom skill created successfully."));
      await Promise.all([customSkills.refresh({ refresh: true }), customSkillDetail.refresh({ refresh: true }), skills.refresh({ refresh: true }), skillsStatus.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to create custom skill"));
    } finally {
      setCustomSkillBusy(null);
    }
  }, [customSkillDetail, customSkillPayloadText, customSkills, skillAgentId, skills, skillsStatus]);

  const handleUpdateCustomSkill = useCallback(async () => {
    if (!selectedCustomSkill.trim()) {
      toast.error("Choose a custom skill first");
      return;
    }

    setCustomSkillBusy("update");
    try {
      const payload = parseJsonObjectInput(customSkillPayloadText, "Custom skill payload");
      payload.agentId = String(payload.agentId ?? skillAgentId ?? "main");

      const result = await requestOpenClaw<Record<string, unknown>>(`/skills/custom/${encodeURIComponent(selectedCustomSkill.trim())}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setCustomSkillActionResult(result);
      toast.success(`Custom skill ${selectedCustomSkill.trim()} updated`);
      await Promise.all([customSkills.refresh({ refresh: true }), customSkillDetail.refresh({ refresh: true }), skills.refresh({ refresh: true }), skillsStatus.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to update custom skill"));
    } finally {
      setCustomSkillBusy(null);
    }
  }, [customSkillDetail, customSkillPayloadText, customSkills, selectedCustomSkill, skillAgentId, skills, skillsStatus]);

  const handleDeleteCustomSkill = useCallback(async () => {
    if (!selectedCustomSkill.trim()) {
      toast.error("Choose a custom skill first");
      return;
    }

    if (!window.confirm(`Delete custom skill ${selectedCustomSkill.trim()}?`)) {
      return;
    }

    setCustomSkillBusy("delete");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>(`/skills/custom/${encodeURIComponent(selectedCustomSkill.trim())}?agentId=${encodeURIComponent(skillAgentId || "main")}`, {
        method: "DELETE",
      });

      setCustomSkillActionResult(result);
      setSelectedCustomSkill("");
      toast.success(`Custom skill ${selectedCustomSkill.trim()} deleted`);
      await Promise.all([customSkills.refresh({ refresh: true }), customSkillDetail.refresh({ refresh: true }), skills.refresh({ refresh: true }), skillsStatus.refresh({ refresh: true })]);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to delete custom skill"));
    } finally {
      setCustomSkillBusy(null);
    }
  }, [customSkillDetail, customSkills, selectedCustomSkill, skillAgentId, skills, skillsStatus]);

  const handleValidateCustomSkill = useCallback(async () => {
    const payload = parseJsonObjectInput(customSkillPayloadText, "Custom skill payload");
    const skillKey = String(payload.skillKey ?? selectedCustomSkill ?? "").trim();
    if (!skillKey || !customSkillValidateContent.trim()) {
      toast.error("Provide a custom skill key and markdown content");
      return;
    }

    setCustomSkillBusy("validate");
    try {
      const result = await requestOpenClaw<Record<string, unknown>>("/skills/custom/validate", {
        method: "POST",
        body: JSON.stringify({ skillKey, content: customSkillValidateContent }),
      });

      setCustomSkillValidateResult(result);
      toast.success(`Validation completed for ${skillKey}`);
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to validate custom skill markdown"));
    } finally {
      setCustomSkillBusy(null);
    }
  }, [customSkillPayloadText, customSkillValidateContent, selectedCustomSkill]);

  const handleRenderCustomSkill = useCallback(async () => {
    setCustomSkillBusy("render");
    try {
      const payload = parseJsonObjectInput(customSkillPayloadText, "Custom skill payload");
      const result = await requestOpenClaw<Record<string, unknown>>("/skills/custom/render", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCustomSkillRenderResult(result);
      toast.success("Custom skill markdown rendered");
    } catch (error) {
      toast.error(formatOpenClawActionError(error, "Failed to render custom skill markdown"));
    } finally {
      setCustomSkillBusy(null);
    }
  }, [customSkillPayloadText]);

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
      toast.error(formatOpenClawActionError(error, "Model update failed"));
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
      toast.error(formatOpenClawActionError(error, "Failed to save auth order"));
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
      toast.error(formatOpenClawActionError(error, "Failed to clear auth order"));
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
      toast.error(formatOpenClawActionError(error, "Failed to save alias"));
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
      toast.error(formatOpenClawActionError(error, "Failed to remove alias"));
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
      toast.error(formatOpenClawActionError(error, "Failed to add fallback"));
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
      toast.error(formatOpenClawActionError(error, "Failed to remove fallback"));
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

  const providerCatalogGroups = useMemo(() => {
    const active = providerEntries.filter(([, details]) => Boolean(details.active));
    const configured = providerEntries.filter(([, details]) => !details.active && Boolean(details.configured));
    const available = providerEntries.filter(([, details]) => !details.active && !details.configured);

    return [
      { title: "Active", items: active },
      { title: "Configured", items: configured },
      { title: "Available", items: available },
    ].filter((group) => group.items.length > 0);
  }, [providerEntries]);

  const providerModelOptions = useMemo(
    () => (providerModels.data?.models ?? []).map((entry) => ({ value: toModelOptionValue(entry), label: toModelOptionLabel(entry) })),
    [providerModels.data?.models],
  );

  const customProviderItems = useMemo(
    () => normalizeRecordItems(
      customProviders.data?.providers
        ?? customProviders.data?.items
        ?? customProviders.data?.results
        ?? customProviders.data?.templates
        ?? customProviders.data?.customProviders
        ?? null,
      "name",
    ),
    [customProviders.data?.customProviders, customProviders.data?.items, customProviders.data?.providers, customProviders.data?.results, customProviders.data?.templates],
  );

  const selectedCustomProviderData = useMemo(
    () => customProviderItems.find((item) => String(item.name ?? item.id ?? item.provider ?? "") === selectedCustomProvider) ?? null,
    [customProviderItems, selectedCustomProvider],
  );

  useEffect(() => {
    if (!customProviderItems.some((item) => String(item.name ?? item.id ?? item.provider ?? "") === selectedCustomProvider)) {
      const firstProvider = customProviderItems[0];
      setSelectedCustomProvider(String(firstProvider?.name ?? firstProvider?.id ?? firstProvider?.provider ?? ""));
    }
  }, [customProviderItems, selectedCustomProvider]);

  useEffect(() => {
    if (!selectedCustomProviderData) {
      return;
    }

    setCustomProviderBaseUrl(String(selectedCustomProviderData.baseUrl ?? selectedCustomProviderData.url ?? ""));
    setCustomProviderApi(String(selectedCustomProviderData.api ?? "openai-completions"));
    setCustomProviderModel(String(selectedCustomProviderData.model ?? selectedCustomProviderData.defaultModel ?? ""));
    setCustomProviderModelName(String(selectedCustomProviderData.modelName ?? selectedCustomProviderData.label ?? ""));
    setCustomProviderApiKey("");
    setCustomProviderClearApiKey(false);
  }, [selectedCustomProviderData]);

  const channelEntries = useMemo(
    () => Object.entries(channels.data?.channels ?? {}),
    [channels.data?.channels],
  );

  const authPayloadRows = useMemo(
    () => [
      ["Effective username", authEffectiveUsername || "—"],
      ["Live auth configured", boolLabel(Boolean(authUser.data?.exists ?? authUser.data?.configured ?? authUser.data?.username ?? authUser.data?.user?.username))],
      ["Stored in database", boolLabel(Boolean(managedAuthRecord?.username || managedAuthRecord?.passwordConfigured))],
      ["Password stored", boolLabel(managedAuthRecord?.passwordConfigured)],
      ["Last stored update", fmtDate(managedAuthRecord?.updatedAt)],
    ],
    [authEffectiveUsername, authUser.data?.configured, authUser.data?.exists, authUser.data?.user?.username, authUser.data?.username, managedAuthRecord?.passwordConfigured, managedAuthRecord?.updatedAt, managedAuthRecord?.username],
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

  const skillCheckItems = useMemo(
    () => normalizeRecordItems(skillsCheck.data?.checks ?? skillsCheck.data?.results ?? skillsCheck.data?.items ?? null, "skillKey"),
    [skillsCheck.data?.checks, skillsCheck.data?.items, skillsCheck.data?.results],
  );

  const selectedCustomSkillData = useMemo(
    () => customSkillDetail.data?.skill ?? customSkillDetail.data?.item ?? customSkillDetail.data?.data ?? customSkillItems.find((item) => String(item.skillKey ?? item.id ?? item.name ?? "") === selectedCustomSkill) ?? null,
    [customSkillDetail.data?.data, customSkillDetail.data?.item, customSkillDetail.data?.skill, customSkillItems, selectedCustomSkill],
  );

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
    const directInspect = pluginInspectDetail.data?.plugin ?? pluginInspectDetail.data?.item;
    if (directInspect && String(directInspect.id ?? directInspect.name ?? directInspect.title ?? "") === selectedPlugin) {
      return directInspect;
    }

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
  }, [pluginInspectDetail.data?.item, pluginInspectDetail.data?.plugin, pluginItems, pluginsInspect.data?.data, pluginsInspect.data?.item, pluginsInspect.data?.plugin, pluginsInspect.data?.plugins, selectedPlugin]);

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

  const cronJobItems = useMemo(
    () => normalizeRecordItems(cronJobs.data?.jobs ?? cronJobs.data?.items ?? cronJobs.data?.results ?? null, "jobId"),
    [cronJobs.data?.items, cronJobs.data?.jobs, cronJobs.data?.results],
  );

  const memorySearchItems = useMemo(
    () => normalizeRecordItems(memorySearchResult?.results ?? memorySearchResult?.items ?? memorySearchResult?.matches ?? null, "resultId"),
    [memorySearchResult?.items, memorySearchResult?.matches, memorySearchResult?.results],
  );

  const devicesLegacyItems = useMemo(
    () => normalizeRecordItems(devicesLegacy.data?.devices ?? devicesLegacy.data?.items ?? devicesLegacy.data?.results ?? null, "requestId"),
    [devicesLegacy.data?.devices, devicesLegacy.data?.items, devicesLegacy.data?.results],
  );

  const devicesPendingItems = useMemo(
    () => normalizeRecordItems(devicesPairing.data?.pending ?? devicesPairing.data?.requests ?? null, "requestId"),
    [devicesPairing.data?.pending, devicesPairing.data?.requests],
  );

  const devicesPairedItems = useMemo(
    () => normalizeRecordItems(devicesPairing.data?.paired ?? devicesPairing.data?.devices ?? null, "deviceId"),
    [devicesPairing.data?.devices, devicesPairing.data?.paired],
  );

  const agentItems = useMemo(
    () => normalizeRecordItems(agents.data?.agents ?? agents.data?.items ?? agents.data?.results ?? null, "agentId"),
    [agents.data?.agents, agents.data?.items, agents.data?.results],
  );

  const selectedAgentData = useMemo(
    () => agentDetail.data?.agent ?? agentDetail.data?.item ?? agentDetail.data?.data ?? agentItems.find((item) => String(item.agentId ?? item.id ?? item.name ?? "") === selectedAgentId) ?? null,
    [agentDetail.data?.agent, agentDetail.data?.data, agentDetail.data?.item, agentItems, selectedAgentId],
  );

  const agentApiKeyEntries = useMemo(
    () => Object.entries(agentApiKeys.data?.keys ?? agentApiKeys.data?.apiKeys ?? agentApiKeys.data?.providers ?? {}),
    [agentApiKeys.data?.apiKeys, agentApiKeys.data?.keys, agentApiKeys.data?.providers],
  );

  const agentFileItems = useMemo(
    () => agentFiles.data?.files ?? [],
    [agentFiles.data?.files],
  );

  useEffect(() => {
    if (!cronJobItems.some((item) => String(item.jobId ?? item.id ?? item.name ?? "") === selectedCronJob)) {
      const firstJob = cronJobItems[0];
      setSelectedCronJob(String(firstJob?.jobId ?? firstJob?.id ?? firstJob?.name ?? ""));
    }
  }, [cronJobItems, selectedCronJob]);

  const selectedCronJobData = useMemo(
    () => cronJobItems.find((item) => String(item.jobId ?? item.id ?? item.name ?? "") === selectedCronJob) ?? null,
    [cronJobItems, selectedCronJob],
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
    updateStatus.error,
    domain.error,
    domainIssuer.error,
    providers.error,
    providerModels.error,
    chatGptOAuthStatus.error,
    channels.error,
    channelsStatus.error,
    channelsUpstream.error,
    channelCapabilities.error,
    channelLogs.error,
    plugins.error,
    pluginsInspect.error,
    pluginInspectDetail.error,
    hooks.error,
    hookCheck.error,
    hookDetail.error,
    skills.error,
    skillsStatus.error,
    skillsCheck.error,
    skillBins.error,
    skillDetail.error,
    customSkills.error,
    customSkillDetail.error,
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
    authUser.error,
    cronStatus.error,
    cronJobs.error,
    configSchema.error,
    configFile.error,
    bindings.error,
    environmentVariables.error,
    memoryStatus.error,
    doctorMemoryStatus.error,
    devicesLegacy.error,
    devicesPairing.error,
    agents.error,
    agentDetail.error,
    agentApiKeys.error,
    agentFiles.error,
    agentFile.error,
  ].filter((message): message is string => Boolean(message) && !shouldHideOpenClawErrorMessage(message));

  const chatGptOAuthUrl = useMemo(
    () => String(chatGptOAuthStartResult?.oauthUrl ?? chatGptOAuthStartResult?.url ?? "").trim(),
    [chatGptOAuthStartResult?.oauthUrl, chatGptOAuthStartResult?.url],
  );

  const chatGptOAuthProvider = useMemo(
    () => String(chatGptOAuthStatus.data?.provider ?? (chatGptOAuthSwitchProvider ? "openai-codex" : "unchanged")),
    [chatGptOAuthStatus.data?.provider, chatGptOAuthSwitchProvider],
  );

  const chatGptOAuthStatusLabel = useMemo(() => {
    const statusData = chatGptOAuthStatus.data;
    if (!statusData) {
      return "unknown";
    }

    if (statusData.exists === false || statusData.configured === false || statusData.hasToken === false) {
      return "not connected";
    }

    if (statusData.exists || statusData.configured || statusData.hasToken || statusData.hasRefreshToken) {
      return "connected";
    }

    return statusData.ok ? "ready" : "unknown";
  }, [chatGptOAuthStatus.data]);

  const chatGptOAuthExpiry = useMemo(
    () => String(chatGptOAuthStatus.data?.expiresAt ?? chatGptOAuthStatus.data?.tokenExpiresAt ?? "—"),
    [chatGptOAuthStatus.data?.expiresAt, chatGptOAuthStatus.data?.tokenExpiresAt],
  );

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
              onClick={() => void handleManualRefresh()}
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

          {isUpdateSection ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard label="Channel" value={String(updateStatus.data?.channel ?? "default")} subtitle="Upstream release stream" icon={RefreshCcw} />
                <StatCard label="Installed" value={String(updateStatus.data?.installedVersion ?? updateStatus.data?.currentVersion ?? version.data?.clawVersion ?? "—")} subtitle="Current OpenClaw release" icon={Wrench} />
                <StatCard label="Availability" value={updateStatus.data?.updateAvailable ? "update available" : "up to date"} subtitle={String(updateStatus.data?.latestVersion ?? updateStatus.data?.availableVersion ?? "No newer version reported")} icon={AlertTriangle} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <DetailCard title="Managed Update Pipeline" icon={RefreshCcw}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Restart Delay (ms)</span>
                      <input
                        value={updateRestartDelayMs}
                        onChange={(event) => setUpdateRestartDelayMs(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                      <span>Maintenance Note</span>
                      <input
                        value={updateNote}
                        onChange={(event) => setUpdateNote(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="Manual maintenance update"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                      <span>Timeout (ms)</span>
                      <input
                        value={updateTimeoutMs}
                        onChange={(event) => setUpdateTimeoutMs(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRunManagedUpdate()}
                      disabled={updateBusy}
                      className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {updateBusy ? 'Running…' : 'Run Update'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus.refresh({ refresh: true })}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                    >
                      Refresh Status
                    </button>
                  </div>
                </DetailCard>

                <DetailCard title="Update Status" icon={Activity}>
                  <pre className="max-h-[420px] overflow-auto rounded-xl bg-[var(--bg-primary)] p-4 font-mono text-xs leading-6 text-[var(--text-secondary)]">
                    {JSON.stringify(updateStatus.data ?? updateRunResult ?? { message: 'No update status loaded yet.' }, null, 2)}
                  </pre>
                </DetailCard>
              </div>
            </div>
          ) : null}

      {isBindingsSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Bindings" value={String(bindingItems.length)} subtitle="Routing rules" icon={Wrench} />
            <StatCard label="Selected" value={selectedBindingIndex || "—"} subtitle="Binding index" icon={Bot} />
            <StatCard label="Agents" value={String(agentItems.length)} subtitle="Available managed agents" icon={FileText} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <ListCard title="Current Bindings" icon={Wrench}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {bindingItems.length === 0 ? (
                  <p>{getOpenClawEmptyStateMessage(bindings.error, "No bindings returned.")}</p>
                ) : (
                  bindingItems.map((item) => {
                    const index = String(item.bindingIndex ?? "");
                    const active = index === selectedBindingIndex;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedBindingIndex(index)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                            : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <p className="font-medium text-[var(--text-primary)]">#{index} → {String(item.agentId ?? "unknown-agent")}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{JSON.stringify(item.match ?? {})}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </ListCard>

            <DetailCard title="Manage Binding" icon={Bot}>
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Binding payload (JSON object)</span>
                <textarea
                  value={bindingPayloadText}
                  onChange={(event) => setBindingPayloadText(event.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateBinding()}
                  disabled={bindingsBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {bindingsBusy === "create" ? "Creating…" : "Create Binding"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateBinding()}
                  disabled={bindingsBusy != null || !selectedBindingIndex}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {bindingsBusy === "update" ? "Saving…" : "Update Selected"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteBinding()}
                  disabled={bindingsBusy != null || !selectedBindingIndex}
                  className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
                >
                  {bindingsBusy === "delete" ? "Deleting…" : "Delete Selected"}
                </button>
                <button
                  type="button"
                  onClick={() => void bindings.refresh({ refresh: true })}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                >
                  Refresh Bindings
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Binding Action</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(bindingActionResult ?? bindings.data ?? { message: "No binding action executed yet." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isEnvironmentSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Variables" value={String(environmentEntries.length)} subtitle=".env entries" icon={Globe} />
            <StatCard label="Editing Key" value={envKeyDraft || "—"} subtitle="UPPER_SNAKE_CASE" icon={FileText} />
            <StatCard label="Protected" value="Mgmt/API keys" subtitle="Removal may be blocked" icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <ListCard title="Environment Variables" icon={Globe}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {environmentEntries.length === 0 ? (
                  <p>{getOpenClawEmptyStateMessage(environmentVariables.error, "No environment variables returned.")}</p>
                ) : (
                  environmentEntries.map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => { setEnvKeyDraft(key); setEnvValueDraft(String(value ?? "")); }} className="text-left">
                          <p className="font-medium text-[var(--text-primary)]">{key}</p>
                          <p className="mt-1 break-all text-xs text-[var(--text-tertiary)]">{String(value ?? "") || "—"}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteEnvironmentVariable(key)}
                          disabled={environmentBusy != null}
                          className="text-xs font-medium text-[var(--danger)] disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ListCard>

            <DetailCard title="Set Environment Variable" icon={FileText}>
              <div className="grid grid-cols-1 gap-4">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Key</span>
                  <input
                    value={envKeyDraft}
                    onChange={(event) => setEnvKeyDraft(event.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="CUSTOM_ENV_VAR"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Value</span>
                  <textarea
                    value={envValueDraft}
                    onChange={(event) => setEnvValueDraft(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSetEnvironmentVariable()}
                  disabled={environmentBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {environmentBusy === "set" ? "Saving…" : "Save Variable"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteEnvironmentVariable()}
                  disabled={environmentBusy != null || !envKeyDraft}
                  className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
                >
                  {environmentBusy === "delete" ? "Deleting…" : "Delete Variable"}
                </button>
                <button
                  type="button"
                  onClick={() => void environmentVariables.refresh({ refresh: true })}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                >
                  Refresh Environment
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Environment Action</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(environmentActionResult ?? environmentVariables.data ?? { message: "No environment action executed yet." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isCliProxySection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="CLI Command" value={cliCommand || "—"} subtitle="Executed as openclaw <command>" icon={TerminalSquare} />
            <StatCard label="Last Result" value={cliResult?.ok === false ? "error" : cliResult?.ok === true ? "ok" : "idle"} subtitle="Proxy execution state" icon={Activity} />
            <StatCard label="Security" value="Filtered" subtitle="Shell metacharacters blocked" icon={ShieldCheck} />
          </div>

          <DetailCard title="CLI Proxy" icon={TerminalSquare}>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Command</span>
              <input
                value={cliCommand}
                onChange={(event) => setCliCommand(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                placeholder="models scan"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleRunCliCommand()}
                disabled={cliBusy}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {cliBusy ? "Running…" : "Run Command"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">CLI Result</p>
              <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                {cliResult?.output ?? JSON.stringify(cliResult ?? { message: "No CLI command executed yet." }, null, 2)}
              </pre>
            </div>
          </DetailCard>
        </div>
      ) : null}

      {isSelfUpdateSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Update Action" value={selfUpdateBusy ? "running" : "ready"} subtitle="Management API asset sync" icon={RefreshCcw} />
            <StatCard label="Updated Files" value={String(selfUpdateResult?.files?.length ?? 0)} subtitle="Last self-update run" icon={Archive} />
            <StatCard label="Impact" value="API restart" subtitle="Service may briefly restart" icon={AlertTriangle} />
          </div>

          <DetailCard title="Self Update Management API" icon={RefreshCcw}>
            <p className="text-sm text-[var(--text-secondary)]">
              Download the latest management assets and provider templates from the upstream source. This may restart the management API.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSelfUpdate()}
                disabled={selfUpdateBusy}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {selfUpdateBusy ? "Updating…" : "Run Self Update"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Update Result</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(selfUpdateResult ?? { message: "No self update executed yet." }, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Updated Files</p>
                <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  {(selfUpdateResult?.files ?? []).length === 0 ? (
                    <p>No files updated yet.</p>
                  ) : (
                    (selfUpdateResult?.files ?? []).map((entry, index) => (
                      <div key={`${entry.file ?? index}`} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                        <p className="font-medium text-[var(--text-primary)]">{entry.file ?? `file-${index + 1}`}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{entry.ok ? "Updated" : "Failed"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </DetailCard>
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

            <div className="mt-5 rounded-xl border border-[var(--danger)]/30 bg-[rgba(239,68,68,0.05)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--danger)]">Danger Zone</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Factory reset the managed OpenClaw service and wipe its state. This action is destructive.</p>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
                <label className="flex-1 space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Type RESET to confirm</span>
                  <input
                    value={resetConfirmText}
                    onChange={(event) => setResetConfirmText(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="RESET"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  disabled={runtimeBusy != null || resetConfirmText.trim() !== "RESET"}
                  className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
                >
                  {runtimeBusy === "reset" ? "Resetting…" : "Reset OpenClaw"}
                </button>
              </div>
            </div>
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
                {[50, 100, 150, 250, 500].map((value) => (
                  <option key={value} value={value}>{value} lines</option>
                ))}
              </select>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-[var(--bg-primary)] p-4 font-mono text-xs leading-6 text-[var(--text-secondary)]">
              {logs.data?.logs ?? getOpenClawEmptyStateMessage(logs.error, "No logs returned yet.")}
            </pre>
          </DetailCard>
        </div>
      ) : null}

      {openClawSection === "mcp" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <ListCard title="MCP Servers" icon={Plug}>
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              {mcpServerItems.length === 0 ? (
                <p>{getOpenClawEmptyStateMessage(mcpServers.error, "No MCP servers returned.")}</p>
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
                {JSON.stringify(
                  selectedMcpServerData ?? { message: getOpenClawEmptyStateMessage(mcpServerDetail.error, "No MCP server detail returned.") },
                  null,
                  2,
                )}
              </pre>
            </div>
          </DetailCard>
        </div>
      ) : null}

      {isAuthSection ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <ListCard title="Login User" icon={KeyRound}>
            <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Current State</p>
              <p className="mt-2 text-[var(--text-primary)]">Configured: {boolLabel(Boolean(authUser.data?.exists ?? authUser.data?.configured ?? authUser.data?.username ?? authUser.data?.user?.username))}</p>
              <p className="mt-1 text-[var(--text-primary)]">Username: {authUser.data?.username ?? authUser.data?.user?.username ?? "—"}</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Username</span>
                <input
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  placeholder="admin"
                />
              </label>
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Create password</span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  placeholder="change-me-now"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCreateAuthUser()}
                disabled={authBusy != null}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {authBusy === "create" ? "Saving…" : "Create / Replace User"}
              </button>
              <button
                type="button"
                onClick={() => void authUser.refresh({ refresh: true })}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
              >
                Refresh User
              </button>
            </div>
          </ListCard>

          <DetailCard title="Password Rotation" icon={ShieldCheck}>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>New password</span>
              <input
                type="password"
                value={authNewPassword}
                onChange={(event) => setAuthNewPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                placeholder="new-secret-password"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleChangeAuthPassword()}
                disabled={authBusy != null}
                className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {authBusy === "password" ? "Updating…" : "Change Password"}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAuthUser()}
                disabled={authBusy != null}
                className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
              >
                {authBusy === "delete" ? "Removing…" : "Delete Login User"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Auth Summary</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Friendly overview of live auth and locally managed credentials for this target.</p>
                </div>
                {managedAuthLoading ? <span className="text-xs text-[var(--text-tertiary)]">Syncing…</span> : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                {authPayloadRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{label}</p>
                    <p className="mt-2 break-words text-sm font-medium text-[var(--text-primary)]">{String(value || "—")}</p>
                  </div>
                ))}
              </div>

              {managedAuthError ? (
                <p className="mt-3 text-xs text-[var(--warning)]">{managedAuthError}</p>
              ) : null}

              <details className="mt-4 rounded-xl border border-[var(--border)]/50 bg-[rgba(148,163,184,0.05)] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Raw Auth Payload</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(authUser.data ?? { message: getOpenClawEmptyStateMessage(authUser.error, "No auth user configured.") }, null, 2)}
                </pre>
              </details>
            </div>
          </DetailCard>
        </div>
      ) : null}

      {isCronSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Scheduler" value={cronStatus.data?.status ?? (cronStatus.data?.running ? "running" : "unknown")} subtitle={`Enabled: ${boolLabel(cronStatus.data?.enabled)}`} icon={Activity} />
            <StatCard label="Jobs" value={String(cronJobItems.length)} subtitle={`Reported total: ${cronStatus.data?.jobs ?? cronStatus.data?.totalJobs ?? cronJobItems.length}`} icon={Database} />
            <StatCard label="Include Disabled" value={cronIncludeDisabled ? "Yes" : "No"} subtitle="List cron jobs" icon={RefreshCcw} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ListCard title="Cron Jobs" icon={Database}>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={cronIncludeDisabled} onChange={(event) => setCronIncludeDisabled(event.target.checked)} />
                Include disabled jobs
              </label>
              <div className="mt-4 space-y-2">
                {cronJobItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">{getOpenClawEmptyStateMessage(cronJobs.error, "No cron jobs returned.")}</p>
                ) : (
                  cronJobItems.map((item, index) => {
                    const jobId = String(item.jobId ?? item.id ?? item.name ?? `job-${index + 1}`);
                    const active = jobId === selectedCronJob;
                    return (
                      <button
                        key={jobId}
                        type="button"
                        onClick={() => setSelectedCronJob(jobId)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                            : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <p className="font-medium text-[var(--text-primary)]">{String(item.name ?? item.jobId ?? item.id ?? jobId)}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(((item.schedule as Record<string, unknown> | undefined)?.kind) ?? item.cron ?? item.enabled ?? "No schedule metadata")}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </ListCard>

            <DetailCard title="Manage Cron" icon={Wrench}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Create payload (JSON)</span>
                  <textarea
                    value={cronCreateText}
                    onChange={(event) => setCronCreateText(event.target.value)}
                    rows={10}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                  />
                </label>
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateCronJob()}
                    disabled={cronBusy != null}
                    className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                  >
                    {cronBusy === "create" ? "Creating…" : "Create Cron Job"}
                  </button>
                </div>

                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Selected job</span>
                  <input
                    value={selectedCronJob}
                    onChange={(event) => setSelectedCronJob(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Run mode</span>
                  <select
                    value={cronRunMode}
                    onChange={(event) => setCronRunMode(event.target.value as "force" | "due")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    <option value="force">force</option>
                    <option value="due">due</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Patch payload (JSON)</span>
                  <textarea
                    value={cronPatchText}
                    onChange={(event) => setCronPatchText(event.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handlePatchCronJob()}
                  disabled={cronBusy != null || !selectedCronJob}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {cronBusy === "patch" ? "Saving…" : "Patch Selected Job"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunCronJob()}
                  disabled={cronBusy != null || !selectedCronJob}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {cronBusy === "run" ? "Running…" : "Run Selected Job"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Selected Cron Job</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(selectedCronJobData ?? cronStatus.data ?? { message: "No cron job selected." }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isConfigAdvancedSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Schema Roots" value={String(configSchema.data?.roots?.length ?? 0)} subtitle={`Entries: ${configSchema.data?.count ?? configSchema.data?.schema?.length ?? 0}`} icon={Database} />
            <StatCard label="Config File" value={configFile.data?.path ?? configFile.data?.file ?? "openclaw.json"} subtitle={`Updated: ${fmtDate(configFile.data?.mtime)}`} icon={Archive} />
            <StatCard label="Apply Target" value={configApplyTarget} subtitle="Deferred config apply" icon={Wrench} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DetailCard title="Schema & Validation" icon={ShieldCheck}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Lookup path</span>
                  <input
                    value={configLookupPath}
                    onChange={(event) => setConfigLookupPath(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="gateway.auth.token"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGetConfigValue()}
                    disabled={configAdvancedBusy != null}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                  >
                    {configAdvancedBusy === "get" ? "Loading…" : "Get Value"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLookupConfig()}
                    disabled={configAdvancedBusy != null}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                  >
                    {configAdvancedBusy === "lookup" ? "Loading…" : "Lookup"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleValidateConfig()}
                  disabled={configAdvancedBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {configAdvancedBusy === "validate" ? "Validating…" : "Validate Config"}
                </button>
                <button
                  type="button"
                  onClick={() => void configSchema.refresh({ refresh: true })}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                >
                  Refresh Schema
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Schema</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(configSchema.data ?? { message: getOpenClawEmptyStateMessage(configSchema.error, "No schema returned.") }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Lookup / Validation</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(configGetResult ?? configLookupResult ?? configValidationResult ?? { message: "Run get, lookup, or validation." }, null, 2)}
                  </pre>
                </div>
              </div>
            </DetailCard>

            <DetailCard title="Patch, Raw Path, Apply" icon={Wrench}>
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Patch payload (JSON object)</span>
                <textarea
                  value={configPatchText}
                  onChange={(event) => setConfigPatchText(event.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={configPatchRestart} onChange={(event) => setConfigPatchRestart(event.target.checked)} />
                Restart after patch
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handlePatchConfig()}
                  disabled={configAdvancedBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {configAdvancedBusy === "patch" ? "Patching…" : "Patch Config"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Raw config path</span>
                  <input
                    value={configRawPath}
                    onChange={(event) => setConfigRawPath(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Raw value</span>
                  <textarea
                    value={configRawValueText}
                    onChange={(event) => setConfigRawValueText(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                    disabled={configRawRemove}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <input type="checkbox" checked={configRawRemove} onChange={(event) => setConfigRawRemove(event.target.checked)} />
                  Remove this path instead of setting a value
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSetRawConfigPath()}
                  disabled={configAdvancedBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {configAdvancedBusy === "raw" ? "Saving…" : "Set Raw Path"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleUnsetConfigValue()}
                  disabled={configAdvancedBusy != null}
                  className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
                >
                  {configAdvancedBusy === "unset" ? "Removing…" : "Unset Value"}
                </button>
                <select
                  value={configApplyTarget}
                  onChange={(event) => setConfigApplyTarget(event.target.value as "openclaw" | "caddy" | "all" | "none")}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                >
                  <option value="openclaw">openclaw</option>
                  <option value="caddy">caddy</option>
                  <option value="all">all</option>
                  <option value="none">none</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleApplyConfig()}
                  disabled={configAdvancedBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {configAdvancedBusy === "apply" ? "Applying…" : "Apply Config"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Raw Config File</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {configFile.data?.content ?? configFile.data?.raw ?? JSON.stringify(configFile.data ?? { message: getOpenClawEmptyStateMessage(configFile.error, "No raw config file returned.") }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
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
                  <p>{getOpenClawEmptyStateMessage(gatewayDiscover.error, "No gateway discovery data returned.")}</p>
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
                  <p>{getOpenClawEmptyStateMessage(nodesStatus.error ?? nodesList.error, "No nodes returned.")}</p>
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
                  {JSON.stringify(selectedNodeData ?? { message: getOpenClawEmptyStateMessage(nodeDetail.error, "No node selected or no node detail returned.") }, null, 2)}
                </pre>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isConfigSection ? (
        <div className="space-y-4">
          {isProviderSection || isCredentialsSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
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
                      {providerModelOptions.map((modelOption) => (
                        <option key={modelOption.value} value={modelOption.value}>
                          {modelOption.label}
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

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Custom Providers</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Create or update OpenClaw custom providers without leaving Mission Control.</p>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{customProviderItems.length} items</span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                      <span>Selected custom provider</span>
                      <select
                        value={selectedCustomProvider}
                        onChange={(event) => setSelectedCustomProvider(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                      >
                        <option value="">Create new provider</option>
                        {customProviderItems.map((item) => {
                          const providerName = String(item.name ?? item.id ?? item.provider ?? "");
                          const providerLabel = String(item.label ?? item.modelName ?? providerName ?? "Unnamed provider");
                          return (
                            <option key={providerName} value={providerName}>
                              {providerName} — {providerLabel}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                      <span>Base URL</span>
                      <input
                        value={customProviderBaseUrl}
                        onChange={(event) => setCustomProviderBaseUrl(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="https://api.example.com/v1"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>API type</span>
                      <input
                        value={customProviderApi}
                        onChange={(event) => setCustomProviderApi(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="openai-completions"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Model ID</span>
                      <input
                        value={customProviderModel}
                        onChange={(event) => setCustomProviderModel(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="gpt-4.1"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Model name</span>
                      <input
                        value={customProviderModelName}
                        onChange={(event) => setCustomProviderModelName(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="GPT-4.1 Custom"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>API key</span>
                      <input
                        value={customProviderApiKey}
                        onChange={(event) => setCustomProviderApiKey(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="Optional override key"
                      />
                    </label>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={customProviderClearApiKey}
                      onChange={(event) => setCustomProviderClearApiKey(event.target.checked)}
                    />
                    Clear stored API key on update
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateCustomProvider()}
                      disabled={providerAdminBusy != null}
                      className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {providerAdminBusy === "custom-provider-create" ? "Creating…" : "Create Provider"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateCustomProvider()}
                      disabled={providerAdminBusy != null || !selectedCustomProvider}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                    >
                      {providerAdminBusy === "custom-provider-update" ? "Updating…" : "Update Provider"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCustomProvider()}
                      disabled={providerAdminBusy != null || !selectedCustomProvider}
                      className="rounded-xl border border-[rgba(255,99,132,0.35)] px-4 py-2 text-sm font-medium text-[rgb(255,99,132)] transition hover:bg-[rgba(255,99,132,0.08)] disabled:opacity-50"
                    >
                      {providerAdminBusy === "custom-provider-delete" ? "Deleting…" : "Delete Provider"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Provider Model Admin</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Add or remove model definitions for the currently selected provider.</p>

                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Model ID</span>
                      <input
                        value={providerModelIdDraft}
                        onChange={(event) => setProviderModelIdDraft(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="gpt-4.1-mini"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Display name</span>
                      <input
                        value={providerModelNameDraft}
                        onChange={(event) => setProviderModelNameDraft(event.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                        placeholder="GPT-4.1 Mini"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAddProviderModel()}
                      disabled={providerAdminBusy != null}
                      className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                    >
                      {providerAdminBusy === "provider-model-add" ? "Adding…" : "Add Model"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProviderModel()}
                      disabled={providerAdminBusy != null || !providerModelIdDraft.trim()}
                      className="rounded-xl border border-[rgba(255,99,132,0.35)] px-4 py-2 text-sm font-medium text-[rgb(255,99,132)] transition hover:bg-[rgba(255,99,132,0.08)] disabled:opacity-50"
                    >
                      {providerAdminBusy === "provider-model-delete" ? "Deleting…" : "Delete Model"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--border)]/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Available Models</p>
                    <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-auto">
                      {providerModelOptions.length > 0 ? providerModelOptions.map((modelOption) => (
                        <button
                          key={modelOption.value}
                          type="button"
                          onClick={() => {
                            setModel(modelOption.value);
                            setProviderModelIdDraft(modelOption.value);
                            setProviderModelNameDraft(modelOption.label);
                          }}
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                        >
                          {modelOption.label}
                        </button>
                      )) : (
                        <span className="text-xs text-[var(--text-secondary)]">No provider models loaded.</span>
                      )}
                    </div>
                  </div>
                </div>
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
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{secretsAudit.data?.summary ?? getOpenClawEmptyStateMessage(secretsAudit.error, "No secret audit summary returned.")}</p>
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
                    {JSON.stringify(
                      secretsAudit.data ?? { message: getOpenClawEmptyStateMessage(secretsAudit.error, "No secrets audit returned.") },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </ListCard>
            ) : null}
          </div>
          ) : null}

          {isDomainSection || isBackupSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
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

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Backup Inventory</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Recent backup operations stored locally for this OpenClaw target.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadBackupHistory()}
                    disabled={backupHistoryLoading}
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                  >
                    {backupHistoryLoading ? "Refreshing…" : "Refresh Inventory"}
                  </button>
                </div>

                {backupHistoryError ? (
                  <p className="mt-3 text-xs text-[var(--warning)]">{backupHistoryError}</p>
                ) : null}

                <div className="mt-4 space-y-3">
                  {backupHistoryItems.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No backup history stored yet.</p>
                  ) : (
                    backupHistoryItems.map((item, index) => {
                      const key = String(item.id ?? `${item.action ?? "backup"}-${item.archivePath ?? index}`);
                      const statusTone = item.status === "failed"
                        ? "text-[var(--danger)]"
                        : item.verified
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-primary)]";

                      return (
                        <div key={key} className="rounded-xl border border-[var(--border)]/50 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {(item.action ?? "backup").toUpperCase()} · {item.archivePath || item.archive || "Archive path not reported"}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">{item.message || "No additional details provided."}</p>
                            </div>
                            <div className="text-right text-xs text-[var(--text-secondary)]">
                              <p className={statusTone}>{item.status ?? (item.verified ? "verified" : "recorded")}</p>
                              <p className="mt-1">{fmtDate(item.updatedAt ?? item.createdAt)}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                            <span className="rounded-full border border-[var(--border)]/50 px-2 py-1">Verified: {boolLabel(item.verified ?? undefined)}</span>
                            {item.action ? <span className="rounded-full border border-[var(--border)]/50 px-2 py-1">Action: {item.action}</span> : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </DetailCard>
            ) : null}
          </div>
          ) : null}

          {isProviderSection || isChannelsSection ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
            {isProviderSection ? (
            <ListCard title="Providers Catalog" icon={ShieldCheck}>
              <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                {providerEntries.length === 0 ? (
                  <p>No provider inventory returned.</p>
                ) : (
                  providerCatalogGroups.map((group) => (
                    <div key={group.title} className="rounded-2xl border border-[var(--border)]/50 bg-[rgba(148,163,184,0.05)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{group.title}</p>
                        <span className="text-xs text-[var(--text-secondary)]">{group.items.length} provider{group.items.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {group.items.map(([name, details]) => (
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
                              <span className={`text-xs ${details.active ? "text-[var(--accent)]" : details.configured ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>
                                {details.active ? "active" : details.configured ? "configured" : "available"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs">Default model: {details.defaultModel ?? "—"}</p>
                            <p className="mt-1 text-xs">Configured: {boolLabel(details.configured)}</p>
                            {(details.models?.length ?? 0) > 0 ? (
                              <p className="mt-1 text-xs text-[var(--text-tertiary)]">{details.models?.slice(0, 6).join(" · ")}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
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
                  {JSON.stringify(
                    channelsStatus.data ?? { message: getOpenClawEmptyStateMessage(channelsStatus.error, "No upstream channel status returned.") },
                    null,
                    2,
                  )}
                </pre>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Upstream Inventory</p>
                    <span className="text-xs text-[var(--text-secondary)]">{channelUpstreamItems.length} item(s)</span>
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(
                      channelsUpstream.data ?? { message: getOpenClawEmptyStateMessage(channelsUpstream.error, "No upstream channel inventory returned.") },
                      null,
                      2,
                    )}
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
                    {JSON.stringify(
                      channelCapabilities.data ?? { message: getOpenClawEmptyStateMessage(channelCapabilities.error, "No channel capabilities returned.") },
                      null,
                      2,
                    )}
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
                  {channelLogs.data?.logs
                    ?? JSON.stringify(
                      channelLogs.data ?? { message: getOpenClawEmptyStateMessage(channelLogs.error, "No channel logs returned.") },
                      null,
                      2,
                    )}
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
                    {JSON.stringify(
                      systemHeartbeatLast.data ?? { message: getOpenClawEmptyStateMessage(systemHeartbeatLast.error, "No heartbeat data returned.") },
                      null,
                      2,
                    )}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Presence Snapshot</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(
                      systemPresence.data ?? { message: getOpenClawEmptyStateMessage(systemPresence.error, "No system presence returned.") },
                      null,
                      2,
                    )}
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
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{securityAudit.data?.summary ?? getOpenClawEmptyStateMessage(securityAudit.error, "No security audit summary returned.")}</p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">Findings: {securityFindingItems.length}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Mode</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{securityAuditDeep ? "Deep checks enabled" : "Standard checks only"}</p>
                  </div>
                </div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(
                    securityAudit.data ?? { message: getOpenClawEmptyStateMessage(securityAudit.error, "No security audit returned.") },
                    null,
                    2,
                  )}
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

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Skills Check</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">Direct readiness check from upstream skill validation.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)]">{skillCheckItems.length} item(s)</span>
                      <button
                        type="button"
                        onClick={() => void skillsCheck.refresh({ refresh: true })}
                        className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                      >
                        Refresh Check
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-primary)]">{String(skillsCheck.data?.summary ?? "No skills check summary returned.")}</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(skillsCheck.data ?? { message: getOpenClawEmptyStateMessage(skillsCheck.error, "No skills check result returned.") }, null, 2)}
                  </pre>
                </div>

                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Check Entries</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {skillCheckItems.length === 0 ? (
                      <p>{getOpenClawEmptyStateMessage(skillsCheck.error, "No skill check entries returned.")}</p>
                    ) : (
                      skillCheckItems.slice(0, 8).map((item, index) => {
                        const label = String(item.skillKey ?? item.name ?? item.id ?? `skill-check-${index + 1}`);
                        const status = String(item.status ?? item.state ?? item.readiness ?? item.result ?? "unknown");
                        const detail = String(item.summary ?? item.message ?? item.reason ?? item.missing ?? "No detail returned.");
                        return (
                          <div key={label} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-[var(--text-primary)]">{label}</p>
                              <span className={`text-xs ${statusTone(status)}`}>{status}</span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{detail}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
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

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Custom Skills</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Create, validate, render, and manage workspace custom skill packages.</p>
                  </div>
                  <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-primary)]">
                    {customSkillItems.length} custom skill{customSkillItems.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    {customSkillItems.length === 0 ? (
                      <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">No custom skills found for this agent.</div>
                    ) : (
                      customSkillItems.map((item) => {
                        const key = String(item.skillKey ?? item.id ?? item.name ?? "");
                        const active = key === selectedCustomSkill;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedCustomSkill(key)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                                : "border-[var(--border)]/60 bg-[var(--bg-surface)] hover:border-[var(--accent)]/30"
                            }`}
                          >
                            <p className="font-medium text-[var(--text-primary)]">{String(item.title ?? key)}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.description ?? item.summary ?? item.path ?? "No custom skill summary")}</p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                        <span>Custom Skill Payload (JSON)</span>
                        <textarea
                          value={customSkillPayloadText}
                          onChange={(event) => setCustomSkillPayloadText(event.target.value)}
                          rows={12}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                        <span>Markdown Validate Content</span>
                        <textarea
                          value={customSkillValidateContent}
                          onChange={(event) => setCustomSkillValidateContent(event.target.value)}
                          rows={10}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                          placeholder="Paste SKILL.md content to validate"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCreateCustomSkill()}
                        disabled={customSkillBusy != null}
                        className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                      >
                        {customSkillBusy === "create" ? "Creating…" : "Create Custom Skill"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateCustomSkill()}
                        disabled={customSkillBusy != null || !selectedCustomSkill}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                      >
                        {customSkillBusy === "update" ? "Saving…" : "Update Selected"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCustomSkill()}
                        disabled={customSkillBusy != null || !selectedCustomSkill}
                        className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
                      >
                        {customSkillBusy === "delete" ? "Deleting…" : "Delete Selected"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleValidateCustomSkill()}
                        disabled={customSkillBusy != null}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                      >
                        {customSkillBusy === "validate" ? "Validating…" : "Validate Markdown"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRenderCustomSkill()}
                        disabled={customSkillBusy != null}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                      >
                        {customSkillBusy === "render" ? "Rendering…" : "Render Markdown"}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Selected Custom Skill</p>
                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">{JSON.stringify(selectedCustomSkillData ?? { message: 'No custom skill selected.' }, null, 2)}</pre>
                      </div>
                      <div className="rounded-xl border border-[var(--border)]/50 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Action / Validation</p>
                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">{JSON.stringify(customSkillValidateResult ?? customSkillRenderResult ?? customSkillActionResult ?? { message: 'No custom skill action executed yet.' }, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  {JSON.stringify(hookCheck.data ?? { message: getOpenClawEmptyStateMessage(hookCheck.error, "No hook check data returned.") }, null, 2)}
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

      {isChatGptSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Agent" value={chatGptOAuthAgentId || "main"} subtitle="OAuth target agent" icon={Bot} />
            <StatCard label="Status" value={chatGptOAuthStatusLabel} subtitle={`Provider: ${chatGptOAuthProvider}`} icon={KeyRound} />
            <StatCard label="Model" value={chatGptOAuthModel || "—"} subtitle="Preferred model override" icon={MessageSquare} />
            <StatCard label="Expiry" value={chatGptOAuthExpiry} subtitle={`Refresh token: ${boolLabel(chatGptOAuthStatus.data?.hasRefreshToken)}`} icon={RefreshCcw} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <DetailCard title="ChatGPT OAuth" icon={MessageSquare}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Agent ID</span>
                  <input
                    value={chatGptOAuthAgentId}
                    onChange={(event) => setChatGptOAuthAgentId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="main"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Preferred model</span>
                  <input
                    value={chatGptOAuthModel}
                    onChange={(event) => setChatGptOAuthModel(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="openai-codex/gpt-5.4"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Session ID</span>
                  <input
                    value={chatGptOAuthSessionId}
                    onChange={(event) => setChatGptOAuthSessionId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="Returned by OAuth start"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Redirect URL</span>
                  <textarea
                    value={chatGptOAuthRedirectUrl}
                    onChange={(event) => setChatGptOAuthRedirectUrl(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="Paste the full callback URL or compact code#state payload"
                  />
                </label>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={chatGptOAuthSwitchProvider}
                  onChange={(event) => setChatGptOAuthSwitchProvider(event.target.checked)}
                />
                Switch active provider to <span className="font-mono text-[var(--text-primary)]">openai-codex</span> after completion
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStartChatGptOAuth()}
                  disabled={chatGptOAuthBusy != null}
                  className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                >
                  {chatGptOAuthBusy === "start" ? "Starting…" : "Start OAuth"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCompleteChatGptOAuth()}
                  disabled={chatGptOAuthBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {chatGptOAuthBusy === "complete" ? "Completing…" : "Complete OAuth"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefreshChatGptOAuth()}
                  disabled={chatGptOAuthBusy != null}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                >
                  {chatGptOAuthBusy === "refresh" ? "Refreshing…" : "Refresh Token"}
                </button>
                <button
                  type="button"
                  onClick={() => void chatGptOAuthStatus.refresh({ refresh: true })}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                >
                  Refresh Status
                </button>
                {chatGptOAuthUrl ? (
                  <button
                    type="button"
                    onClick={() => window.open(chatGptOAuthUrl, "_blank", "noopener,noreferrer")}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
                  >
                    Open OAuth URL
                  </button>
                ) : null}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-secondary)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Flow</p>
                <ol className="mt-3 list-decimal space-y-2 pl-4">
                  <li>Start OAuth to get a <span className="font-mono text-[var(--text-primary)]">sessionId</span> and browser URL.</li>
                  <li>Open the returned OAuth URL and approve access in ChatGPT.</li>
                  <li>Paste the final redirect URL here, then complete the flow.</li>
                  <li>Refresh token later without re-running the browser step.</li>
                </ol>
              </div>
            </DetailCard>

            <ListCard title="OAuth Payloads" icon={KeyRound}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-[var(--border)]/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Start Result</p>
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(chatGptOAuthStartResult ?? { message: "No OAuth session started yet." }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">OAuth Status</p>
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(chatGptOAuthStatus.data ?? { message: getOpenClawEmptyStateMessage(chatGptOAuthStatus.error, "No OAuth status returned.") }, null, 2)}
                  </pre>
                </div>
              </div>
            </ListCard>
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

      {isMemorySection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Agent" value={memoryAgentId || "main"} subtitle="Memory target" icon={Brain} />
            <StatCard label="Search Results" value={String(memorySearchItems.length)} subtitle="Most recent query" icon={Database} />
            <StatCard label="Provider" value={doctorMemoryStatus.data?.provider ?? "—"} subtitle={doctorMemoryStatus.data?.note ?? "Embeddings readiness"} icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <DetailCard title="Memory Status" icon={Brain}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px_120px]">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Agent</span>
                  <input
                    value={memoryAgentId}
                    onChange={(event) => setMemoryAgentId(event.target.value || "main")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="flex items-end gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={memoryIndexForce} onChange={(event) => setMemoryIndexForce(event.target.checked)} />
                  Force reindex
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void handleReindexMemory()}
                    disabled={memoryBusy != null}
                    className="w-full rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
                  >
                    {memoryBusy === "index" ? "Indexing…" : "Reindex Memory"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Upstream Memory Status</p>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(memoryStatus.data ?? { message: getOpenClawEmptyStateMessage(memoryStatus.error, "No memory status returned.") }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Doctor Readiness</p>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(doctorMemoryStatus.data ?? memoryIndexResult ?? { message: getOpenClawEmptyStateMessage(doctorMemoryStatus.error, "No memory doctor output returned.") }, null, 2)}
                  </pre>
                </div>
              </div>
            </DetailCard>

            <DetailCard title="Memory Search" icon={Database}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px_140px]">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Query</span>
                  <input
                    value={memorySearchQuery}
                    onChange={(event) => setMemorySearchQuery(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                    placeholder="deployment"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Max</span>
                  <select
                    value={memorySearchMaxResults}
                    onChange={(event) => setMemorySearchMaxResults(Number(event.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {[5, 10, 20].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void handleSearchMemory()}
                    disabled={memoryBusy != null}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
                  >
                    {memoryBusy === "search" ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                {memorySearchItems.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">No memory search results yet.</div>
                ) : (
                  memorySearchItems.map((item, index) => (
                    <div key={`${String(item.resultId ?? item.id ?? item.path ?? index)}`} className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                      <p className="font-medium text-[var(--text-primary)]">{String(item.title ?? item.path ?? item.id ?? `result-${index + 1}`)}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.score ?? item.distance ?? item.kind ?? "No score metadata")}</p>
                      <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isDevicesSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Legacy Requests" value={String(devicesLegacyItems.length)} subtitle="CLI fallback" icon={Smartphone} />
            <StatCard label="Pending Pairing" value={String(devicesPendingItems.length)} subtitle="Upstream requests" icon={RefreshCcw} />
            <StatCard label="Paired Devices" value={String(devicesPairedItems.length)} subtitle="Managed devices" icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <ListCard title="Pairing Requests" icon={Smartphone}>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Legacy CLI Requests</p>
                  <div className="mt-2 space-y-2">
                    {devicesLegacyItems.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">{getOpenClawEmptyStateMessage(devicesLegacy.error, "No legacy device requests returned.")}</p>
                    ) : (
                      devicesLegacyItems.map((item, index) => {
                        const requestId = String(item.requestId ?? item.id ?? item.name ?? `request-${index + 1}`);
                        const active = requestId === selectedDeviceRequestId;
                        return (
                          <button
                            key={requestId}
                            type="button"
                            onClick={() => setSelectedDeviceRequestId(requestId)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                                : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                            }`}
                          >
                            <p className="font-medium text-[var(--text-primary)]">{requestId}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.status ?? item.deviceId ?? item.platform ?? "No request metadata")}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Upstream Pending Requests</p>
                  <div className="mt-2 space-y-2">
                    {devicesPendingItems.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No pending pairing requests.</p>
                    ) : (
                      devicesPendingItems.map((item, index) => {
                        const requestId = String(item.requestId ?? item.id ?? item.name ?? `pair-${index + 1}`);
                        const active = requestId === selectedDeviceRequestId;
                        return (
                          <button
                            key={requestId}
                            type="button"
                            onClick={() => setSelectedDeviceRequestId(requestId)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                                : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                            }`}
                          >
                            <p className="font-medium text-[var(--text-primary)]">{requestId}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.deviceId ?? item.platform ?? item.status ?? "No pairing metadata")}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </ListCard>

            <DetailCard title="Device Actions" icon={ShieldCheck}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Request ID</span>
                  <input
                    value={selectedDeviceRequestId}
                    onChange={(event) => setSelectedDeviceRequestId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Device ID</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(event) => setSelectedDeviceId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  >
                    {devicesPairedItems.map((item, index) => {
                      const value = String(item.deviceId ?? item.id ?? item.name ?? `device-${index + 1}`);
                      return <option key={value} value={value}>{value}</option>;
                    })}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleApproveDeviceLegacy()} disabled={devicesBusy != null || !selectedDeviceRequestId} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50">
                  {devicesBusy === "approve-legacy" ? "Approving…" : "Approve Legacy"}
                </button>
                <button type="button" onClick={() => void handleDevicePairingAction("approve")} disabled={devicesBusy != null || !selectedDeviceRequestId} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                  {devicesBusy === "pair-approve" ? "Approving…" : "Approve Pairing"}
                </button>
                <button type="button" onClick={() => void handleDevicePairingAction("reject")} disabled={devicesBusy != null || !selectedDeviceRequestId} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50">
                  {devicesBusy === "pair-reject" ? "Rejecting…" : "Reject Pairing"}
                </button>
                <button type="button" onClick={() => void handleRemovePairedDevice()} disabled={devicesBusy != null || !selectedDeviceId} className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50">
                  {devicesBusy === "remove-device" ? "Removing…" : "Remove Device"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Token role</span>
                  <input
                    value={deviceTokenRole}
                    onChange={(event) => setDeviceTokenRole(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Scopes</span>
                  <textarea
                    value={deviceTokenScopesText}
                    onChange={(event) => setDeviceTokenScopesText(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleDeviceTokenAction("rotate")} disabled={devicesBusy != null || !selectedDeviceId} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                  {devicesBusy === "token-rotate" ? "Rotating…" : "Rotate Token"}
                </button>
                <button type="button" onClick={() => void handleDeviceTokenAction("revoke")} disabled={devicesBusy != null || !selectedDeviceId} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--warning)]/40 disabled:opacity-50">
                  {devicesBusy === "token-revoke" ? "Revoking…" : "Revoke Token"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Pairing Snapshot</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(devicesPairing.data ?? { message: getOpenClawEmptyStateMessage(devicesPairing.error, "No pairing data returned.") }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Last Action</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(deviceActionResult ?? devicesLegacy.data ?? { message: "No device action executed yet." }, null, 2)}
                  </pre>
                </div>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}

      {isAgentsSection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Agents" value={String(agentItems.length)} subtitle="Configured registry" icon={Bot} />
            <StatCard label="API Key Providers" value={String(agentApiKeyEntries.length)} subtitle={selectedAgentId || "Selected agent"} icon={KeyRound} />
            <StatCard label="Workspace Files" value={String(agentFileItems.length)} subtitle={selectedAgentId || "Selected agent"} icon={FileText} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <ListCard title="Agent Registry" icon={Bot}>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {agentItems.length === 0 ? (
                  <p>{getOpenClawEmptyStateMessage(agents.error, "No agents returned.")}</p>
                ) : (
                  agentItems.map((item, index) => {
                    const agentId = String(item.agentId ?? item.id ?? item.name ?? `agent-${index + 1}`);
                    const active = agentId === selectedAgentId;
                    return (
                      <button
                        key={agentId}
                        type="button"
                        onClick={() => setSelectedAgentId(agentId)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                            : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <p className="font-medium text-[var(--text-primary)]">{String(item.name ?? agentId)}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.model ?? item.workspace ?? item.default ?? "No metadata")}</p>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Create Agent</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <input value={agentCreateId} onChange={(event) => setAgentCreateId(event.target.value)} placeholder="ops" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                  <input value={agentCreateName} onChange={(event) => setAgentCreateName(event.target.value)} placeholder="Operations Agent" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                  <input value={agentCreateModel} onChange={(event) => setAgentCreateModel(event.target.value)} placeholder="anthropic/claude-sonnet-4-20250514" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" checked={agentCreateDefault} onChange={(event) => setAgentCreateDefault(event.target.checked)} />
                    Set as default
                  </label>
                  <button type="button" onClick={() => void handleCreateAgent()} disabled={agentsBusy != null} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                    {agentsBusy === "create-agent" ? "Creating…" : "Create Agent"}
                  </button>
                </div>
              </div>
            </ListCard>

            <DetailCard title="Agent Detail & Files" icon={FileText}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Name</span>
                  <input value={agentNameDraft} onChange={(event) => setAgentNameDraft(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Model</span>
                  <input value={agentModelDraft} onChange={(event) => setAgentModelDraft(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
                  <span>Workspace</span>
                  <input value={agentWorkspaceDraft} onChange={(event) => setAgentWorkspaceDraft(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleUpdateAgent()} disabled={agentsBusy != null || !selectedAgentId} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                  {agentsBusy === "update-agent" ? "Saving…" : "Update Agent"}
                </button>
                <button type="button" onClick={() => void handleSetDefaultAgent()} disabled={agentsBusy != null || !selectedAgentId} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]/40 disabled:opacity-50">
                  {agentsBusy === "default-agent" ? "Saving…" : "Set Default"}
                </button>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <input type="checkbox" checked={agentDeleteData} onChange={(event) => setAgentDeleteData(event.target.checked)} />
                  Delete data
                </label>
                <button type="button" onClick={() => void handleDeleteAgent()} disabled={agentsBusy != null || !selectedAgentId} className="rounded-xl border border-[var(--danger)]/40 px-4 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50">
                  {agentsBusy === "delete-agent" ? "Deleting…" : "Delete Agent"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Agent Detail</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(selectedAgentData ?? { message: getOpenClawEmptyStateMessage(agentDetail.error, "No agent detail returned.") }, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Agent API Keys</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {agentApiKeyEntries.length === 0 ? (
                      <p>No provider API keys returned.</p>
                    ) : (
                      agentApiKeyEntries.map(([name, value]) => (
                        <div key={name} className="rounded-lg border border-[var(--border)]/50 px-3 py-2">
                          <p className="font-medium text-[var(--text-primary)]">{name}</p>
                          <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">{String(typeof value === "string" ? value : JSON.stringify(value))}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <input value={agentApiKeyProvider} onChange={(event) => setAgentApiKeyProvider(event.target.value)} placeholder="anthropic" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                    <textarea value={agentApiKeyValue} onChange={(event) => setAgentApiKeyValue(event.target.value)} rows={3} placeholder="Paste agent API key" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                    <button type="button" onClick={() => void handleSaveAgentApiKey()} disabled={agentsBusy != null || !selectedAgentId} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                      {agentsBusy === "agent-api-key" ? "Saving…" : "Save Agent API Key"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-[var(--bg-primary)] p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Workspace Files</p>
                    {agentFileItems.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No workspace files returned.</p>
                    ) : (
                      agentFileItems.map((item, index) => {
                        const name = String(item.name ?? `file-${index + 1}`);
                        const active = name === selectedAgentFileName;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setSelectedAgentFileName(name)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                                : "border-[var(--border)]/60 bg-[var(--bg-primary)] hover:border-[var(--accent)]/30"
                            }`}
                          >
                            <p className="font-medium text-[var(--text-primary)]">{name}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{String(item.exists ?? item.size ?? item.updatedAtMs ?? "No file metadata")}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div>
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>File content</span>
                      <textarea
                        value={agentFilesContent}
                        onChange={(event) => setAgentFilesContent(event.target.value)}
                        rows={16}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] outline-none"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void handleSaveAgentFile()} disabled={agentsBusy != null || !selectedAgentId || !selectedAgentFileName} className="rounded-xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50">
                        {agentsBusy === "agent-file" ? "Saving…" : `Save ${selectedAgentFileName || "File"}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}