"use client";

import DOMPurify from "dompurify";
import { allDomainPacks } from "@hitechclaw/domains";
import { allIntegrations } from "@hitechclaw/integrations";
import { algorithms, getAlgorithmsForTask } from "@hitechclaw/ml";
import { createSkillRegistry, describeSkill, formatSkillId } from "@hitechclaw/skill-hub";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { marked } from "marked";
import { toast } from "sonner";
import { type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  ErrorState,
  LoadingState,
  SectionTitle,
  ShellHeader,
  StatCard,
} from "./dashboard";
import { getAuthHeaders } from "./api";
import { SectionDescription } from "./dashboard-clarity";

type FetchState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type PollingResult<T> = FetchState<T> & {
  refresh: () => Promise<void>;
};

type ApprovalItem = {
  id: number;
  agent_id: string;
  title: string;
  content: string;
  content_type: string;
  target_channel: string | null;
  target_destination: string | null;
  metadata: Record<string, unknown>;
  status: string;
  priority: string;
  created_at: string;
  reviewed_at: string | null;
  sent_at: string | null;
  reviewer_note: string | null;
  expires_at: string | null;
  agent_name?: string;
};

type DocumentItem = {
  id: number;
  agent_id: string;
  title: string;
  category: string;
  content: string;
  content_format: string;
  file_path: string | null;
  tags: string[];
  pinned: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  preview?: string;
};

type LibraryDocItem = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  filePath: string;
  updatedAt: string;
  wordCount: number;
  version: string;
  snippet?: string;
  score?: number | null;
};

type LibraryDocsResponse = {
  items: LibraryDocItem[];
  stats: {
    totalDocs: number;
    categories: string[];
    tags: string[];
    totalWords: number;
  };
  timestamp: string;
};

type TaskItem = {
  id: number;
  agent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string;
  category: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CalendarItem = {
  id: number;
  agent_id: string | null;
  title: string;
  description: string | null;
  item_type: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  target_channel: string | null;
  linked_approval_id: number | null;
  linked_task_id: number | null;
  color: string | null;
  recurring: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SubagentRun = {
  id: number;
  agent_id: string;
  run_label: string;
  model: string;
  task_summary: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  last_output: string | null;
  output_path: string | null;
  output_size_bytes: number | null;
  token_count: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  session_id: string | null;
};

type QuickCommand = {
  id: number;
  agent_id: string;
  command: string;
  response: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
};

marked.setOptions({ breaks: true, gfm: true });

type DomainPack = (typeof allDomainPacks)[number];
type IntegrationDefinition = (typeof allIntegrations)[number];
type MLAlgorithm = (typeof algorithms)[number];
type SkillHubParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  default?: unknown;
};
type SkillHubTool = {
  name: string;
  description: string;
  parameters?: SkillHubParameter[];
};
type SkillRegistryEntry = {
  id: string;
  name: string;
  description: string;
  domainId: string;
  icon?: string;
  tools: SkillHubTool[];
  installed: boolean;
  version?: string;
  tags?: string[];
  author?: string;
  trustLevel?: "builtin" | "verified" | "community" | "untrusted";
  sandboxRequired?: boolean;
  sandboxPolicy?: string;
};

type BuiltinSkillParameter = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
};

type BuiltinSkillTool = {
  definition: {
    name: string;
    description: string;
    category: string;
    parameters: BuiltinSkillParameter[];
  };
};

type BuiltinSkillConfigEntry = {
  key: string;
  label: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
};

type BuiltinSkillDefinition = {
  manifest: {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    category: string;
    tags: string[];
    config: BuiltinSkillConfigEntry[];
  };
  tools: BuiltinSkillTool[];
};

type AppSandboxFilesystemRule = {
  path: string;
  access: string;
};

type AppSandboxNetworkRule = {
  host: string;
  methods?: string[];
  allow: boolean;
};

type AppSandboxPolicy = {
  name: string;
  version: string;
  filesystem: {
    rules: AppSandboxFilesystemRule[];
    defaultAccess: string;
  };
  network: {
    rules: AppSandboxNetworkRule[];
    defaultAction: string;
  };
  process: {
    allowPrivilegeEscalation: boolean;
    maxProcesses: number;
  };
};

type AppSandboxImage = {
  name: string;
  description: string;
  image: string;
  cudaVersion?: string;
  packages: string[];
  gpuRequired: boolean;
};

type SandboxPolicyRecord = [string, AppSandboxPolicy];

const builtinSkillDefinitions: BuiltinSkillDefinition[] = [
  {
    manifest: {
      id: "text-to-fhir",
      name: "Text-to-FHIR Query",
      version: "1.0.0",
      description:
        "Query hospital FHIR data via natural language. Provides tools to retrieve patients, encounters, prescriptions, allergies, medications, and aggregate statistics from the Hospital Information System.",
      author: "HiTechClaw",
      category: "healthcare",
      tags: ["fhir", "his", "hospital", "text-to-sql", "query", "healthcare"],
      config: [
        {
          key: "hisApiBaseUrl",
          label: "HIS API Base URL",
          type: "string",
          description: "HIS API base URL",
          required: false,
          default: "http://localhost:4000",
        },
      ],
    },
    tools: [
      { definition: { name: "his_get_stats", description: "Get aggregated hospital statistics and overview counts.", category: "healthcare", parameters: [] } },
      { definition: { name: "his_list_patients", description: "List or search patients in the HIS.", category: "healthcare", parameters: [{ name: "query", type: "string", description: "Optional patient name or ID query", required: false }] } },
      { definition: { name: "his_get_patient", description: "Get detailed information about a specific patient by ID.", category: "healthcare", parameters: [{ name: "patientId", type: "string", description: "Patient ID", required: true }] } },
      { definition: { name: "his_get_patient_allergies", description: "Get allergy information for a specific patient.", category: "healthcare", parameters: [{ name: "patientId", type: "string", description: "Patient ID", required: true }] } },
      { definition: { name: "his_list_encounters", description: "List clinical encounters and SOAP notes.", category: "healthcare", parameters: [{ name: "patientId", type: "string", description: "Optional patient ID filter", required: false }] } },
      { definition: { name: "his_list_prescriptions", description: "List medication prescriptions and orders.", category: "healthcare", parameters: [{ name: "patientId", type: "string", description: "Optional patient ID filter", required: false }] } },
      { definition: { name: "his_list_medications", description: "List medications available in the hospital formulary.", category: "healthcare", parameters: [{ name: "query", type: "string", description: "Optional medication search query", required: false }] } },
      { definition: { name: "his_list_alerts", description: "List clinical safety alerts and warnings.", category: "healthcare", parameters: [{ name: "patientId", type: "string", description: "Optional patient ID filter", required: false }] } },
    ],
  },
  {
    manifest: {
      id: "report-gen",
      name: "Report & Chart Generator",
      version: "1.0.0",
      description:
        "Generate Excel spreadsheets, SVG charts, and AI-powered business reports from natural language. Supports invoice/table generation, visualisation, and full report packages with summary + Excel + chart.",
      author: "HiTechClaw",
      category: "productivity",
      tags: ["excel", "xlsx", "chart", "report", "invoice", "visualisation", "business"],
      config: [
        {
          key: "gatewayInternalUrl",
          label: "Gateway Internal URL",
          type: "string",
          description: "Base URL of the gateway service (internal)",
          required: false,
          default: "http://localhost:3000",
        },
      ],
    },
    tools: [
      { definition: { name: "generate_excel_report", description: "Generate an Excel spreadsheet from natural language or explicit data.", category: "productivity", parameters: [{ name: "prompt", type: "string", description: "Report prompt", required: false }, { name: "data", type: "array", description: "Explicit report rows", required: false }, { name: "headers", type: "array", description: "Column headers", required: false }, { name: "sheetName", type: "string", description: "Excel sheet name", required: false }, { name: "title", type: "string", description: "Report title", required: false }, { name: "fileName", type: "string", description: "Output file name", required: false }] } },
      { definition: { name: "generate_chart", description: "Generate a bar, line, or pie chart as inline SVG.", category: "productivity", parameters: [{ name: "prompt", type: "string", description: "Chart prompt", required: false }, { name: "type", type: "string", description: "Chart type", required: false }, { name: "labels", type: "array", description: "Chart labels", required: false }, { name: "datasets", type: "array", description: "Chart datasets", required: false }, { name: "values", type: "array", description: "Pie chart values", required: false }, { name: "title", type: "string", description: "Chart title", required: false }] } },
      { definition: { name: "generate_full_report", description: "Generate a summary, Excel file, and chart in one report workflow.", category: "productivity", parameters: [{ name: "prompt", type: "string", description: "Business report prompt", required: true }, { name: "includeExcel", type: "boolean", description: "Include Excel output", required: false }, { name: "includeChart", type: "boolean", description: "Include chart output", required: false }, { name: "chartType", type: "string", description: "Preferred chart type", required: false }, { name: "fileName", type: "string", description: "File name prefix", required: false }] } },
    ],
  },
];

const builtinSkills = builtinSkillDefinitions.map((skill) => skill.manifest.id);

const BUILTIN_POLICIES: Record<string, AppSandboxPolicy> = {
  strict: {
    name: "strict",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }], defaultAccess: "none" },
    network: { rules: [], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 10 },
  },
  default: {
    name: "default",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  permissive: {
    name: "permissive",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }, { path: "/data", access: "read" }], defaultAccess: "read" },
    network: { rules: [], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 50 },
  },
  gmail: {
    name: "gmail",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "*.googleapis.com", methods: ["GET", "POST"], allow: true }, { host: "oauth2.googleapis.com", methods: ["POST"], allow: true }, { host: "accounts.google.com", methods: ["GET", "POST"], allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  github: {
    name: "github",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "api.github.com", allow: true }, { host: "github.com", methods: ["GET"], allow: true }, { host: "raw.githubusercontent.com", methods: ["GET"], allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  slack: {
    name: "slack",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "slack.com", allow: true }, { host: "*.slack.com", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  notion: {
    name: "notion",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "api.notion.com", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  "web-search": {
    name: "web-search",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "api.tavily.com", allow: true }, { host: "api.search.brave.com", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  telegram: {
    name: "telegram",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "api.telegram.org", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  discord: {
    name: "discord",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "discord.com", allow: true }, { host: "*.discord.com", allow: true }, { host: "gateway.discord.gg", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  zalo: {
    name: "zalo",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "openapi.zalo.me", allow: true }, { host: "oauth.zaloapp.com", allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 20 },
  },
  ml: {
    name: "ml",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }, { path: "/data", access: "read" }], defaultAccess: "read" },
    network: { rules: [{ host: "huggingface.co", allow: true }, { host: "*.huggingface.co", allow: true }, { host: "cdn-lfs.huggingface.co", allow: true }, { host: "pypi.org", methods: ["GET"], allow: true }, { host: "files.pythonhosted.org", methods: ["GET"], allow: true }], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 100 },
  },
  inference: {
    name: "inference",
    version: "1.0.0",
    filesystem: { rules: [{ path: "/tmp", access: "read-write" }, { path: "/home/sandbox", access: "read-write" }, { path: "/usr", access: "read" }, { path: "/lib", access: "read" }, { path: "/data", access: "read" }], defaultAccess: "read" },
    network: { rules: [], defaultAction: "deny" },
    process: { allowPrivilegeEscalation: false, maxProcesses: 30 },
  },
};

const INTEGRATION_POLICIES: Record<string, AppSandboxPolicy> = {
  gmail: BUILTIN_POLICIES.gmail,
  "google-calendar": BUILTIN_POLICIES.gmail,
  github: BUILTIN_POLICIES.github,
  slack: BUILTIN_POLICIES.slack,
  "slack-api": BUILTIN_POLICIES.slack,
  notion: BUILTIN_POLICIES.notion,
  tavily: BUILTIN_POLICIES["web-search"],
  brave: BUILTIN_POLICIES["web-search"],
  telegram: BUILTIN_POLICIES.telegram,
  discord: BUILTIN_POLICIES.discord,
  zalo: BUILTIN_POLICIES.zalo,
};

const GPU_SANDBOX_IMAGES: AppSandboxImage[] = [
  { name: "ml-pytorch", description: "PyTorch + CUDA for deep learning", image: "hitechclaw/sandbox-pytorch:latest", cudaVersion: "12.4", packages: ["torch", "torchvision", "numpy", "pandas", "scikit-learn"], gpuRequired: true },
  { name: "ml-tensorflow", description: "TensorFlow + CUDA for deep learning", image: "hitechclaw/sandbox-tensorflow:latest", cudaVersion: "12.4", packages: ["tensorflow", "numpy", "pandas", "scikit-learn"], gpuRequired: true },
  { name: "ml-sklearn", description: "Scikit-learn for classical ML (CPU only)", image: "hitechclaw/sandbox-sklearn:latest", packages: ["scikit-learn", "numpy", "pandas", "xgboost", "lightgbm"], gpuRequired: false },
  { name: "ml-huggingface", description: "Hugging Face Transformers + CUDA", image: "hitechclaw/sandbox-hf:latest", cudaVersion: "12.4", packages: ["transformers", "torch", "tokenizers", "accelerate", "datasets"], gpuRequired: true },
  { name: "inference-onnx", description: "ONNX Runtime for optimized inference", image: "hitechclaw/sandbox-onnx:latest", packages: ["onnxruntime", "numpy"], gpuRequired: false },
];

const builtinSkillDeepLinks: Record<string, Array<{ href: string; label: string; tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate" }>> = {
  "text-to-fhir": [
    { href: "/tools/domains?pack=healthcare", label: "Open healthcare domain", tone: "purple" },
    { href: "/tools/skills?search=text-to-fhir", label: "Open registry entry", tone: "cyan" },
    { href: "/workflows", label: "Open workflows", tone: "amber" },
  ],
  "report-gen": [
    { href: "/tools/domains?search=report", label: "Open reporting domains", tone: "purple" },
    { href: "/tools/docs?search=report", label: "Open docs", tone: "cyan" },
    { href: "/workflows", label: "Open workflows", tone: "amber" },
  ],
};

const integrationIds = new Set(allIntegrations.map((integration) => integration.id));

function buildSkillRegistryEntries(): SkillRegistryEntry[] {
  const registry = createSkillRegistry();

  for (const pack of allDomainPacks) {
    for (const skill of pack.skills) {
      registry.register({
        id: formatSkillId(pack.id, skill.name),
        name: skill.name,
        description: skill.description,
        domainId: pack.id,
        icon: pack.icon,
        tools: skill.tools.map((tool): SkillHubTool => ({
          name: tool.name,
          description: tool.description,
          parameters: Object.entries(tool.parameters.properties).map(([name, config]): SkillHubParameter => ({
            name,
            type: (config.type === "integer" ? "number" : config.type) as "string" | "number" | "boolean" | "object" | "array",
            description: config.description,
            required: tool.parameters.required?.includes(name),
          })),
        })),
        installed: true,
        version: skill.version,
        tags: [skill.category, pack.id, ...pack.recommendedIntegrations],
        author: "Nguyen Thanh An by Pho Tue SoftWare Solutions JSC",
        trustLevel: "builtin",
        sandboxRequired: false,
        sandboxPolicy: "permissive",
      });
    }
  }

  return registry.list();
}

function renderMarkdown(content: string): string {
  const raw = marked(content) as string;
  // SEC-4: Sanitise HTML before injection to prevent XSS
  if (typeof window !== "undefined" && DOMPurify.isSupported) {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["h1","h2","h3","h4","h5","h6","p","ul","ol","li","a","strong","em","code","pre","blockquote","table","thead","tbody","tr","th","td","hr","br","img","span","div"],
      ALLOWED_ATTR: ["href","src","alt","class","id","target","rel"],
      FORCE_BODY: true,
    });
  }
  return raw;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function usePollingData<T>(url: string, intervalMs = 15000): PollingResult<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const urlRef = useRef(url);
  urlRef.current = url;

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<T>(urlRef.current);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        error: error instanceof Error ? error.message : "Request failed",
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const data = await fetchJson<T>(urlRef.current);
        if (!mounted) return;
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          data: current.data,
          error: error instanceof Error ? error.message : "Request failed",
          loading: false,
        }));
      }
    };

    run();
    const timer = window.setInterval(run, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [intervalMs, url]);

  return { ...state, refresh };
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-ZA", {
    month: "short",
    day: "numeric",
  });
}

