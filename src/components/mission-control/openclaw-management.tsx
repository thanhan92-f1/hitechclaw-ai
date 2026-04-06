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

const OPENCLAW_SYNC_ACTIVE_MS = 5 * 60 * 1000;
const OPENCLAW_SYNC_PASSIVE_MS = 10 * 60 * 1000;
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
    "provider",
    "credentials",
    "domain",
    "backup",
    "channels",
    "skills",
    "hooks",
    "directory",
    "models",
  ];
  const isConfigSection = configSections.includes(openClawSection);
  const isProviderSection = openClawSection === "provider";
  const isCredentialsSection = openClawSection === "credentials";
  const isDomainSection = openClawSection === "domain";
  const isBackupSection = openClawSection === "backup";
  const isChannelsSection = openClawSection === "channels";
  const isSkillsSection = openClawSection === "skills";
  const isHooksSection = openClawSection === "hooks";
  const isDirectorySection = openClawSection === "directory";
  const isModelsSection = openClawSection === "models";

  const info = useOpenClawFetch<ServiceInfo>("/info", OPENCLAW_SYNC_PASSIVE_MS);
  const status = useOpenClawFetch<ServiceStatus>("/status", OPENCLAW_SYNC_ACTIVE_MS);
  const system = useOpenClawFetch<SystemInfo>("/system", OPENCLAW_SYNC_PASSIVE_MS);
  const upstream = useOpenClawFetch<UpstreamStatus>("/openclaw/status?all=true&usage=true&deep=false&timeoutMs=10000", OPENCLAW_SYNC_PASSIVE_MS);
  const config = useOpenClawFetch<ConfigInfo>("/config", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isConfigSection);
  const sessions = useOpenClawFetch<SessionsInfo>("/sessions?agent=main&allAgents=false", OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "overview" || openClawSection === "sessions");
  const logs = useOpenClawFetch<LogsInfo>(`/logs?lines=${lines}&service=${serviceFilter}`, OPENCLAW_SYNC_ACTIVE_MS, openClawSection === "runtime");
  const version = useOpenClawFetch<VersionInfo>("/version", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || openClawSection === "runtime");
  const domain = useOpenClawFetch<DomainConfig>("/domain", OPENCLAW_SYNC_PASSIVE_MS, openClawSection === "overview" || isDomainSection);
  const domainIssuer = useOpenClawFetch<DomainPreflight>("/domain/issuer", OPENCLAW_SYNC_PASSIVE_MS, isDomainSection);
  const providers = useOpenClawFetch<ProvidersInfo>("/providers", OPENCLAW_SYNC_PASSIVE_MS, isProviderSection);
  const providerModels = useOpenClawFetch<ProviderModelsInfo>(`/providers/${encodeURIComponent(provider)}/models`, OPENCLAW_SYNC_PASSIVE_MS, isProviderSection && Boolean(provider));
  const channels = useOpenClawFetch<ChannelsInfo>("/channels", OPENCLAW_SYNC_PASSIVE_MS, isChannelsSection);
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
      hooks.refresh(),
      hookCheck.refresh(),
      hookDetail.refresh(),
      skills.refresh(),
      skillsStatus.refresh(),
      skillBins.refresh(),
      skillDetail.refresh(),
      directorySelf.refresh(),
      directoryPeers.refresh(),
      directoryGroups.refresh(),
      directoryMembers.refresh(),
      modelsCatalog.refresh(),
      modelsStatus.refresh(),
      modelAuthOrder.refresh(),
      modelAliases.refresh(),
      modelFallbacks.refresh(),
      imageFallbacks.refresh(),
    ]);
  }, [channels, config, directoryGroups, directoryMembers, directoryPeers, directorySelf, domain, domainIssuer, hookCheck, hookDetail, hooks, imageFallbacks, info, logs, modelAliases, modelAuthOrder, modelFallbacks, modelsCatalog, modelsStatus, providerModels, providers, sessions, skillBins, skillDetail, skills, skillsStatus, status, system, upstream, version]);

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
    config.error,
    sessions.error,
    logs.error,
    version.error,
    domain.error,
    domainIssuer.error,
    providers.error,
    providerModels.error,
    channels.error,
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