function timeAgo(value: string | null | undefined) {
  if (!value) return "Now";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function elapsedLabel(startedAt: string, completedAt: string | null, now: number) {
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const totalSeconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function toneClass(color: "cyan" | "purple" | "amber" | "green" | "red" | "slate") {
  return {
    cyan: "border-cyan/30 bg-cyan/10 text-cyan",
    purple: "border-purple/30 bg-purple/10 text-purple",
    amber: "border-amber/30 bg-amber/10 text-amber",
    green: "border-green/30 bg-green/10 text-green",
    red: "border-red/30 bg-red/10 text-red",
    slate: "border-border bg-bg-deep/80 text-text-dim",
  }[color];
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
        active
          ? "border-cyan/40 bg-cyan/15 text-cyan"
          : "border-border bg-bg-deep/80 text-text-dim"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "cyan" | "purple" | "amber" | "green" | "red" | "slate";
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[78vh] w-full overflow-y-auto rounded-t-[28px] border border-border bg-bg-card p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-3 text-sm text-text-dim"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-text-dim">{label}</div>;
}

const toolLinks = [
  { href: "/tools/approvals", title: "Approvals Queue", note: "Review drafted content and approve or reject from the phone.", tone: "green" as const },
  { href: "/tools/builtin-skills", title: "Built-in Skills", note: "Inspect packaged runtime skills, configs, tool handlers, and workflow rollout hints.", tone: "cyan" as const },
  { href: "/tools/docs", title: "Docs Viewer", note: "Searchable archive of specs, reports, logs, and plans.", tone: "cyan" as const },
  { href: "/tools/domains", title: "Domain Packs", note: "Additive industry presets for agents, skills, and recommended integrations.", tone: "purple" as const },
  { href: "/tools/integrations", title: "Integrations Catalog", note: "Connector inventory with auth, actions, triggers, and risk guidance.", tone: "green" as const },
  { href: "/tools/ml", title: "ML Catalog", note: "Algorithm, task, and AutoML catalog sourced from the local ML engine package.", tone: "amber" as const },
  { href: "/tools/sandbox", title: "Sandbox Lab", note: "Review package policies, GPU images, and isolation guidance before live execution.", tone: "slate" as const },
  { href: "/tools/skills", title: "Skill Registry", note: "Browse built-in skill entries derived from domain packs via the local skill hub SDK.", tone: "cyan" as const },
  { href: "/tools/tasks", title: "Task Board", note: "Kanban board for task and agent priorities.", tone: "amber" as const },
  { href: "/tools/calendar", title: "Content Calendar", note: "Week-first content schedule with day drill-down.", tone: "purple" as const },
  { href: "/tools/agents-live", title: "Sub-Agent Live", note: "Real-time status, logs, tokens, and kill controls.", tone: "green" as const },
  { href: "/tools/command", title: "Quick Command", note: "Chat-like command surface for direct agent requests.", tone: "cyan" as const },
  { href: "/actions", title: "Actions", note: "Existing action list remains available from the hub.", tone: "slate" as const },
  { href: "/confessions", title: "Confessions", note: "Mission-aligned declarations and scriptures.", tone: "purple" as const },
  { href: "/visuals", title: "Visuals", note: "Visual briefing and live diagrams.", tone: "amber" as const },
];

const packageMenuSections: Array<{
  title: string;
  note: string;
  items: Array<{ href: string; label: string; description: string; tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate" }>;
}> = [
  {
    title: "Package Functions",
    note: "Function nào menu đó — each integrated package now has a direct menu destination.",
    items: [
      { href: "/client/chat", label: "AI Chat", description: "Open the packaged chat workspace for conversations, summaries, and assistant flows.", tone: "green" },
      { href: "/tools/builtin-skills", label: "Built-in Skills", description: "Inspect packaged runtime skills from @hitechclaw/skills and their workflow-fit metadata.", tone: "cyan" },
      { href: "/tools/domains", label: "Domain Packs", description: "Browse domain presets, recommended integrations, and packaged operating patterns.", tone: "purple" },
      { href: "/tools/integrations", label: "Integrations Catalog", description: "Inspect connectors, auth models, triggers, and supported actions from the integrations package.", tone: "green" },
      { href: "/tools/skills", label: "Skill Registry", description: "Review packaged skill entries, tools, and domain-linked execution capabilities.", tone: "cyan" },
      { href: "/tools/ml", label: "ML Catalog", description: "Explore algorithms, supported tasks, and local ML engine references.", tone: "amber" },
      { href: "/tools/sandbox", label: "Sandbox Lab", description: "Review isolation policies, GPU-ready images, and integration allow-lists from the sandbox package.", tone: "slate" },
      { href: "/tools/docs", label: "Docs Library", description: "Read indexed docs and package guidance from the documentation module.", tone: "cyan" },
      { href: "/tools/mcp", label: "MCP Inventory", description: "Manage MCP servers, imports, and execution gateways from the tooling layer.", tone: "slate" },
    ],
  },
];

const packageWorkspaceItems: Array<{
  id: "chat" | "docs" | "domains" | "integrations" | "skills" | "builtin-skills" | "ml" | "sandbox" | "mcp";
  href: string;
  label: string;
  description: string;
  tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate";
}> = [
  {
    id: "chat",
    href: "/client/chat",
    label: "AI Chat",
    description: "Chat workspace from the packaged client SDK.",
    tone: "green",
  },
  {
    id: "docs",
    href: "/tools/docs",
    label: "Docs Library",
    description: "Repository and package knowledge base.",
    tone: "cyan",
  },
  {
    id: "domains",
    href: "/tools/domains",
    label: "Domain Packs",
    description: "Industry presets, personas, and packaged skills.",
    tone: "purple",
  },
  {
    id: "integrations",
    href: "/tools/integrations",
    label: "Integrations",
    description: "Connector catalog, auth models, and actions.",
    tone: "green",
  },
  {
    id: "builtin-skills",
    href: "/tools/builtin-skills",
    label: "Built-in Skills",
    description: "Runtime-ready packaged skills and their handlers.",
    tone: "cyan",
  },
  {
    id: "skills",
    href: "/tools/skills",
    label: "Skill Registry",
    description: "Marketplace-style view of packaged skills.",
    tone: "cyan",
  },
  {
    id: "ml",
    href: "/tools/ml",
    label: "ML Catalog",
    description: "Algorithms, tasks, and hyperparameter guidance.",
    tone: "amber",
  },
  {
    id: "sandbox",
    href: "/tools/sandbox",
    label: "Sandbox Lab",
    description: "Isolation policies, GPU images, and safe execution baselines.",
    tone: "slate",
  },
  {
    id: "mcp",
    href: "/tools/mcp",
    label: "MCP Inventory",
    description: "Provider registry, imports, and execution gateways.",
    tone: "slate",
  },
];

const packageOverviewGroups: Array<{
  title: string;
  note: string;
  items: Array<{ label: string; href: string; description: string; tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate" }>;
}> = [
  {
    title: "Discover",
    note: "Browse package knowledge and reusable building blocks.",
    items: [
      {
        label: "Domain Packs",
        href: "/tools/domains",
        description: "Industry presets, personas, and rollout guidance.",
        tone: "purple",
      },
      {
        label: "Skill Registry",
        href: "/tools/skills",
        description: "Marketplace-style view of packaged skills and tools.",
        tone: "cyan",
      },
      {
        label: "Built-in Skills",
        href: "/tools/builtin-skills",
        description: "Runtime-ready skill package manifests, configs, and handlers.",
        tone: "cyan",
      },
      {
        label: "ML Catalog",
        href: "/tools/ml",
        description: "Algorithms, tasks, and hyperparameter references.",
        tone: "amber",
      },
    ],
  },
  {
    title: "Connect",
    note: "Move from packaged definitions into usable workflows.",
    items: [
      {
        label: "Integrations",
        href: "/tools/integrations",
        description: "Connector inventory with auth, triggers, and actions.",
        tone: "green",
      },
      {
        label: "Docs Library",
        href: "/tools/docs",
        description: "Workspace and package-backed documentation search.",
        tone: "cyan",
      },
      {
        label: "AI Chat",
        href: "/client/chat",
        description: "Client-facing conversation workspace backed by the chat SDK.",
        tone: "green",
      },
    ],
  },
  {
    title: "Operate",
    note: "Keep execution and provider control aligned with current flows.",
    items: [
      {
        label: "MCP Inventory",
        href: "/tools/mcp",
        description: "Manage providers, imports, and execution gateways.",
        tone: "slate",
      },
      {
        label: "Sandbox Lab",
        href: "/tools/sandbox",
        description: "Review packaged sandbox policies before connecting live execution.",
        tone: "slate",
      },
      {
        label: "Approvals Queue",
        href: "/tools/approvals",
        description: "Preserve approval gates for risky or moderated actions.",
        tone: "green",
      },
      {
        label: "Workflows",
        href: "/workflows",
        description: "Bridge package capabilities into repeatable operations.",
        tone: "amber",
      },
    ],
  },
];

const toolsControlLanes: Array<{
  title: string;
  href: string;
  tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate";
  summary: string;
  bullets: string[];
}> = [
  {
    title: "Review and approve",
    href: "/tools/approvals",
    tone: "green",
    summary: "Keep risky actions gated with fast approval handling, reviewer notes, and audit-ready decisions.",
    bullets: ["Moderated actions", "Mobile-friendly queue", "Explicit approval trail"],
  },
  {
    title: "Coordinate work",
    href: "/tools/tasks",
    tone: "amber",
    summary: "Use the task board and calendar surfaces as the operator layer for package-backed execution.",
    bullets: ["Task priorities", "Calendar drill-down", "Human + agent coordination"],
  },
  {
    title: "Run live operations",
    href: "/tools/agents-live",
    tone: "cyan",
    summary: "Watch active sub-agents, inspect outputs, and terminate unhealthy runs before they create incidents.",
    bullets: ["Run status", "Token visibility", "Fast kill controls"],
  },
  {
    title: "Expand capability",
    href: "/tools/integrations",
    tone: "purple",
    summary: "Move from package discovery into safe rollout through integrations, skills, sandbox policy, and MCP inventory.",
    bullets: ["Connector readiness", "Skill packaging", "Execution guardrails"],
  },
];

const toolsOperatingRhythm: Array<{
  step: string;
  title: string;
  description: string;
  href: string;
  tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate";
}> = [
  {
    step: "01",
    title: "Discover the package surface",
    description: "Start with domains, built-in skills, integrations, and ML references before wiring anything live.",
    href: "/tools/domains",
    tone: "purple",
  },
  {
    step: "02",
    title: "Verify docs and control plane assumptions",
    description: "Check docs, MCP inventory, and sandbox policy so rollout stays aligned with current governance.",
    href: "/tools/docs",
    tone: "cyan",
  },
  {
    step: "03",
    title: "Execute through managed routes",
    description: "Use approvals, tasks, quick command, and live sub-agent monitoring as the operational handoff layer.",
    href: "/tools/command",
    tone: "green",
  },
];

function ToolsControlCenter() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <Card className="space-y-4 border-border/70 bg-bg-deep/40">
        <SectionTitle title="Control lanes" note="Turn the tools area into an operator-first control center." />
        <div className="grid gap-3 md:grid-cols-2">
          {toolsControlLanes.map((lane) => (
            <Link
              key={lane.href}
              href={lane.href}
              className="rounded-[22px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Badge tone={lane.tone}>{lane.title}</Badge>
                <span className="text-xs text-text-dim">Open</span>
              </div>
              <p className="text-sm leading-6 text-text-dim">{lane.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lane.bullets.map((bullet) => (
                  <span
                    key={`${lane.href}-${bullet}`}
                    className="rounded-full border border-border/80 px-2.5 py-1 text-[11px] font-medium text-text-dim"
                  >
                    {bullet}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3 border-border/70 bg-bg-deep/40">
          <SectionTitle title="Operator rhythm" note="Recommended sequence for package-backed rollout and control." />
          <div className="space-y-3">
            {toolsOperatingRhythm.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex gap-3 rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border text-sm font-semibold text-text">
                  {item.step}
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={item.tone}>{item.title}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-text-dim">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 border-border/70 bg-bg-deep/40">
          <SectionTitle title="Mission intent" note="What this landing page should optimize for." />
          <ul className="space-y-2 text-sm leading-6 text-text-dim">
            <li>• Route operators to the highest-value control surfaces first, not just a long menu.</li>
            <li>• Keep package discovery separate from live execution so rollout remains deliberate.</li>
            <li>• Preserve approvals, sandbox policy, and MCP visibility before enabling deeper automation.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ToolsLiveSnapshot() {
  const now = useNow(60000);
  const approvals = usePollingData<{ items: ApprovalItem[]; pendingCount: number }>("/api/tools/approvals?status=all", 15000);
  const tasks = usePollingData<{ items: TaskItem[] }>("/api/tools/tasks", 15000);
  const agents = usePollingData<{ items: SubagentRun[] }>("/api/tools/agents-live", 5000);
  const commands = usePollingData<{ items: QuickCommand[] }>("/api/tools/commands?limit=6", 5000);

  const calendarRange = useMemo(() => {
    const start = getWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, []);

  const calendar = usePollingData<{ items: CalendarItem[] }>(
    `/api/tools/calendar?start=${calendarRange.start}&end=${calendarRange.end}`,
    20000
  );

  const taskItems = tasks.data?.items ?? [];
  const activeTasks = taskItems.filter((item) => item.status === "in_progress").length;
  const overdueTasks = taskItems.filter(
    (item) => item.status !== "done" && item.due_date && new Date(item.due_date).getTime() < now
  ).length;
  const runningAgents = (agents.data?.items ?? []).filter((item) => item.status === "running").length;
  const failedAgents = (agents.data?.items ?? []).filter((item) => item.status === "failed").length;
  const upcomingCalendar = (calendar.data?.items ?? []).filter((item) => new Date(item.scheduled_at).getTime() >= now).length;
  const queuedCommands = (commands.data?.items ?? []).filter((item) => item.status !== "completed").length;

  const spotlightApprovals = (approvals.data?.items ?? [])
    .filter((item) => item.status === "pending")
    .slice(0, 3);

  const spotlightTasks = taskItems
    .filter((item) => item.status !== "done")
    .sort((left, right) => {
      const leftPriority = left.priority === "P1" ? 0 : left.priority === "P2" ? 1 : 2;
      const rightPriority = right.priority === "P1" ? 0 : right.priority === "P2" ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return (left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER)
        - (right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER);
    })
    .slice(0, 3);

  const spotlightRuns = (agents.data?.items ?? []).slice(0, 3);
  const spotlightSchedule = (calendar.data?.items ?? [])
    .slice()
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())
    .slice(0, 3);

  const loading = [approvals, tasks, agents, commands, calendar].some((state) => state.loading && !state.data);
  const errors = [approvals.error, tasks.error, agents.error, commands.error, calendar.error].filter(Boolean) as string[];

  if (loading) {
    return <LoadingState label="Loading live tools snapshot" />;
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-border/70 bg-bg-deep/40">
        <SectionTitle title="Live operational snapshot" note="Real-time view across approvals, work coordination, schedule, and active agents." />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <StatCard label="Pending approvals" value={String(approvals.data?.pendingCount ?? 0)} accent="text-green" sublabel="Requests waiting for review" />
          <StatCard label="Active tasks" value={String(activeTasks)} accent="text-amber" sublabel="Work items currently in progress" />
          <StatCard label="Overdue tasks" value={String(overdueTasks)} accent="text-red" sublabel="Open work past due date" />
          <StatCard label="Running agents" value={String(runningAgents)} accent="text-cyan" sublabel="Live sub-agent executions" />
          <StatCard label="Upcoming events" value={String(upcomingCalendar)} accent="text-purple" sublabel="Scheduled items in this week window" />
          <StatCard label="Queued commands" value={String(queuedCommands)} accent="text-slate" sublabel="Recent commands still awaiting completion" />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 border-border/70 bg-bg-deep/40">
          <SectionTitle title="Priority queue" note="What operators should look at first." />
          <div className="space-y-3">
            {spotlightApprovals.map((item) => (
              <Link key={`approval-${item.id}`} href="/tools/approvals" className="block rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="green">Approval</Badge>
                    <Badge tone={item.priority === "urgent" ? "red" : item.priority === "low" ? "slate" : "cyan"}>{item.priority}</Badge>
                  </div>
                  <span className="text-xs text-text-dim">{timeAgo(item.created_at)}</span>
                </div>
                <div className="text-sm font-semibold text-text">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-text-dim line-clamp-2">{item.content}</p>
              </Link>
            ))}

            {spotlightTasks.map((item) => (
              <Link key={`task-${item.id}`} href="/tools/tasks" className="block rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="amber">Task</Badge>
                    <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                  </div>
                  <span className={`text-xs ${item.due_date && new Date(item.due_date).getTime() < now ? "text-red" : "text-text-dim"}`}>
                    {item.due_date ? formatShortDate(item.due_date) : "No due"}
                  </span>
                </div>
                <div className="text-sm font-semibold text-text">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-text-dim">{item.description ?? "No description supplied."}</p>
              </Link>
            ))}

            {!spotlightApprovals.length && !spotlightTasks.length ? <EmptyState label="No approval or task pressure detected right now." /> : null}
          </div>
        </Card>

        <Card className="space-y-3 border-border/70 bg-bg-deep/40">
          <SectionTitle title="Execution monitor" note="Live agent activity and immediate schedule context." />
          <div className="space-y-3">
            {spotlightRuns.map((run) => (
              <Link key={`run-${run.id}`} href="/tools/agents-live" className="block rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={runTone(run.status)}>{run.status}</Badge>
                    <Badge tone="purple">{run.model}</Badge>
                  </div>
                  <span className="text-xs text-text-dim">{elapsedLabel(run.started_at, run.completed_at, now)}</span>
                </div>
                <div className="text-sm font-semibold text-text">{run.run_label}</div>
                <p className="mt-1 text-sm leading-6 text-text-dim">{run.task_summary ?? run.error_message ?? "No summary supplied."}</p>
              </Link>
            ))}

            {spotlightSchedule.map((item) => (
              <Link key={`calendar-${item.id}`} href="/tools/calendar" className="block rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="purple">{item.item_type}</Badge>
                    <Badge tone={item.status === "published" ? "green" : item.status === "cancelled" ? "red" : "amber"}>{item.status}</Badge>
                  </div>
                  <span className="text-xs text-text-dim">{formatDate(item.scheduled_at)}</span>
                </div>
                <div className="text-sm font-semibold text-text">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-text-dim">{item.description ?? "No schedule notes supplied."}</p>
              </Link>
            ))}

            {!spotlightRuns.length && !spotlightSchedule.length ? <EmptyState label="No active runs or scheduled events in the current window." /> : null}
          </div>
        </Card>
      </div>

      <Card className="space-y-3 border-border/70 bg-bg-deep/40">
        <SectionTitle title="Command pulse" note="Recent operator-to-agent requests and execution backlog." />
        <div className="grid gap-3 lg:grid-cols-3">
          {(commands.data?.items ?? []).slice(0, 3).map((entry) => (
            <Link key={`command-${entry.id}`} href="/tools/command" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge tone={entry.status === "completed" ? "green" : entry.status === "processing" ? "amber" : "slate"}>{entry.status}</Badge>
                <span className="text-xs text-text-dim">{timeAgo(entry.created_at)}</span>
              </div>
              <div className="text-sm font-semibold text-text line-clamp-2">{entry.command}</div>
              <p className="mt-1 text-sm leading-6 text-text-dim line-clamp-3">{entry.response ?? "Awaiting response from agent."}</p>
            </Link>
          ))}
          {!commands.data?.items?.length ? <EmptyState label="No recent command traffic." /> : null}
        </div>
        {failedAgents > 0 ? <div className="text-sm text-red">{failedAgents} recent sub-agent run(s) reported a failed status and may require follow-up.</div> : null}
        {errors.length ? <ErrorState error={errors[0]} /> : null}
      </Card>
    </div>
  );
}

function PackageOverviewDashboard() {
  const skillEntries = useMemo(() => buildSkillRegistryEntries(), []);
  const builtinSkillCount = builtinSkills.length;
  const sandboxPolicyCount = Object.keys(BUILTIN_POLICIES).length;
  const totalDomainTools = useMemo(
    () => allDomainPacks.reduce((sum, pack) => sum + countDomainTools(pack), 0),
    []
  );
  const packageStats = [
    {
      label: "Package modules",
      value: packageWorkspaceItems.length.toString(),
      accent: "text-cyan",
      sublabel: "Unified package-driven destinations now surfaced in UI",
    },
    {
      label: "Domain skills",
      value: allDomainPacks.reduce((sum, pack) => sum + pack.skills.length, 0).toString(),
      accent: "text-purple",
      sublabel: "Reusable skills sourced from local domain packs",
    },
    {
      label: "Registry entries",
      value: skillEntries.length.toString(),
      accent: "text-green",
      sublabel: "Generated skill registry items ready for discovery",
    },
    {
      label: "ML algorithms",
      value: algorithms.length.toString(),
      accent: "text-amber",
      sublabel: "Catalogued algorithms available for future ML workflows",
    },
    {
      label: "Built-in skills",
      value: builtinSkillCount.toString(),
      accent: "text-cyan",
      sublabel: "Packaged runtime skills ready for guided rollout",
    },
    {
      label: "Sandbox policies",
      value: sandboxPolicyCount.toString(),
      accent: "text-slate",
      sublabel: "Isolation baselines for sensitive tools and ML jobs",
    },
  ] as const;

  return (
    <Card>
      <SectionTitle title="Package Overview" note="Shared dashboard for all integrated package capabilities" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {packageStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            accent={stat.accent}
            sublabel={stat.sublabel}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          {packageOverviewGroups.map((group) => (
            <Card key={group.title} className="space-y-3 border-border/70 bg-bg-deep/40">
              <SectionTitle title={group.title} note={group.note} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={`${group.title}-${item.href}`}
                    href={item.href}
                    className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Badge tone={item.tone}>{item.label}</Badge>
                      <span className="text-xs text-text-dim">Open</span>
                    </div>
                    <p className="text-sm leading-6 text-text-dim">{item.description}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 border-border/70 bg-bg-deep/40">
            <SectionTitle title="Coverage" note="Current package surface area" />
            <ul className="space-y-2 text-sm leading-6 text-text-dim">
              <li>• {allDomainPacks.length} domain packs with {totalDomainTools} packaged helper tools.</li>
              <li>• {allIntegrations.length} integration definitions with additive rollout guidance.</li>
              <li>• {skillEntries.length} skill registry entries linked back to domains and integrations.</li>
              <li>• {algorithms.length} ML algorithms exposed as a browse-only catalog.</li>
              <li>• {builtinSkillCount} packaged runtime skills exposed without wiring risky live execution.</li>
              <li>• {sandboxPolicyCount} sandbox policies and {GPU_SANDBOX_IMAGES.length} GPU image presets documented for safe rollout.</li>
            </ul>
          </Card>

          <Card className="space-y-3 border-border/70 bg-bg-deep/40">
            <SectionTitle title="Recommended flow" note="Use packages without replacing existing features" />
            <ul className="space-y-2 text-sm leading-6 text-text-dim">
              <li>• Discover reusable patterns in `Domains`, `Skills`, and `ML` first.</li>
              <li>• Validate connector assumptions in `Integrations` and `Docs` before rollout.</li>
              <li>• Execute through `AI Chat`, `MCP`, approvals, and existing workflows.</li>
            </ul>
          </Card>
        </div>
      </div>
    </Card>
  );
}

function PackageWorkspaceNav({
  current,
  title = "Package Workspace",
  note = "Unified navigation for package-driven functions.",
}: {
  current: (typeof packageWorkspaceItems)[number]["id"];
  title?: string;
  note?: string;
}) {
  return (
    <Card>
      <SectionTitle title={title} note={note} />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {packageWorkspaceItems.map((item) => {
          const active = item.id === current;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`rounded-[22px] border p-4 transition ${
                active
                  ? "border-cyan/40 bg-cyan/5"
                  : "border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] hover:border-cyan/30"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Badge tone={item.tone}>{item.label}</Badge>
                <span className="text-xs text-text-dim">{active ? "Active" : "Open"}</span>
              </div>
              <p className="text-sm leading-6 text-text-dim">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function PackageActionBar({
  title = "Action bar",
  note = "Move across related package functions.",
  items,
}: {
  title?: string;
  note?: string;
  items: Array<{ href: string; label: string; tone: "cyan" | "purple" | "amber" | "green" | "red" | "slate" }>;
}) {
  if (!items.length) return null;

  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title={title} note={note} />
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link key={`${item.href}-${item.label}`} href={item.href}>
            <Badge tone={item.tone}>{item.label}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function ToolsHubScreen() {
  return (
    <div className="space-y-5">
      <ShellHeader
        title="Tools"
        subtitle="Control center landing page for package discovery, governed execution, live agent operations, and operator workflow handoff."
      />

      <SectionDescription id="tools-control-center">
        Use this page as the operational front door for package-backed capabilities. Discover reusable building blocks, verify governance assumptions, then move into approvals, task coordination, quick commands, and live sub-agent control without losing guardrails.
      </SectionDescription>

      <ToolsControlCenter />

      <ToolsLiveSnapshot />

      <PackageOverviewDashboard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Control Surfaces" value={toolLinks.length.toString()} accent="text-cyan" sublabel="Operational routes reachable from this hub" />
        <StatCard label="Package Modules" value={packageWorkspaceItems.length.toString()} accent="text-purple" sublabel="Package-backed destinations with dedicated pages" />
        <StatCard label="Control Lanes" value={toolsControlLanes.length.toString()} accent="text-amber" sublabel="Primary operator workflows surfaced first" />
        <StatCard label="Live Ops" value="5s" accent="text-green" sublabel="Polling cadence retained for active run monitoring" />
      </div>

      <Card>
        <SectionTitle title="Tool Grid" note="HiTechClaw AI phase 5" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {toolLinks.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="min-h-28 rounded-[22px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-4 transition hover:border-cyan/40"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Badge tone={tool.tone}>{tool.title}</Badge>
                <span className="text-xs text-text-dim">Open</span>
              </div>
              <p className="text-sm leading-6 text-text-dim">{tool.note}</p>
            </Link>
          ))}
        </div>
      </Card>

      {packageMenuSections.map((section) => (
        <Card key={section.title}>
          <SectionTitle title={section.title} note={section.note} />
          <div className="grid gap-3 lg:grid-cols-2">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[22px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-4 transition hover:border-cyan/40"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge tone={item.tone}>{item.label}</Badge>
                  <span className="text-xs text-text-dim">Menu</span>
                </div>
                <p className="text-sm leading-6 text-text-dim">{item.description}</p>
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ApprovalsToolScreen() {
  const [filter, setFilter] = useState("all");
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [offsets, setOffsets] = useState<Record<number, number>>({});
  const touchStart = useRef<Record<number, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, error, loading } = usePollingData<{ items: ApprovalItem[]; pendingCount: number }>(
    `/api/tools/approvals?status=${filter}&_r=${refreshKey}`,
    12000
  );

  const revalidate = () => setRefreshKey((k) => k + 1);

  const updateStatus = async (id: number, status: string, reviewerNote?: string) => {
    setMutatingId(id);
    try {
      await fetchJson(`/api/tools/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewer_note: reviewerNote || null }),
      });
      revalidate();
      toast.success(`Approval ${status}`);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Update failed");
    } finally {
      setMutatingId(null);
      setOffsets((current) => ({ ...current, [id]: 0 }));
    }
  };

  const bulkAction = async (status: string) => {
    for (const id of selectedIds) {
      await updateStatus(id, status);
    }
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading && !data) return <LoadingState label="Loading approvals" />;

  const pendingItems = data?.items.filter((i) => i.status === "pending") ?? [];

  return (
    <div className="space-y-5">
      <ShellHeader
        title="Approvals Queue"
        subtitle="Review, approve, or reject agent content. Swipe or use buttons. Add notes for audit trail."
        action={<Badge tone="amber">{data?.pendingCount ?? 0} pending</Badge>}
      />
      <SectionDescription id="approvals">
        Review and act on pending approval requests from your agents. When agents request permission for sensitive actions — spending over a threshold, executing commands, or accessing restricted tools — the requests appear here for your review.
      </SectionDescription>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["all", "pending", "approved", "rejected", "expired"].map((tab) => (
          <Pill key={tab} active={filter === tab} onClick={() => setFilter(tab)}>
            {tab[0]?.toUpperCase()}{tab.slice(1)}
          </Pill>
        ))}
        <div className="flex-1" />
        {pendingItems.length > 1 && (
          <button
            type="button"
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
            className={`min-h-9 rounded-xl border px-3 text-xs font-semibold transition ${
              bulkMode ? "border-cyan/40 bg-cyan/15 text-cyan" : "border-border bg-bg-deep/80 text-text-dim"
            }`}
          >
            {bulkMode ? "Cancel" : "Bulk"}
          </button>
        )}
      </div>

      {bulkMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/5 p-3">
          <span className="text-sm text-cyan font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button type="button" onClick={() => void bulkAction("rejected")}
            className="min-h-9 rounded-xl border border-red/30 bg-red/10 px-4 text-xs font-semibold text-red">
            Reject All
          </button>
          <button type="button" onClick={() => void bulkAction("approved")}
            className="min-h-9 rounded-xl border border-green/30 bg-green/10 px-4 text-xs font-semibold text-green">
            Approve All
          </button>
        </div>
      )}

      {data?.items.length ? (
        <div className="space-y-4">
          {data.items.map((item) => {
            const offset = offsets[item.id] ?? 0;
            const isExpanded = expandedId === item.id;
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-[24px] transition ${
                  isSelected ? "ring-2 ring-cyan/40" :
                  offset > 40 ? "shadow-[0_0_40px_rgba(34,197,94,0.15)]" :
                  offset < -40 ? "shadow-[0_0_40px_rgba(239,68,68,0.18)]" : ""
                }`}
              >
                <Card className="transition-transform">
                  <div
                    className="space-y-4"
                    style={{ transform: `translateX(${offset}px)` }}
                    onTouchStart={(event) => {
                      touchStart.current[item.id] = event.touches[0]?.clientX ?? 0;
                    }}
                    onTouchMove={(event) => {
                      const start = touchStart.current[item.id] ?? 0;
                      const delta = (event.touches[0]?.clientX ?? 0) - start;
                      setOffsets((current) => ({ ...current, [item.id]: Math.max(-120, Math.min(120, delta)) }));
                    }}
                    onTouchEnd={() => {
                      const delta = offsets[item.id] ?? 0;
                      if (delta > 96) { void updateStatus(item.id, "approved"); return; }
                      if (delta < -96) { void updateStatus(item.id, "rejected"); return; }
                      setOffsets((current) => ({ ...current, [item.id]: 0 }));
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {bulkMode && item.status === "pending" && (
                          <button type="button" onClick={() => toggleSelect(item.id)}
                            className={`mt-1 h-5 w-5 rounded border flex-shrink-0 flex items-center justify-center transition ${
                              isSelected ? "border-cyan bg-cyan text-black" : "border-border"
                            }`}>
                            {isSelected && <span className="text-xs">\u2713</span>}
                          </button>
                        )}
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={
                              item.status === "pending" ? "amber" :
                              item.status === "approved" ? "green" :
                              item.status === "expired" ? "slate" : "red"
                            }>
                              {item.status}
                            </Badge>
                            <Badge tone="purple">{item.target_channel ?? "general"}</Badge>
                            <Badge tone={item.priority === "urgent" ? "red" : item.priority === "low" ? "slate" : "cyan"}>
                              {item.priority}
                            </Badge>
                            {item.expires_at && item.status === "pending" && (
                              <Badge tone="slate">expires {formatShortDate(item.expires_at)}</Badge>
                            )}
                          </div>
                          <h2 className="mt-3 text-lg font-semibold text-text">{item.title}</h2>
                          <p className="mt-1 text-xs text-text-dim">
                            {item.agent_name || item.agent_id} \u00b7 {timeAgo(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-text-dim">
                        <div>{item.target_destination ?? "No destination"}</div>
                        {item.reviewed_at ? <div className="mt-1">Reviewed {formatShortDate(item.reviewed_at)}</div> : null}
                      </div>
                    </div>

                    {/* Content — expandable */}
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <p className={`text-sm leading-6 text-text ${isExpanded ? "" : "line-clamp-3"}`}>
                        {item.content}
                      </p>
                      {!isExpanded && item.content.length > 200 && (
                        <span className="text-xs text-cyan mt-1 inline-block">Show more \u2193</span>
                      )}
                      {isExpanded && (
                        <span className="text-xs text-text-dim mt-1 inline-block">Show less \u2191</span>
                      )}
                    </div>

                    {/* Reviewer note display */}
                    {item.reviewer_note ? (
                      <div className="rounded-2xl border border-border bg-bg-deep/70 p-3 text-sm text-text-dim">
                        <span className="text-xs font-semibold text-text-dim block mb-1">Reviewer Note</span>
                        {item.reviewer_note}
                      </div>
                    ) : null}

                    {/* Reviewer note input (for pending items) */}
                    {item.status === "pending" && (
                      <input
                        type="text"
                        placeholder="Add a note (optional)..."
                        value={noteInput[item.id] ?? ""}
                        onChange={(e) => setNoteInput((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-bg-deep/50 px-3 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-cyan/40 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    {/* Action buttons */}
                    {item.status === "pending" && !bulkMode && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={mutatingId === item.id}
                          onClick={() => void updateStatus(item.id, "rejected", noteInput[item.id])}
                          className="min-h-11 rounded-2xl border border-red/30 bg-red/10 text-sm font-semibold text-red"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={mutatingId === item.id}
                          onClick={() => void updateStatus(item.id, "approved", noteInput[item.id])}
                          className="min-h-11 rounded-2xl border border-green/30 bg-green/10 text-sm font-semibold text-green"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState label="No approvals match the current filter." />
      )}

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}


const docCategories = ["all", "sop", "spec", "report", "log", "plan", "research", "guide", "brief", "other"];

export function DocsToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<LibraryDocItem | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [loadingLibraryDoc, setLoadingLibraryDoc] = useState(false);
  const selectedId = searchParams.get("id");
  const selectedLibraryId = searchParams.get("library");
  const deferredSearch = useDeferredValue(search.trim());
  const queryString = `/api/tools/docs?category=${category}${deferredSearch ? `&search=${encodeURIComponent(deferredSearch)}` : ""}`;
  const libraryQueryString = `/api/tools/docs/library?limit=8${category !== "all" ? `&category=${encodeURIComponent(category)}` : ""}${deferredSearch ? `&search=${encodeURIComponent(deferredSearch)}` : ""}`;
  const { data, error, loading, refresh } = usePollingData<{ items: DocumentItem[] }>(queryString, 20000);
  const {
    data: libraryData,
    error: libraryError,
    loading: libraryLoading,
  } = usePollingData<LibraryDocsResponse>(libraryQueryString, 30000);

  const openDoc = async (id: number) => {
    try {
      setLoadingDoc(true);
      setSelectedLibrary(null);
      const document = await fetchJson<DocumentItem>(`/api/tools/docs/${id}`);
      setSelected(document);
      router.replace(`/tools/docs?id=${id}`);
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : 'Open failed');
    } finally {
      setLoadingDoc(false);
    }
  };

  const openLibraryDoc = async (id: string) => {
    try {
      setLoadingLibraryDoc(true);
      setSelected(null);
      const document = await fetchJson<LibraryDocItem>(`/api/tools/docs/library?id=${encodeURIComponent(id)}`);
      setSelectedLibrary(document);
      router.replace(`/tools/docs?library=${encodeURIComponent(id)}`);
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : "Open failed");
    } finally {
      setLoadingLibraryDoc(false);
    }
  };

  const togglePin = async (doc: DocumentItem) => {
    try {
      const updated = await fetchJson<DocumentItem>(`/api/tools/docs/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !doc.pinned }),
      });
      if (selected?.id === updated.id) setSelected(updated);
      await refresh();
    } catch (pinError) {
      toast.error(pinError instanceof Error ? pinError.message : 'Pin failed');
    }
  };

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setLoadingDoc(false);
      return;
    }

    const parsedId = Number.parseInt(selectedId, 10);
    if (!Number.isFinite(parsedId)) {
      setSelected(null);
      setLoadingDoc(false);
      return;
    }
    if (selected?.id === parsedId) return;

    let mounted = true;

    const run = async () => {
      try {
        setLoadingDoc(true);
        const document = await fetchJson<DocumentItem>(`/api/tools/docs/${parsedId}`);
        if (!mounted) return;
        setSelected(document);
      } catch (openError) {
        if (!mounted) return;
        toast.error(openError instanceof Error ? openError.message : 'Open failed');
      } finally {
        if (mounted) setLoadingDoc(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [selected?.id, selectedId]);

  useEffect(() => {
    if (!selectedLibraryId) {
      setSelectedLibrary(null);
      setLoadingLibraryDoc(false);
      return;
    }

    if (selectedLibrary?.id === selectedLibraryId) return;
    let mounted = true;

    const run = async () => {
      try {
        setLoadingLibraryDoc(true);
        const document = await fetchJson<LibraryDocItem>(`/api/tools/docs/library?id=${encodeURIComponent(selectedLibraryId)}`);
        if (!mounted) return;
        setSelectedLibrary(document);
      } catch (openError) {
        if (!mounted) return;
        toast.error(openError instanceof Error ? openError.message : "Open failed");
      } finally {
        if (mounted) setLoadingLibraryDoc(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [selectedLibrary?.id, selectedLibraryId]);

  const clearSelection = () => {
    setSelected(null);
    setSelectedLibrary(null);
    router.replace("/tools/docs");
  };

  if (loading && !data) return <LoadingState label="Loading docs" />;

  return (
    <div className="space-y-5">
      <ShellHeader
        title="Docs Viewer"
        subtitle="Sticky search, category pills, and a full-screen markdown viewer for plans, logs, briefs, and reports."
      />

      <PackageWorkspaceNav current="docs" note="Switch across package catalogs, docs, MCP, and chat without leaving the tools workspace." />

      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-bg-deep/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search titles and content"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-card px-4 text-sm text-text outline-none"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {docCategories.map((pill) => (
            <Pill key={pill} active={category === pill} onClick={() => setCategory(pill)}>
              {pill === "all" ? "All" : pill}
            </Pill>
          ))}
        </div>
      </div>

      {libraryData?.stats ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label="Repo docs"
            value={libraryData.stats.totalDocs.toString()}
            accent="text-cyan-300"
            sublabel={`${libraryData.stats.categories.length} categories indexed from /docs`}
          />
          <StatCard
            label="Doc words"
            value={libraryData.stats.totalWords.toLocaleString()}
            accent="text-emerald-300"
            sublabel="File-based knowledge via @hitechclaw/doc-mcp"
          />
          <StatCard
            label="Doc tags"
            value={libraryData.stats.tags.length.toString()}
            accent="text-violet-300"
            sublabel="Searchable package-driven documentation metadata"
          />
        </div>
      ) : null}

      {selected || selectedLibrary || loadingDoc || loadingLibraryDoc ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mb-3 text-sm font-semibold text-cyan"
                >
                  ← Back to documents
                </button>
                <div className="flex flex-wrap gap-2">
                  {selected ? <Badge tone="purple">{selected.category}</Badge> : null}
                  {selectedLibrary ? <Badge tone="cyan">{selectedLibrary.category}</Badge> : null}
                  {selected?.pinned ? <Badge tone="amber">Pinned</Badge> : null}
                  {selected?.file_path ? <Badge tone="slate">{selected.file_path}</Badge> : null}
                  {selectedLibrary?.filePath ? <Badge tone="slate">{selectedLibrary.filePath}</Badge> : null}
                  {selectedLibrary?.version ? <Badge tone="amber">v{selectedLibrary.version}</Badge> : null}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-text">
                  {selected?.title ?? selectedLibrary?.title ?? "Loading document"}
                </h2>
                <p className="mt-2 text-sm text-text-dim">
                  {selected
                    ? `${formatShortDate(selected.updated_at)} · ${selected.word_count ?? 0} words`
                    : selectedLibrary
                      ? `${formatShortDate(selectedLibrary.updatedAt)} · ${selectedLibrary.wordCount ?? 0} words`
                    : "Fetching document content"}
                </p>
              </div>
              {selected ? (
                <button
                  type="button"
                  onClick={() => void togglePin(selected)}
                  className="min-h-11 rounded-xl border border-border px-3 text-sm text-amber"
                >
                  {selected.pinned ? "Unpin" : "Pin"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6">
            {selected ? (
              selected.content_format === "html" ? (
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: selected.content }}
                />
              ) : (
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content) }}
                />
              )
            ) : selectedLibrary ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedLibrary.content) }}
              />
            ) : (
              <LoadingState label="Loading document" />
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Repository docs library" />
              <SectionDescription id="tools-docs-library">Package-backed search over the repository `docs/` directory.</SectionDescription>
            </div>
            {libraryLoading && !libraryData ? <LoadingState label="Indexing repository docs" /> : null}
            {libraryData?.items.length ? (
              libraryData.items.map((doc) => (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openLibraryDoc(doc.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openLibraryDoc(doc.id);
                    }
                  }}
                  className="w-full text-left"
                >
                  <Card className="space-y-3 transition hover:border-cyan/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="cyan">{doc.category}</Badge>
                          <Badge tone="slate">{doc.filePath}</Badge>
                          <Badge tone="amber">v{doc.version}</Badge>
                        </div>
                        <h2 className="mt-3 text-lg font-semibold text-text">{doc.title}</h2>
                        <p className="mt-1 text-xs text-text-dim">
                          {formatShortDate(doc.updatedAt)} · {doc.wordCount ?? 0} words
                          {typeof doc.score === "number" ? ` · score ${doc.score}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-text-dim">{doc.snippet ?? doc.content.slice(0, 200)}</p>
                  </Card>
                </div>
              ))
            ) : (
              <EmptyState label="No repository docs matched this filter." />
            )}
          </div>

          <div className="pt-2">
            <SectionTitle title="Workspace docs records" />
          </div>
          {data?.items.length ? (
            data.items.map((doc) => (
              <div
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => void openDoc(doc.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openDoc(doc.id);
                  }
                }}
                className="w-full text-left"
              >
                <Card className="space-y-3 transition hover:border-cyan/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="purple">{doc.category}</Badge>
                        {doc.pinned ? <Badge tone="amber">Pinned</Badge> : null}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-text">{doc.title}</h2>
                      <p className="mt-1 text-xs text-text-dim">
                        {formatShortDate(doc.updated_at)} · {doc.word_count ?? 0} words
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void togglePin(doc);
                      }}
                      className="min-h-11 rounded-xl border border-border px-3 text-sm text-amber"
                    >
                      {doc.pinned ? "Unpin" : "Pin"}
                    </button>
                  </div>
                  <p className="text-sm leading-6 text-text-dim">{doc.preview}</p>
                </Card>
              </div>
            ))
          ) : (
            <EmptyState label="No documents found for this search." />
          )}
        </div>
      )}

      {error ? <ErrorState error={error} /> : null}
      {libraryError ? <ErrorState error={libraryError} /> : null}
    </div>
  );
}

function countDomainTools(pack: DomainPack) {
  return pack.skills.reduce((total, skill) => total + skill.tools.length, 0);
}

function buildUpdatedQueryString(
  searchParams: { toString(): string },
  updates: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  return params.toString();
}

function FilterResetButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-border/60 bg-bg-deep/50 text-text-dim/60"
          : "border-border bg-bg-deep/80 text-text-dim hover:border-cyan/30 hover:text-text"
      }`}
    >
      Reset filters
    </button>
  );
}

export function DomainsToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packParam = searchParams.get("pack");
  const searchParam = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const [selectedPackId, setSelectedPackId] = useState<string>(packParam ?? allDomainPacks[0]?.id ?? "general");
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();
  const indexedPacks = useMemo(
    () =>
      allDomainPacks.map((pack) => ({
        pack,
        searchText: [
          pack.name,
          pack.description,
          pack.id,
          pack.agentPersona,
          pack.recommendedIntegrations.join(" "),
          pack.skills.map((skill) => `${skill.name} ${skill.description} ${skill.category}`).join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    []
  );

  useEffect(() => {
    if (packParam && packParam !== selectedPackId) setSelectedPackId(packParam);
    if (searchParam !== search) setSearch(searchParam);
  }, [packParam, searchParam]);

  const filteredPacks = useMemo(() => {
    if (!deferredSearch) return allDomainPacks;

    return indexedPacks.filter(({ searchText }) => searchText.includes(deferredSearch)).map(({ pack }) => pack);
  }, [deferredSearch, indexedPacks]);

  const selectedPack = filteredPacks.find((pack) => pack.id === selectedPackId) ?? filteredPacks[0] ?? null;

  useEffect(() => {
    if (!selectedPack) return;
    if (selectedPack.id !== selectedPackId) setSelectedPackId(selectedPack.id);
  }, [selectedPack, selectedPackId]);

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      pack: selectedPackId === (allDomainPacks[0]?.id ?? "general") && !packParam ? null : selectedPackId,
      search: deferredSearchText || null,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/domains?${nextQuery}` : "/tools/domains", { scroll: false });
  }, [deferredSearchText, packParam, router, searchParams, selectedPackId]);

  const isDomainResetDisabled = !search && selectedPackId === (allDomainPacks[0]?.id ?? "general");

  const resetDomainFilters = () => {
    setSearch("");
    setSelectedPackId(allDomainPacks[0]?.id ?? "general");
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Domain Packs"
        subtitle="Additive industry modules from the local packages folder. They extend HiTechClaw workflows without replacing existing tools."
        action={<Badge tone="purple">{allDomainPacks.length} packs</Badge>}
      />

      <SectionDescription id="domain-packs">
        Browse reusable domain presets for developer, finance, healthcare, sales, DevOps, research, and more. Each pack includes a persona, built-in skills, and recommended integrations that can guide future agent templates.
      </SectionDescription>

      <PackageWorkspaceNav current="domains" note="Jump from domain presets into the related package catalogs and client tools." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Domain packs" value={allDomainPacks.length.toString()} accent="text-purple" sublabel="Local additive presets ready for HiTechClaw" />
        <StatCard label="Skills" value={allDomainPacks.reduce((sum, pack) => sum + pack.skills.length, 0).toString()} accent="text-cyan" sublabel="Reusable capability bundles across all packs" />
        <StatCard label="Tools" value={allDomainPacks.reduce((sum, pack) => sum + countDomainTools(pack), 0).toString()} accent="text-amber" sublabel="Embedded helper tools inside package presets" />
        <StatCard label="Integrations" value={Array.from(new Set(allDomainPacks.flatMap((pack) => pack.recommendedIntegrations))).length.toString()} accent="text-green" sublabel="Unique recommended connectors referenced by the packs" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Pack catalog" note="Sourced from @hitechclaw/domains" />
          <FilterResetButton onClick={resetDomainFilters} disabled={isDomainResetDisabled} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search domains, personas, skills, or integrations"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filteredPacks.map((pack) => (
            <Pill key={pack.id} active={selectedPack?.id === pack.id} onClick={() => setSelectedPackId(pack.id)}>
              {pack.icon} {pack.name}
            </Pill>
          ))}
        </div>
        {!filteredPacks.length ? <EmptyState label="No domain packs matched this search." /> : null}
      </Card>

      {selectedPack ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="purple">{selectedPack.id}</Badge>
                  <Badge tone="cyan">{selectedPack.skills.length} skills</Badge>
                  <Badge tone="amber">{countDomainTools(selectedPack)} tools</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-text">{selectedPack.icon} {selectedPack.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-dim">{selectedPack.description}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                  <SectionTitle title="Agent persona" note="Package-defined guidance" />
                  <p className="whitespace-pre-wrap text-sm leading-6 text-text-dim">{selectedPack.agentPersona}</p>
                </Card>

                <div className="space-y-3">
                  <SectionTitle title="Included skills" note={`${selectedPack.skills.length} presets`} />
                  {selectedPack.skills.map((skill) => (
                    <Card key={skill.id} className="space-y-3 border-border/70 bg-bg-deep/40">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone="cyan">{skill.category}</Badge>
                            <Badge tone="slate">v{skill.version}</Badge>
                            <Badge tone="amber">{skill.tools.length} tools</Badge>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-text">{skill.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-text-dim">{skill.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {skill.tools.map((tool) => (
                          <Badge key={`${skill.id}-${tool.name}`} tone="purple">{tool.name}</Badge>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <PackageActionBar
                  title="Package actions"
                  note="Open related package screens for this domain pack."
                  items={[
                    { href: `/tools/skills?domain=${encodeURIComponent(selectedPack.id)}`, label: "Open skills", tone: "cyan" },
                    ...selectedPack.recommendedIntegrations.map((integrationId) => ({
                      href: `/tools/integrations?integration=${encodeURIComponent(integrationId)}`,
                      label: `Integration: ${integrationId}`,
                      tone: "green" as const,
                    })),
                    ...(selectedPack.id === "ml"
                      ? [{ href: "/tools/ml?taskType=classification", label: "Open ML catalog", tone: "amber" as const }]
                      : []),
                    { href: "/client/chat", label: "Open AI chat", tone: "green" },
                    { href: "/tools/mcp", label: "Open MCP", tone: "slate" },
                  ]}
                />

                <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                  <SectionTitle title="Recommended integrations" note="Safe additive guidance only" />
                  {selectedPack.recommendedIntegrations.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPack.recommendedIntegrations.map((integrationId) => (
                        <Link key={integrationId} href={`/tools/integrations?integration=${encodeURIComponent(integrationId)}`}>
                          <Badge tone="green">{integrationId}</Badge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <EmptyState label="No recommended integrations declared for this pack." />
                  )}
                </Card>

                <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                  <SectionTitle title="Cross-links" note="Jump into related catalogs" />
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/tools/skills?domain=${encodeURIComponent(selectedPack.id)}`}>
                      <Badge tone="cyan">Open skills</Badge>
                    </Link>
                    {selectedPack.id === "ml" ? (
                      <Link href="/tools/ml?taskType=classification">
                        <Badge tone="amber">Open ML catalog</Badge>
                      </Link>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-text-dim">
                    Use domain-level deep-links to inspect related skills and recommended integrations without leaving the existing tools workflow.
                  </p>
                </Card>

                <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                  <SectionTitle title="How to use" note="Non-destructive rollout" />
                  <ul className="space-y-2 text-sm leading-6 text-text-dim">
                    <li>• Use a pack as a template source for future agent presets, not as a replacement for existing Hitechclaw flows.</li>
                    <li>• Pair recommended integrations with the existing client chat and tools hub instead of removing current capabilities.</li>
                    <li>• Reuse persona text and skills when creating new workflow defaults, onboarding presets, or admin templates.</li>
                  </ul>
                </Card>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState label="No domain pack selected." />
      )}
    </div>
  );
}

function getIntegrationAuthLabel(integration: IntegrationDefinition) {
  if (integration.auth.type === "oauth2") return "OAuth2";
  if (integration.auth.type === "api-key") return "API Key";
  if (integration.auth.type === "bearer") return "Bearer Token";
  if (integration.auth.type === "basic") return "Basic Auth";
  return "No Auth";
}

function getIntegrationRiskTone(integration: IntegrationDefinition) {
  const risks = integration.actions.map((action) => action.riskLevel ?? "safe");
  if (risks.includes("dangerous")) return "red" as const;
  if (risks.includes("moderate")) return "amber" as const;
  return "green" as const;
}

function getIntegrationSummary(integration: IntegrationDefinition) {
  const approvals = integration.actions.filter((action) => action.requiresApproval).length;
  const triggers = integration.triggers?.length ?? 0;
  return `${integration.actions.length} actions · ${triggers} triggers · ${approvals} approval-gated`;
}

export function IntegrationsToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const categoryParam = searchParams.get("category") ?? "all";
  const integrationParam = searchParams.get("integration");
  const [search, setSearch] = useState(searchParam);
  const [category, setCategory] = useState<string>(categoryParam);
  const [selectedId, setSelectedId] = useState<string>(integrationParam ?? allIntegrations[0]?.id ?? "github");
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();
  const indexedIntegrations = useMemo(
    () =>
      allIntegrations.map((integration) => ({
        integration,
        searchText: [
          integration.name,
          integration.id,
          integration.description,
          integration.category,
          getIntegrationAuthLabel(integration),
          integration.actions.map((action) => `${action.name} ${action.description}`).join(" "),
          integration.triggers?.map((trigger) => `${trigger.name} ${trigger.description}`).join(" ") ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      })),
    []
  );

  useEffect(() => {
    if (searchParam !== search) setSearch(searchParam);
    if (categoryParam !== category) setCategory(categoryParam);
    if (integrationParam && integrationParam !== selectedId) setSelectedId(integrationParam);
  }, [categoryParam, integrationParam, searchParam]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(allIntegrations.map((integration) => integration.category))).sort()],
    []
  );

  const filteredIntegrations = useMemo(() => {
    return indexedIntegrations.filter(({ integration, searchText }) => {
      if (category !== "all" && integration.category !== category) return false;
      if (!deferredSearch) return true;
      return searchText.includes(deferredSearch);
    }).map(({ integration }) => integration);
  }, [category, deferredSearch, indexedIntegrations]);

  const selected = filteredIntegrations.find((integration) => integration.id === selectedId) ?? filteredIntegrations[0] ?? null;
  const relatedPacks = selected
    ? allDomainPacks.filter((pack) => pack.recommendedIntegrations.includes(selected.id))
    : [];

  useEffect(() => {
    if (!selected) return;
    if (selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      search: deferredSearchText || null,
      category: category === "all" ? null : category,
      integration: selectedId === (allIntegrations[0]?.id ?? "github") && !integrationParam ? null : selectedId,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/integrations?${nextQuery}` : "/tools/integrations", { scroll: false });
  }, [category, deferredSearchText, integrationParam, router, searchParams, selectedId]);

  const isIntegrationResetDisabled = !search && category === "all" && selectedId === (allIntegrations[0]?.id ?? "github");

  const resetIntegrationFilters = () => {
    setSearch("");
    setCategory("all");
    setSelectedId(allIntegrations[0]?.id ?? "github");
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Integrations Catalog"
        subtitle="Read-only connector inventory from the local packages folder. This extends HiTechClaw without replacing existing MCP or workflow features."
        action={<Badge tone="green">{allIntegrations.length} connectors</Badge>}
      />

      <SectionDescription id="integrations-catalog">
        Review built-in connectors for email, messaging, GitHub, search, calendars, and AI services. This screen is additive and read-only: it documents auth patterns, available actions, triggers, and approval risk before deeper integration.
      </SectionDescription>

      <PackageWorkspaceNav current="integrations" note="Use the shared package workspace to move between connectors, skills, ML, docs, and MCP." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Connectors" value={allIntegrations.length.toString()} accent="text-green" sublabel="Package-backed integration definitions" />
        <StatCard label="Actions" value={allIntegrations.reduce((sum, integration) => sum + integration.actions.length, 0).toString()} accent="text-cyan" sublabel="Executable operations exposed by the catalog" />
        <StatCard label="Triggers" value={allIntegrations.reduce((sum, integration) => sum + (integration.triggers?.length ?? 0), 0).toString()} accent="text-amber" sublabel="Event hooks available for future automations" />
        <StatCard label="Approvals" value={allIntegrations.reduce((sum, integration) => sum + integration.actions.filter((action) => action.requiresApproval).length, 0).toString()} accent="text-purple" sublabel="Actions that should stay behind approval flows" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Connector catalog" note="Sourced from @hitechclaw/integrations" />
          <FilterResetButton onClick={resetIntegrationFilters} disabled={isIntegrationResetDisabled} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search connectors, actions, triggers, or auth modes"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((entry) => (
            <Pill key={entry} active={category === entry} onClick={() => setCategory(entry)}>
              {entry === "all" ? "All" : entry}
            </Pill>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <button
              key={integration.id}
              type="button"
              onClick={() => setSelectedId(integration.id)}
              className={`rounded-[22px] border p-4 text-left transition ${selected?.id === integration.id ? "border-cyan/40 bg-cyan/5" : "border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] hover:border-cyan/30"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="green">{integration.category}</Badge>
                    <Badge tone={getIntegrationRiskTone(integration)}>{getIntegrationAuthLabel(integration)}</Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-text">{integration.icon} {integration.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-dim">{integration.description}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-dim">{getIntegrationSummary(integration)}</p>
            </button>
          ))}
        </div>
        {!filteredIntegrations.length ? <EmptyState label="No integrations matched this filter." /> : null}
      </Card>

      {selected ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">{selected.category}</Badge>
                <Badge tone="cyan">{getIntegrationAuthLabel(selected)}</Badge>
                <Badge tone={getIntegrationRiskTone(selected)}>{selected.actions.length} actions</Badge>
                <Badge tone="purple">{selected.triggers?.length ?? 0} triggers</Badge>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-text">{selected.icon} {selected.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-dim">{selected.description}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Available actions" note={`${selected.actions.length} operations`} />
                <div className="space-y-3">
                  {selected.actions.map((action) => (
                    <div key={`${selected.id}-${action.name}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="cyan">{action.name}</Badge>
                        <Badge tone={action.riskLevel === "dangerous" ? "red" : action.riskLevel === "moderate" ? "amber" : "green"}>
                          {action.riskLevel ?? "safe"}
                        </Badge>
                        {action.requiresApproval ? <Badge tone="purple">approval required</Badge> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text-dim">{action.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Event triggers" note="Future automation hooks" />
                {selected.triggers?.length ? (
                  <div className="space-y-3">
                    {selected.triggers.map((trigger) => (
                      <div key={`${selected.id}-${trigger.name}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="green">{trigger.name}</Badge>
                          {trigger.pollInterval ? <Badge tone="slate">poll {Math.round(trigger.pollInterval / 1000)}s</Badge> : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-text-dim">{trigger.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No triggers declared for this integration." />
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <PackageActionBar
                title="Package actions"
                note="Jump directly from this connector into related package screens."
                items={[
                  { href: `/tools/skills?integration=${encodeURIComponent(selected.id)}`, label: "Find matching skills", tone: "cyan" },
                  ...relatedPacks.map((pack) => ({
                    href: `/tools/domains?pack=${encodeURIComponent(pack.id)}`,
                    label: `${pack.icon} ${pack.name}`,
                    tone: "purple" as const,
                  })),
                  { href: "/tools/docs", label: "Open docs", tone: "cyan" },
                  { href: "/client/chat", label: "Open AI chat", tone: "green" },
                  { href: "/tools/mcp", label: "Open MCP", tone: "slate" },
                ]}
              />

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Authentication" note="Connector onboarding guidance" />
                <div className="flex flex-wrap gap-2">
                  <Badge tone="cyan">{getIntegrationAuthLabel(selected)}</Badge>
                  {selected.auth.type === "oauth2" ? <Badge tone="green">refreshable {selected.auth.config.refreshable ? "yes" : "no"}</Badge> : null}
                </div>
                {selected.auth.type === "oauth2" ? (
                  <ul className="space-y-2 text-sm leading-6 text-text-dim">
                    <li>• Client ID env: `{selected.auth.config.clientIdEnv}`</li>
                    <li>• Client secret env: `{selected.auth.config.clientSecretEnv}`</li>
                    <li>• Scopes: {selected.auth.config.scopes.join(", ")}</li>
                  </ul>
                ) : selected.auth.type === "none" ? (
                  <p className="text-sm leading-6 text-text-dim">No credentials required.</p>
                ) : (
                  <ul className="space-y-2 text-sm leading-6 text-text-dim">
                    {selected.auth.fields.map((field) => (
                      <li key={`${selected.id}-${field.key}`}>
                        • {field.label} ({field.type}){field.envVar ? ` — env ${field.envVar}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Rollout recommendation" note="Keep existing Hitechclaw features intact" />
                <ul className="space-y-2 text-sm leading-6 text-text-dim">
                  <li>• Start with catalog visibility only. Do not replace existing MCP, notification, or workflow screens.</li>
                  <li>• Introduce connector setup later behind explicit settings and approvals.</li>
                  <li>• Reuse low-risk actions first, then wire moderate or approval-gated actions into existing approval queues.</li>
                </ul>
              </Card>

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Related domains and skills" note="Cross-linked discovery" />
                <div className="flex flex-wrap gap-2">
                  <Link href={`/tools/skills?integration=${encodeURIComponent(selected.id)}`}>
                    <Badge tone="cyan">Find matching skills</Badge>
                  </Link>
                  {relatedPacks.map((pack) => (
                    <Link key={pack.id} href={`/tools/domains?pack=${encodeURIComponent(pack.id)}`}>
                      <Badge tone="purple">{pack.icon} {pack.name}</Badge>
                    </Link>
                  ))}
                </div>
                {!relatedPacks.length ? <p className="text-sm leading-6 text-text-dim">No domain packs currently reference this integration.</p> : null}
              </Card>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState label="No integration selected." />
      )}
    </div>
  );
}

function countSkillParameters(entry: SkillRegistryEntry) {
  return entry.tools.reduce((total: number, tool: SkillHubTool) => total + (tool.parameters?.length ?? 0), 0);
}

export function SkillsToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const domainParam = searchParams.get("domain") ?? "all";
  const integrationParam = searchParams.get("integration") ?? "all";
  const [search, setSearch] = useState(searchParam);
  const [domainFilter, setDomainFilter] = useState<string>(domainParam);
  const [integrationFilter, setIntegrationFilter] = useState<string>(integrationParam);
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();

  const skillEntries = useMemo(() => buildSkillRegistryEntries(), []);
  const indexedSkillEntries = useMemo(
    () =>
      skillEntries.map((entry) => ({
        entry,
        searchText: [
          entry.id,
          entry.name,
          entry.description,
          entry.domainId,
          entry.tags?.join(" ") ?? "",
          entry.tools.map((tool) => `${tool.name} ${tool.description}`).join(" "),
          describeSkill(entry),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [skillEntries]
  );
  const domains = useMemo(
    () => ["all", ...Array.from(new Set(skillEntries.map((entry) => entry.domainId))).sort()],
    [skillEntries]
  );
  const integrations = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(
          skillEntries.flatMap((entry) => (entry.tags ?? []).filter((tag) => integrationIds.has(tag)))
        )
      ).sort(),
    ],
    [skillEntries]
  );

  useEffect(() => {
    if (searchParam !== search) setSearch(searchParam);
    if (domainParam !== domainFilter) setDomainFilter(domainParam);
    if (integrationParam !== integrationFilter) setIntegrationFilter(integrationParam);
  }, [domainParam, integrationParam, searchParam]);

  const filteredEntries = useMemo(() => {
    return indexedSkillEntries.filter(({ entry, searchText }) => {
      if (domainFilter !== "all" && entry.domainId !== domainFilter) return false;
      if (integrationFilter !== "all" && !(entry.tags ?? []).includes(integrationFilter)) return false;
      if (!deferredSearch) return true;
      return searchText.includes(deferredSearch);
    }).map(({ entry }) => entry);
  }, [deferredSearch, domainFilter, indexedSkillEntries, integrationFilter]);

  const sandboxed = useMemo(
    () => skillEntries.filter((entry) => entry.sandboxRequired || entry.trustLevel === "community" || entry.trustLevel === "untrusted"),
    [skillEntries]
  );

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      search: deferredSearchText || null,
      domain: domainFilter === "all" ? null : domainFilter,
      integration: integrationFilter === "all" ? null : integrationFilter,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/skills?${nextQuery}` : "/tools/skills", { scroll: false });
  }, [deferredSearchText, domainFilter, integrationFilter, router, searchParams]);

  const isSkillsResetDisabled = !search && domainFilter === "all" && integrationFilter === "all";

  const resetSkillFilters = () => {
    setSearch("");
    setDomainFilter("all");
    setIntegrationFilter("all");
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Skill Registry"
        subtitle="Read-only skill marketplace view powered by the local skill hub SDK and domain-pack metadata."
        action={<Badge tone="cyan">{skillEntries.length} skills</Badge>}
      />

      <SectionDescription id="skill-registry">
        Browse built-in skill entries derived from local domain packs. This gives HiTechClaw a safe marketplace-style registry view without replacing current tools, workflows, or agent setup flows.
      </SectionDescription>

      <PackageWorkspaceNav current="skills" note="Navigate packaged skills together with domains, integrations, ML, docs, MCP, and chat." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registry entries" value={skillEntries.length.toString()} accent="text-cyan" sublabel="Generated through @hitechclaw/skill-hub" />
        <StatCard label="Domains" value={Array.from(new Set(skillEntries.map((entry) => entry.domainId))).length.toString()} accent="text-purple" sublabel="Industry packs contributing reusable skills" />
        <StatCard label="Tools" value={skillEntries.reduce((sum, entry) => sum + entry.tools.length, 0).toString()} accent="text-green" sublabel="Actionable tools declared inside skill definitions" />
        <StatCard label="Sandboxed" value={sandboxed.length.toString()} accent="text-amber" sublabel="Entries that would require stricter execution controls" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Marketplace catalog" note="Sourced from @hitechclaw/skill-hub" />
          <FilterResetButton onClick={resetSkillFilters} disabled={isSkillsResetDisabled} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search skills, tools, descriptions, or tags"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {domains.map((entry) => (
            <Pill key={entry} active={domainFilter === entry} onClick={() => setDomainFilter(entry)}>
              {entry === "all" ? "All domains" : entry}
            </Pill>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {integrations.map((entry) => (
            <Pill key={entry} active={integrationFilter === entry} onClick={() => setIntegrationFilter(entry)}>
              {entry === "all" ? "All integrations" : entry}
            </Pill>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="space-y-3 border-border/70 bg-bg-deep/40">
              <div className="flex flex-wrap gap-2">
                <Badge tone="purple">{entry.domainId}</Badge>
                <Badge tone="cyan">{entry.trustLevel ?? "unknown"}</Badge>
                <Badge tone="green">{entry.tools.length} tools</Badge>
                <Badge tone="amber">{countSkillParameters(entry)} params</Badge>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">{entry.icon} {entry.name}</h2>
                <p className="mt-2 text-sm leading-6 text-text-dim">{entry.description}</p>
              </div>
              <p className="text-xs text-text-dim">{describeSkill(entry)}</p>
              <div className="flex flex-wrap gap-2">
                {(entry.tags ?? []).slice(0, 6).map((tag) => (
                  integrationIds.has(tag) ? (
                    <Link key={`${entry.id}-${tag}`} href={`/tools/integrations?integration=${encodeURIComponent(tag)}`}>
                      <Badge tone="green">{tag}</Badge>
                    </Link>
                  ) : (
                    <Badge key={`${entry.id}-${tag}`} tone="slate">{tag}</Badge>
                  )
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/tools/domains?pack=${encodeURIComponent(entry.domainId)}`}>
                  <Badge tone="purple">Open domain</Badge>
                </Link>
                {entry.domainId === "ml" ? (
                  <Link href="/tools/ml?taskType=classification">
                    <Badge tone="amber">Open ML catalog</Badge>
                  </Link>
                ) : null}
              </div>
              <PackageActionBar
                title="Quick actions"
                note="Cross-link this skill with related package screens."
                items={[
                  { href: `/tools/domains?pack=${encodeURIComponent(entry.domainId)}`, label: "Open domain", tone: "purple" },
                  ...((entry.tags ?? [])
                    .filter((tag) => integrationIds.has(tag))
                    .slice(0, 3)
                    .map((tag) => ({
                      href: `/tools/integrations?integration=${encodeURIComponent(tag)}`,
                      label: `Integration: ${tag}`,
                      tone: "green" as const,
                    }))),
                  ...(entry.domainId === "ml"
                    ? [{ href: "/tools/ml?taskType=classification", label: "Open ML catalog", tone: "amber" as const }]
                    : []),
                  { href: "/client/chat", label: "Open AI chat", tone: "green" },
                ]}
              />
              <div className="space-y-2">
                {entry.tools.map((tool) => (
                  <div key={`${entry.id}-${tool.name}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="cyan">{tool.name}</Badge>
                      <Badge tone="green">{tool.parameters?.length ?? 0} params</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-dim">{tool.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        {!filteredEntries.length ? <EmptyState label="No skill entries matched this filter." /> : null}
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Rollout recommendation" note="Preserve existing Hitechclaw flows" />
        <ul className="space-y-2 text-sm leading-6 text-text-dim">
          <li>• Use this registry as a browse-only marketplace surface first.</li>
          <li>• Keep skill installation and execution behind current agent, MCP, and approval flows.</li>
          <li>• Promote high-value builtin skills into future onboarding templates instead of replacing existing dashboards.</li>
        </ul>
      </Card>
    </div>
  );
}

function summarizeBuiltinSkillTools(skill: BuiltinSkillDefinition) {
  return skill.tools.reduce((total: number, tool: BuiltinSkillTool) => total + (tool.definition.parameters?.length ?? 0), 0);
}

function getBuiltinSkillTone(category: string) {
  if (category === "healthcare") return "purple" as const;
  if (category === "productivity") return "green" as const;
  return "cyan" as const;
}

export function BuiltinSkillsToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const categoryParam = searchParams.get("category") ?? "all";
  const [search, setSearch] = useState(searchParam);
  const [categoryFilter, setCategoryFilter] = useState(categoryParam);
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(builtinSkillDefinitions.map((skill) => skill.manifest.category))).sort()],
    []
  );

  const indexedBuiltinSkills = useMemo(
    () =>
      builtinSkillDefinitions.map((skill) => ({
        skill,
        searchText: [
          skill.manifest.id,
          skill.manifest.name,
          skill.manifest.description,
          skill.manifest.category,
          skill.manifest.tags.join(" "),
          skill.manifest.config.map((entry: BuiltinSkillConfigEntry) => `${entry.key} ${entry.label} ${entry.description ?? ""}`).join(" "),
          skill.tools.map((tool: BuiltinSkillTool) => `${tool.definition.name} ${tool.definition.description}`).join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    []
  );

  useEffect(() => {
    if (searchParam !== search) setSearch(searchParam);
    if (categoryParam !== categoryFilter) setCategoryFilter(categoryParam);
  }, [categoryFilter, categoryParam, search, searchParam]);

  const filteredBuiltinSkills = useMemo(() => {
    return indexedBuiltinSkills
      .filter(({ skill, searchText }) => {
        if (categoryFilter !== "all" && skill.manifest.category !== categoryFilter) return false;
        if (!deferredSearch) return true;
        return searchText.includes(deferredSearch);
      })
      .map(({ skill }) => skill);
  }, [categoryFilter, deferredSearch, indexedBuiltinSkills]);

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      search: deferredSearchText || null,
      category: categoryFilter === "all" ? null : categoryFilter,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/builtin-skills?${nextQuery}` : "/tools/builtin-skills", { scroll: false });
  }, [categoryFilter, deferredSearchText, router, searchParams]);

  const isBuiltinResetDisabled = !search && categoryFilter === "all";

  const resetBuiltinFilters = () => {
    setSearch("");
    setCategoryFilter("all");
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Built-in Skills"
        subtitle="Package-native runtime skills from @hitechclaw/skills, surfaced without replacing current agent, MCP, or approval flows."
        action={<Badge tone="cyan">{builtinSkills.length} packaged skills</Badge>}
      />

      <SectionDescription id="builtin-skills">
        Review the packaged runtime skills that sit behind HiTechClaw capabilities. This screen exposes manifests, handler tools, configuration keys, and workflow-fit guidance before any live rollout.
      </SectionDescription>

      <PackageWorkspaceNav current="builtin-skills" note="Open packaged runtime skills together with domains, registry, sandbox, workflows, docs, and chat." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Packaged skills" value={builtinSkills.length.toString()} accent="text-cyan" sublabel="Directly sourced from @hitechclaw/skills" />
        <StatCard label="Runtime tools" value={builtinSkillDefinitions.reduce((sum, skill) => sum + skill.tools.length, 0).toString()} accent="text-green" sublabel="Handlers attached to skill execution" />
        <StatCard label="Config entries" value={builtinSkillDefinitions.reduce((sum, skill) => sum + skill.manifest.config.length, 0).toString()} accent="text-amber" sublabel="Environment and runtime settings declared by the package" />
        <StatCard label="Workflow ready" value={builtinSkillDefinitions.length.toString()} accent="text-purple" sublabel="Candidates for project-level workflow starters" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Packaged runtime catalog" note="Sourced from @hitechclaw/skills" />
          <FilterResetButton onClick={resetBuiltinFilters} disabled={isBuiltinResetDisabled} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search packaged skills, tool handlers, config keys, or tags"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((entry) => (
            <Pill key={entry} active={categoryFilter === entry} onClick={() => setCategoryFilter(entry)}>
              {entry === "all" ? "All categories" : entry}
            </Pill>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredBuiltinSkills.map((skill) => (
            <Card key={skill.manifest.id} className="space-y-4 border-border/70 bg-bg-deep/40">
              <div className="flex flex-wrap gap-2">
                <Badge tone={getBuiltinSkillTone(skill.manifest.category)}>{skill.manifest.category}</Badge>
                <Badge tone="cyan">{skill.manifest.version}</Badge>
                <Badge tone="green">{skill.tools.length} tools</Badge>
                <Badge tone="amber">{summarizeBuiltinSkillTools(skill)} params</Badge>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-text">{skill.manifest.name}</h2>
                <p className="mt-2 text-sm leading-6 text-text-dim">{skill.manifest.description}</p>
              </div>

              <PackageActionBar
                title="Package actions"
                note="Use safe deep-links before enabling runtime execution."
                items={[
                  ...(builtinSkillDeepLinks[skill.manifest.id] ?? []),
                  { href: "/client/chat", label: "Open AI chat", tone: "green" },
                  { href: "/tools/docs", label: "Open docs", tone: "cyan" },
                ]}
              />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)]">
                <div className="space-y-3">
                  <SectionTitle title="Tool handlers" note="Declared by the package runtime" />
                  {skill.tools.map((tool: BuiltinSkillTool) => (
                    <div key={`${skill.manifest.id}-${tool.definition.name}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="cyan">{tool.definition.name}</Badge>
                        <Badge tone="green">{tool.definition.category}</Badge>
                        <Badge tone="amber">{tool.definition.parameters?.length ?? 0} params</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text-dim">{tool.definition.description}</p>
                      {tool.definition.parameters?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tool.definition.parameters.map((parameter: BuiltinSkillParameter) => (
                            <Badge key={`${tool.definition.name}-${parameter.name}`} tone="slate">
                              {parameter.name}{parameter.required ? " *" : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <Card className="space-y-3 border-border/70 bg-bg-card/50">
                    <SectionTitle title="Config keys" note="Runtime expectations" />
                    <div className="space-y-2">
                      {skill.manifest.config.map((entry: BuiltinSkillConfigEntry) => (
                        <div key={`${skill.manifest.id}-${entry.key}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone="purple">{entry.key}</Badge>
                            <Badge tone="green">{entry.type}</Badge>
                            {entry.required ? <Badge tone="red">required</Badge> : <Badge tone="slate">optional</Badge>}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-text-dim">{entry.description ?? entry.label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="space-y-3 border-border/70 bg-bg-card/50">
                    <SectionTitle title="Workflow fit" note="Project workflow starter guidance" />
                    <ul className="space-y-2 text-sm leading-6 text-text-dim">
                      <li>• Start from `Workflows` for repeatable execution instead of wiring handlers directly into the UI.</li>
                      <li>• Keep risky or external calls behind approvals, sandbox review, and existing operational guardrails.</li>
                      <li>• Reuse `Docs`, `Registry`, and `AI Chat` to document and validate rollout assumptions before activation.</li>
                    </ul>
                  </Card>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {skill.manifest.tags.map((tag: string) => (
                  <Badge key={`${skill.manifest.id}-${tag}`} tone="slate">{tag}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
        {!filteredBuiltinSkills.length ? <EmptyState label="No built-in skills matched this filter." /> : null}
      </Card>
    </div>
  );
}

function countNetworkAllowRules(policy: AppSandboxPolicy) {
  return policy.network.rules.filter((rule: AppSandboxNetworkRule) => rule.allow).length;
}

function getPolicyTone(policyName: string) {
  if (["strict", "default"].includes(policyName)) return "slate" as const;
  if (["ml", "inference"].includes(policyName)) return "amber" as const;
  if (["github", "gmail", "slack", "notion"].includes(policyName)) return "green" as const;
  return "cyan" as const;
}

export function SandboxToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();

  const builtinPolicies = useMemo(
    () => Object.entries(BUILTIN_POLICIES).sort(([left], [right]) => left.localeCompare(right)) as SandboxPolicyRecord[],
    []
  );

  const filteredPolicies = useMemo(() => {
    if (!deferredSearch) return builtinPolicies;
    return builtinPolicies.filter(([name, policy]) => {
      const haystack = [
        name,
        policy.name,
        policy.version,
        policy.filesystem.rules.map((rule) => `${rule.path} ${rule.access}`).join(" "),
        policy.network.rules.map((rule) => `${rule.host} ${(rule.methods ?? []).join(" ")}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [builtinPolicies, deferredSearch]);

  useEffect(() => {
    if (searchParam !== search) setSearch(searchParam);
  }, [search, searchParam]);

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      search: deferredSearchText || null,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/sandbox?${nextQuery}` : "/tools/sandbox", { scroll: false });
  }, [deferredSearchText, router, searchParams]);

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Sandbox Lab"
        subtitle="Isolation policies, integration allow-lists, and GPU-ready image presets from @hitechclaw/sandbox."
        action={<Badge tone="slate">{builtinPolicies.length} policies</Badge>}
      />

      <SectionDescription id="sandbox-lab">
        Review packaged sandbox policies before wiring any risky tool, connector, or ML job into live execution. This keeps HiTechClaw additive, documented, and conflict-aware.
      </SectionDescription>

      <PackageWorkspaceNav current="sandbox" note="Move between sandbox review, built-in skills, ML catalog, integrations, docs, and project workflows." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Policies" value={builtinPolicies.length.toString()} accent="text-slate" sublabel="Built-in isolation templates" />
        <StatCard label="Integration maps" value={Object.keys(INTEGRATION_POLICIES).length.toString()} accent="text-green" sublabel="Connector-specific policy mappings" />
        <StatCard label="GPU images" value={GPU_SANDBOX_IMAGES.length.toString()} accent="text-amber" sublabel="ML and inference-ready sandbox images" />
        <StatCard label="Allowed hosts" value={builtinPolicies.reduce((sum, [, policy]) => sum + countNetworkAllowRules(policy), 0).toString()} accent="text-cyan" sublabel="Explicit network allow rules across packaged policies" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Policy review" note="Sourced from @hitechclaw/sandbox" />
          <FilterResetButton onClick={() => setSearch("")} disabled={!search} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search policies, hosts, filesystem rules, or image names"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            {filteredPolicies.map(([name, policy]) => (
              <Card key={name} className="space-y-3 border-border/70 bg-bg-deep/40">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={getPolicyTone(name)}>{name}</Badge>
                  <Badge tone="green">fs {policy.filesystem.defaultAccess}</Badge>
                  <Badge tone="amber">net {policy.network.defaultAction}</Badge>
                  <Badge tone="slate">proc {policy.process.maxProcesses ?? 0}</Badge>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <SectionTitle title="Filesystem rules" note={`${policy.filesystem.rules.length} declared paths`} />
                    <div className="flex flex-wrap gap-2">
                      {policy.filesystem.rules.map((rule) => (
                        <Badge key={`${name}-${rule.path}`} tone="purple">{rule.path} · {rule.access}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <SectionTitle title="Network rules" note={`${policy.network.rules.length} explicit hosts`} />
                    <div className="flex flex-wrap gap-2">
                      {policy.network.rules.length ? (
                        policy.network.rules.map((rule) => (
                          <Badge key={`${name}-${rule.host}`} tone={rule.allow ? "green" : "red"}>
                            {rule.host}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="slate">No explicit hosts</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {!filteredPolicies.length ? <EmptyState label="No sandbox policies matched this search." /> : null}
          </div>

          <div className="space-y-4">
            <PackageActionBar
              title="Package actions"
              note="Keep isolation review close to skills, ML, integrations, and workflows."
              items={[
                { href: "/tools/builtin-skills", label: "Open built-in skills", tone: "cyan" },
                { href: "/tools/skills?sandbox=review", label: "Open registry", tone: "cyan" },
                { href: "/tools/ml", label: "Open ML catalog", tone: "amber" },
                { href: "/tools/integrations", label: "Open integrations", tone: "green" },
                { href: "/workflows", label: "Open workflows", tone: "amber" },
              ]}
            />

            <Card className="space-y-3 border-border/70 bg-bg-deep/40">
              <SectionTitle title="Integration policy map" note="Package guardrails by connector" />
              <div className="space-y-2">
                {Object.entries(INTEGRATION_POLICIES)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([integrationId, policy]) => (
                    <div key={integrationId} className="rounded-2xl border border-border/80 bg-bg-card/60 p-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">{integrationId}</Badge>
                        <Badge tone={getPolicyTone(policy.name)}>{policy.name}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className="space-y-3 border-border/70 bg-bg-deep/40">
              <SectionTitle title="GPU-ready images" note="ML and inference presets" />
              <div className="space-y-3">
                {GPU_SANDBOX_IMAGES.map((image) => (
                  <div key={image.name} className="rounded-2xl border border-border/80 bg-bg-card/60 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="amber">{image.name}</Badge>
                      <Badge tone={image.gpuRequired ? "red" : "green"}>{image.gpuRequired ? "GPU required" : "CPU capable"}</Badge>
                      {image.cudaVersion ? <Badge tone="slate">CUDA {image.cudaVersion}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-dim">{image.description}</p>
                    <p className="mt-2 text-xs text-text-dim">Packages: {image.packages.join(", ")}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3 border-border/70 bg-bg-deep/40">
              <SectionTitle title="Project workflow guidance" note="Non-GitHub workflow rollout" />
              <ul className="space-y-2 text-sm leading-6 text-text-dim">
                <li>• Review sandbox policy first, then connect the matching integration or built-in skill.</li>
                <li>• Use `Workflows` to orchestrate approved tasks instead of exposing direct execution paths in the UI.</li>
                <li>• Keep ML and sensitive tools behind explicit package review, approvals, and documented allow-lists.</li>
              </ul>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getTaskTone(taskType: string) {
  if (["classification", "nlp-classification"].includes(taskType)) return "cyan" as const;
  if (["regression", "time-series"].includes(taskType)) return "green" as const;
  if (["clustering", "anomaly-detection"].includes(taskType)) return "amber" as const;
  return "purple" as const;
}

function getAlgorithmRiskNote(algorithm: MLAlgorithm) {
  if (algorithm.family === "ensemble") return "Higher compute, stronger baseline performance";
  if (algorithm.family === "neural-network") return "Best for advanced pipelines and larger datasets";
  if (algorithm.family === "clustering") return "Useful for unsupervised discovery and anomaly grouping";
  return "Good read-only catalog candidate for future ML workflows";
}

export function MLCatalogToolScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const taskParam = searchParams.get("taskType") ?? "all";
  const familyParam = searchParams.get("family") ?? "all";
  const algorithmParam = searchParams.get("algorithm");
  const [search, setSearch] = useState(searchParam);
  const [taskFilter, setTaskFilter] = useState<string>(taskParam);
  const [familyFilter, setFamilyFilter] = useState<string>(familyParam);
  const [selectedId, setSelectedId] = useState<string>(algorithmParam ?? algorithms[0]?.id ?? "linear-regression");
  const deferredSearchText = useDeferredValue(search.trim());
  const deferredSearch = deferredSearchText.toLowerCase();
  const indexedAlgorithms = useMemo(
    () =>
      algorithms.map((algorithm) => ({
        algorithm,
        searchText: [
          algorithm.id,
          algorithm.name,
          algorithm.family,
          algorithm.description,
          algorithm.supportedTasks.join(" "),
          algorithm.hyperparameters.map((parameter) => `${parameter.name} ${parameter.description}`).join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    []
  );

  const taskTypes = useMemo(
    () => ["all", ...Array.from(new Set(algorithms.flatMap((algorithm) => algorithm.supportedTasks))).sort()],
    []
  );
  const families = useMemo(
    () => ["all", ...Array.from(new Set(algorithms.map((algorithm) => algorithm.family))).sort()],
    []
  );

  useEffect(() => {
    if (searchParam !== search) setSearch(searchParam);
    if (taskParam !== taskFilter) setTaskFilter(taskParam);
    if (familyParam !== familyFilter) setFamilyFilter(familyParam);
    if (algorithmParam && algorithmParam !== selectedId) setSelectedId(algorithmParam);
  }, [algorithmParam, familyParam, searchParam, taskParam]);

  const filteredAlgorithms = useMemo(() => {
    const activeTaskFilter = taskFilter === "all" ? null : (taskFilter as MLAlgorithm["supportedTasks"][number]);

    return indexedAlgorithms.filter(({ algorithm, searchText }) => {
      if (activeTaskFilter && !algorithm.supportedTasks.includes(activeTaskFilter)) return false;
      if (familyFilter !== "all" && algorithm.family !== familyFilter) return false;
      if (!deferredSearch) return true;
      return searchText.includes(deferredSearch);
    }).map(({ algorithm }) => algorithm);
  }, [deferredSearch, familyFilter, indexedAlgorithms, taskFilter]);

  const selected = filteredAlgorithms.find((algorithm) => algorithm.id === selectedId) ?? filteredAlgorithms[0] ?? null;
  const mlPack = allDomainPacks.find((pack) => pack.id === "ml") ?? null;

  useEffect(() => {
    if (!selected) return;
    if (selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    const nextQuery = buildUpdatedQueryString(searchParams, {
      search: deferredSearchText || null,
      taskType: taskFilter === "all" ? null : taskFilter,
      family: familyFilter === "all" ? null : familyFilter,
      algorithm: selectedId === (algorithms[0]?.id ?? "linear-regression") && !algorithmParam ? null : selectedId,
    });

    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/tools/ml?${nextQuery}` : "/tools/ml", { scroll: false });
  }, [algorithmParam, deferredSearchText, familyFilter, router, searchParams, selectedId, taskFilter]);

  const isMlResetDisabled = !search && taskFilter === "all" && familyFilter === "all" && selectedId === (algorithms[0]?.id ?? "linear-regression");

  const resetMlFilters = () => {
    setSearch("");
    setTaskFilter("all");
    setFamilyFilter("all");
    setSelectedId(algorithms[0]?.id ?? "linear-regression");
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="ML Catalog"
        subtitle="Read-only machine learning and AutoML catalog from the local ML engine package."
        action={<Badge tone="amber">{algorithms.length} algorithms</Badge>}
      />

      <SectionDescription id="ml-catalog">
        Review supported algorithms, task coverage, hyperparameters, and AutoML-ready capabilities before wiring live training flows. This is an additive catalog only and does not replace any current HiTechClaw screens.
      </SectionDescription>

      <PackageWorkspaceNav current="ml" note="Shared package workspace for ML, domains, skills, integrations, docs, MCP, and chat." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Algorithms" value={algorithms.length.toString()} accent="text-amber" sublabel="Built-in catalog from @hitechclaw/ml" />
        <StatCard label="Task types" value={taskTypes.filter((item) => item !== "all").length.toString()} accent="text-cyan" sublabel="Classification, regression, clustering, anomaly, NLP and more" />
        <StatCard label="Families" value={families.filter((item) => item !== "all").length.toString()} accent="text-green" sublabel="Linear, tree, ensemble, clustering and additional groups" />
        <StatCard label="AutoML ready" value={taskFilter === "all" ? algorithms.length.toString() : getAlgorithmsForTask(taskFilter as MLAlgorithm["supportedTasks"][number]).length.toString()} accent="text-purple" sublabel="Algorithms available for the active task filter" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Algorithm catalog" note="Sourced from @hitechclaw/ml" />
          <FilterResetButton onClick={resetMlFilters} disabled={isMlResetDisabled} />
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search algorithms, tasks, families, or hyperparameters"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {taskTypes.map((entry) => (
            <Pill key={entry} active={taskFilter === entry} onClick={() => setTaskFilter(entry)}>
              {entry === "all" ? "All tasks" : entry}
            </Pill>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {families.map((entry) => (
            <Pill key={entry} active={familyFilter === entry} onClick={() => setFamilyFilter(entry)}>
              {entry === "all" ? "All families" : entry}
            </Pill>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAlgorithms.map((algorithm) => (
            <button
              key={algorithm.id}
              type="button"
              onClick={() => setSelectedId(algorithm.id)}
              className={`rounded-[22px] border p-4 text-left transition ${selected?.id === algorithm.id ? "border-cyan/40 bg-cyan/5" : "border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] hover:border-cyan/30"}`}
            >
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">{algorithm.family}</Badge>
                <Badge tone="green">{algorithm.hyperparameters.length} hyperparams</Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-text">{algorithm.name}</h2>
              <p className="mt-2 text-sm leading-6 text-text-dim">{algorithm.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {algorithm.supportedTasks.map((taskType) => (
                  <Badge key={`${algorithm.id}-${taskType}`} tone={getTaskTone(taskType)}>{taskType}</Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
        {!filteredAlgorithms.length ? <EmptyState label="No algorithms matched this filter." /> : null}
      </Card>

      {selected ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">{selected.family}</Badge>
                <Badge tone="green">{selected.hyperparameters.length} hyperparams</Badge>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-text">{selected.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-dim">{selected.description}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Supported tasks" note="AutoML routing hints" />
                <div className="flex flex-wrap gap-2">
                  {selected.supportedTasks.map((taskType) => (
                    <Badge key={`${selected.id}-${taskType}`} tone={getTaskTone(taskType)}>{taskType}</Badge>
                  ))}
                </div>
                <p className="text-sm leading-6 text-text-dim">{getAlgorithmRiskNote(selected)}</p>
              </Card>

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Hyperparameters" note="Tuning surface" />
                <div className="space-y-3">
                  {selected.hyperparameters.map((parameter) => (
                    <div key={`${selected.id}-${parameter.name}`} className="rounded-2xl border border-border/80 bg-bg-card/60 p-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="cyan">{parameter.name}</Badge>
                        <Badge tone="green">{parameter.type}</Badge>
                        <Badge tone="slate">default {String(parameter.default)}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-dim">{parameter.description}</p>
                      {parameter.choices?.length ? (
                        <p className="mt-2 text-xs text-text-dim">choices: {parameter.choices.map((choice) => String(choice)).join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <PackageActionBar
                title="Package actions"
                note="Move from this algorithm into related package screens."
                items={[
                  ...(mlPack ? [{ href: "/tools/domains?pack=ml", label: `${mlPack.icon} ML domain`, tone: "purple" as const }] : []),
                  { href: `/tools/skills?domain=ml&search=${encodeURIComponent(selected.name)}`, label: "Find related skills", tone: "cyan" },
                  { href: "/tools/integrations?category=ai", label: "Open AI integrations", tone: "green" },
                  { href: "/client/chat", label: "Open AI chat", tone: "green" },
                  { href: "/tools/docs", label: "Open docs", tone: "cyan" },
                ]}
              />

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="Cross-links" note="Domains and skills" />
                <div className="flex flex-wrap gap-2">
                  {mlPack ? (
                    <Link href="/tools/domains?pack=ml">
                      <Badge tone="purple">{mlPack.icon} ML domain</Badge>
                    </Link>
                  ) : null}
                  <Link href={`/tools/skills?domain=ml&search=${encodeURIComponent(selected.name)}`}>
                    <Badge tone="cyan">Find related skills</Badge>
                  </Link>
                </div>
                <p className="text-sm leading-6 text-text-dim">
                  Use the ML domain and skill registry deep-links to keep machine-learning discovery connected to the rest of the package-driven catalogs.
                </p>
              </Card>

              <Card className="space-y-3 border-border/70 bg-bg-deep/40">
                <SectionTitle title="AutoML notes" note="Additive rollout only" />
                <ul className="space-y-2 text-sm leading-6 text-text-dim">
                  <li>• Start with browse-only algorithm guidance before enabling real dataset uploads or training jobs.</li>
                  <li>• Reuse this catalog to drive future admin templates, ML onboarding, and evaluation workflows.</li>
                  <li>• Keep live training and model deployment behind explicit approvals and existing operational guardrails.</li>
                </ul>
              </Card>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState label="No algorithm selected." />
      )}
    </div>
  );
}

const taskTabs = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "Active" },
  { id: "done", label: "Done" },
];

function priorityTone(priority: string) {
  if (priority === "P1") return "red" as const;
  if (priority === "P2") return "amber" as const;
  return "slate" as const;
}

export function TasksToolScreen() {
  const [tab, setTab] = useState("todo");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState("P2");
  const { data, error, loading, refresh } = usePollingData<{ items: TaskItem[] }>("/api/tools/tasks", 12000);
  const now = useNow(60000);

  const groups = useMemo(() => {
    const items = data?.items ?? [];
    return {
      todo: items.filter((item) => item.status === "todo"),
      in_progress: items.filter((item) => item.status === "in_progress"),
      done: items.filter((item) => item.status === "done"),
    };
  }, [data?.items]);

  const createTask = async () => {
    if (!quickTitle.trim()) return;
    try {
      await fetchJson("/api/tools/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: quickTitle,
          priority: quickPriority,
          assignee: "owner",
          status: "todo",
        }),
      });
      setQuickTitle("");
      setQuickPriority("P2");
      await refresh();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Create failed');
    }
  };

  const moveTask = async (task: TaskItem, direction: "forward" | "back") => {
    const flow = ["todo", "in_progress", "done"];
    const currentIndex = flow.indexOf(task.status);
    const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= flow.length) return;

    try {
      await fetchJson(`/api/tools/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: flow[nextIndex] }),
      });
      await refresh();
    } catch (moveError) {
      toast.error(moveError instanceof Error ? moveError.message : 'Move failed');
    }
  };

  if (loading && !data) return <LoadingState label="Loading tasks" />;

  const renderTaskCard = (task: TaskItem) => {
    const overdue = task.due_date && new Date(task.due_date).getTime() < now && task.status !== "done";
    return (
      <Card key={task.id} className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
              <Badge tone="cyan">{task.assignee}</Badge>
              {task.category ? <Badge tone="slate">{task.category}</Badge> : null}
            </div>
            <h3 className="mt-3 text-base font-semibold text-text">{task.title}</h3>
          </div>
          <div className="text-right text-xs text-text-dim">
            <div className={overdue ? "text-red" : ""}>{task.due_date ? formatShortDate(task.due_date) : "No due"}</div>
            <div className="mt-1">{task.status.replace("_", " ")}</div>
          </div>
        </div>
        {task.description ? <p className="text-sm leading-6 text-text-dim">{task.description}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void moveTask(task, "back")}
            className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 text-sm text-text-dim"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void moveTask(task, "forward")}
            className="min-h-11 rounded-2xl border border-cyan/30 bg-cyan/10 text-sm font-semibold text-cyan"
          >
            Advance
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        title="Task Board"
        subtitle="Mobile tabs for quick flow, with a three-column desktop view and a floating quick-add control."
      />

      <div className="flex gap-2 overflow-x-auto md:hidden">
        {taskTabs.map((taskTab) => (
          <Pill key={taskTab.id} active={tab === taskTab.id} onClick={() => setTab(taskTab.id)}>
            {taskTab.label} ({groups[taskTab.id as keyof typeof groups].length})
          </Pill>
        ))}
      </div>

      <div className="space-y-4 md:hidden">
        {groups[tab as keyof typeof groups].length ? (
          groups[tab as keyof typeof groups].map(renderTaskCard)
        ) : (
          <EmptyState label="No tasks in this column." />
        )}
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-3">
        {taskTabs.map((column) => (
          <Card key={column.id} className="space-y-3">
            <SectionTitle title={column.label} note={`${groups[column.id as keyof typeof groups].length} tasks`} />
            <div className="space-y-3">
              {groups[column.id as keyof typeof groups].length ? (
                groups[column.id as keyof typeof groups].map(renderTaskCard)
              ) : (
                <EmptyState label="No tasks in this column." />
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-[88px] right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-[24px] border border-border bg-bg-card/95 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">Quick Add</div>
        <input
          value={quickTitle}
          onChange={(event) => setQuickTitle(event.target.value)}
          placeholder="New task title"
          className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-3 text-sm text-text outline-none"
        />
        <div className="mt-2 flex gap-2">
          {["P1", "P2", "P3"].map((priority) => (
            <Pill key={priority} active={quickPriority === priority} onClick={() => setQuickPriority(priority)}>
              {priority}
            </Pill>
          ))}
          <button
            type="button"
            onClick={() => void createTask()}
            className="ml-auto min-h-11 rounded-full border border-cyan/30 bg-cyan/10 px-5 text-xl font-semibold text-cyan"
          >
            +
          </button>
        </div>
      </div>

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}

const itemTypeColors: Record<string, string> = {
  linkedin: "#3b82f6",
  email: "#00D47E",
  campaign: "#00D47E",
  confession: "#f59e0b",
  task: "#8888A0",
  event: "#22c55e",
  reminder: "#ef4444",
};

function getWeekStart(date = new Date()) {
  const target = new Date(date);
  const day = target.getDay();
  const diff = (day + 6) % 7;
  target.setDate(target.getDate() - diff);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function CalendarToolScreen() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const { data, error, loading } = usePollingData<{ items: CalendarItem[] }>(
    `/api/tools/calendar?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`,
    20000
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>();
    for (const item of data?.items ?? []) {
      const key = new Date(item.scheduled_at).toISOString().slice(0, 10);
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }
    return grouped;
  }, [data?.items]);

  const selectedItems = selectedDay ? itemsByDay.get(selectedDay) ?? [] : [];
  const todayKey = new Date().toISOString().slice(0, 10);

  if (loading && !data) return <LoadingState label="Loading calendar" />;

  return (
    <div className="space-y-5">
      <ShellHeader
        title="Content Calendar"
        subtitle="Week view first, with a mobile-friendly horizontal grid, item dots, and a bottom-sheet day drill-down."
        action={
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart())}
            className="min-h-11 rounded-2xl border border-border px-4 text-sm text-text-dim"
          >
            Today
          </button>
        }
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}
            className="min-h-11 rounded-2xl border border-border px-4 text-sm text-text-dim"
          >
            Prev
          </button>
          <div className="text-sm font-semibold text-text">
            {formatShortDate(weekStart.toISOString())} - {formatShortDate(weekEnd.toISOString())}
          </div>
          <button
            type="button"
            onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}
            className="min-h-11 rounded-2xl border border-border px-4 text-sm text-text-dim"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs text-text-dim md:flex md:flex-wrap">
          {Object.entries(itemTypeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{type}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-3">
            {days.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const items = itemsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`min-h-40 rounded-[22px] border p-3 text-left ${
                    isToday ? "border-cyan/40 bg-cyan/10" : "border-border bg-bg-deep/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim">
                        {day.toLocaleDateString("en-ZA", { weekday: "short" })}
                      </div>
                      <div className={`mt-1 text-lg font-semibold ${isToday ? "text-cyan" : "text-text"}`}>
                        {day.getDate()}
                      </div>
                    </div>
                    {isToday ? <Badge tone="cyan">Today</Badge> : null}
                  </div>
                  <div className="mt-4 space-y-2">
                    {items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-text">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color ?? itemTypeColors[item.item_type] ?? "#8888A0" }}
                        />
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}
                    {items.length > 3 ? <div className="text-xs text-text-dim">+{items.length - 3} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <BottomSheet
        open={Boolean(selectedDay)}
        title={selectedDay ? `Schedule for ${formatDate(selectedDay, { month: "long", day: "numeric" })}` : "Day Detail"}
        onClose={() => setSelectedDay(null)}
      >
        <div className="space-y-3">
          {selectedItems.length ? (
            selectedItems.map((item) => (
              <Card key={item.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="purple">{item.item_type}</Badge>
                      <Badge tone={item.status === "published" ? "green" : item.status === "cancelled" ? "red" : "amber"}>
                        {item.status}
                      </Badge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-text">{item.title}</h3>
                  </div>
                  <span className="text-xs text-text-dim">{formatDate(item.scheduled_at)}</span>
                </div>
                {item.description ? <p className="text-sm leading-6 text-text-dim">{item.description}</p> : null}
              </Card>
            ))
          ) : (
            <EmptyState label="No scheduled items for this day." />
          )}
        </div>
      </BottomSheet>

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}

function runTone(status: string) {
  if (status === "running") return "green" as const;
  if (status === "failed") return "red" as const;
  if (status === "completed") return "cyan" as const;
  if (status === "killed") return "slate" as const;
  return "amber" as const;
}

export function AgentsLiveToolScreen() {
  const now = useNow(1000);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, error, loading, refresh } = usePollingData<{ items: SubagentRun[] }>("/api/tools/agents-live", 5000);

  const killRun = (run: SubagentRun) => {
    toast(`Kill agent "${run.run_label}"?`, {
      action: {
        label: "Confirm Kill",
        onClick: async () => {
          try {
            await fetchJson(`/api/tools/agents-live/${run.id}/kill`, { method: "POST" });
            toast.success(`Agent "${run.run_label}" terminated`);
            await refresh();
          } catch (killError) {
            toast.error(killError instanceof Error ? killError.message : "Kill failed");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 8000,
    });
  };

  if (loading && !data) return <LoadingState label="Loading sub-agent runs" />;

  return (
    <div className="space-y-5">
      <ShellHeader
        title="Sub-Agent Live"
        subtitle="Active builders first, with real-time elapsed timers, token counts, logs, and guarded kill controls."
        action={<Badge tone="green">Auto refresh 5s</Badge>}
      />

      <div className="space-y-4">
        {data?.items.length ? (
          data.items.map((run) => (
            <Card key={run.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${run.status === "running" ? "animate-pulse bg-green" : run.status === "failed" ? "bg-red" : "bg-text-dim"}`}
                    />
                    <Badge tone={runTone(run.status)}>{run.status}</Badge>
                    <Badge tone="purple">{run.model}</Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-text">{run.run_label}</h2>
                  <p className="mt-1 text-sm text-text-dim">{run.task_summary ?? "No summary supplied."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void killRun(run)}
                  disabled={run.status !== "running"}
                  className="min-h-11 rounded-2xl border border-red/30 bg-red/10 px-4 text-sm font-semibold text-red disabled:opacity-40"
                >
                  Kill
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-bg-deep/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Elapsed</div>
                  <div className="mt-2 text-base font-semibold text-text">
                    {elapsedLabel(run.started_at, run.completed_at, now)}
                  </div>
                </div>
                <div className="rounded-2xl bg-bg-deep/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Tokens</div>
                  <div className="mt-2 text-base font-semibold text-text">{run.token_count ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-bg-deep/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim">Started</div>
                  <div className="mt-2 text-base font-semibold text-text">{formatShortDate(run.started_at)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedId((current) => (current === run.id ? null : run.id))}
                className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-left text-sm text-text-dim"
              >
                {expandedId === run.id ? "Hide log" : "Show log"}
              </button>

              {expandedId === run.id ? (
                <div className="space-y-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-border bg-bg-deep p-4 text-xs leading-6 text-text">
                    {run.last_output ?? "No output captured yet."}
                  </pre>
                  {run.error_message ? <div className="text-sm text-red">{run.error_message}</div> : null}
                </div>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState label="No sub-agent runs found." />
        )}
      </div>

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}

const quickActions = ["Status", "Briefing", "Priority list"];

export function CommandToolScreen() {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { data, error, loading, refresh } = usePollingData<{ items: QuickCommand[] }>("/api/tools/commands?limit=10", 5000);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data?.items]);

  const sendCommand = async (command: string) => {
    if (!command.trim()) return;
    try {
      // Save to DB first
      await fetchJson("/api/tools/commands", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "default",
          command: command.trim(),
          status: "sent",
        }),
      });
      setMessage("");

      // FUNC-1: Forward command to OpenClaw gateway via server-side proxy
      try {
        const proxyRes = await fetch("/api/gateway/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "/api/system-event",
            method: "POST",
            body: { text: command.trim(), mode: "now" },
          }),
        });
        if (proxyRes.ok) {
          toast.success("Command sent to agent");
        } else {
          toast("Command saved — gateway unreachable", { icon: "⚠️" });
        }
      } catch {
        toast("Command saved — gateway unreachable", { icon: "⚠️" });
      }

      await refresh();
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : 'Send failed');
    }
  };

  if (loading && !data) return <LoadingState label="Loading quick command" />;

  return (
    <div className="flex min-h-[calc(100vh-110px)] flex-col gap-4 pb-24">
      <ShellHeader
        title="Quick Command"
        subtitle="Direct command dispatch into HiTechClaw AI with chat-style history, quick actions, and a sticky input bar."
      />

      <Card className="flex-1 overflow-hidden p-0">
        <div ref={scrollRef} className="flex max-h-[58vh] min-h-[50vh] flex-col gap-3 overflow-y-auto p-4">
          {data?.items.length ? (
            data.items.map((entry) => (
              <div key={entry.id} className="space-y-2">
                <div className="ml-auto max-w-[85%] rounded-[22px] rounded-br-md bg-cyan px-4 py-3 text-sm font-medium text-bg-deep">
                  {entry.command}
                </div>
                <div className="max-w-[88%] rounded-[22px] rounded-bl-md border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text">
                  {entry.response ?? "Awaiting response from agent."}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-dim">
                  <Badge tone={entry.status === "completed" ? "green" : entry.status === "processing" ? "amber" : "slate"}>
                    {entry.status}
                  </Badge>
                  <span>{timeAgo(entry.created_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="No recent commands yet." />
          )}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-[72px] z-40 mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-[24px] border border-border bg-bg-card/95 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur">
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setMessage(action);
                  void sendCommand(action);
                }}
                className="min-h-11 rounded-full border border-border bg-bg-deep/80 px-4 text-sm text-text-dim"
              >
                {action}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-3">
            <textarea
              rows={1}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Send a command to your agent"
              className="min-h-11 flex-1 resize-none rounded-2xl border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text outline-none"
            />
            <button
              type="button"
              onClick={() => void sendCommand(message)}
              className="min-h-11 rounded-2xl border border-cyan/30 bg-cyan px-5 text-sm font-semibold text-bg-deep"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {error ? <ErrorState error={error} /> : null}
    </div>
  );
}
