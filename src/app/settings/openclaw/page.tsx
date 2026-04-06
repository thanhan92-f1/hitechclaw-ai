"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Save,
  ServerCog,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { SectionDescription } from "@/components/mission-control/dashboard-clarity";
import { GlowingEffect } from "@/components/ui/glowing-effect";

type OpenClawEnvironment = {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseUrl: string;
  gatewayUrl: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  config: {
    notes?: string;
    defaultProvider?: string;
    defaultModel?: string;
    region?: string;
    tags?: string[];
    allowDestructiveActions?: boolean;
    confirmHighRiskActions?: boolean;
    requestTimeoutMs?: number;
    [key: string]: unknown;
  };
  managementApiKeyConfigured: boolean;
  gatewayTokenConfigured: boolean;
  authTokenConfigured: boolean;
  source: "database" | "environment";
};

type EnvironmentsResponse = {
  environments: OpenClawEnvironment[];
  defaultEnvironmentId: string;
  environmentFallback?: OpenClawEnvironment;
};

type FormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  baseUrl: string;
  gatewayUrl: string;
  managementApiKey: string;
  gatewayToken: string;
  authToken: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  notes: string;
  defaultProvider: string;
  defaultModel: string;
  region: string;
  tags: string;
  allowDestructiveActions: boolean;
  confirmHighRiskActions: boolean;
  requestTimeoutMs: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  baseUrl: "",
  gatewayUrl: "",
  managementApiKey: "",
  gatewayToken: "",
  authToken: "",
  isActive: true,
  isDefault: false,
  sortOrder: 0,
  notes: "",
  defaultProvider: "",
  defaultModel: "",
  region: "",
  tags: "",
  allowDestructiveActions: false,
  confirmHighRiskActions: true,
  requestTimeoutMs: "15000",
};

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof document !== "undefined") {
    const csrf = document.cookie.match(/mc_csrf=([^;]+)/)?.[1];
    if (csrf) headers["x-csrf-token"] = decodeURIComponent(csrf);
  }
  return headers;
}

function toFormState(environment?: OpenClawEnvironment | null): FormState {
  if (!environment) return EMPTY_FORM;

  return {
    id: environment.id,
    name: environment.name,
    slug: environment.slug,
    description: environment.description ?? "",
    baseUrl: environment.baseUrl,
    gatewayUrl: environment.gatewayUrl ?? "",
    managementApiKey: "",
    gatewayToken: "",
    authToken: "",
    isActive: environment.isActive,
    isDefault: environment.isDefault,
    sortOrder: environment.sortOrder,
    notes: typeof environment.config.notes === "string" ? environment.config.notes : "",
    defaultProvider: typeof environment.config.defaultProvider === "string" ? environment.config.defaultProvider : "",
    defaultModel: typeof environment.config.defaultModel === "string" ? environment.config.defaultModel : "",
    region: typeof environment.config.region === "string" ? environment.config.region : "",
    tags: Array.isArray(environment.config.tags) ? environment.config.tags.join(", ") : "",
    allowDestructiveActions: Boolean(environment.config.allowDestructiveActions),
    confirmHighRiskActions:
      environment.config.confirmHighRiskActions === undefined
        ? true
        : Boolean(environment.config.confirmHighRiskActions),
    requestTimeoutMs:
      environment.config.requestTimeoutMs === undefined
        ? "15000"
        : String(environment.config.requestTimeoutMs),
  };
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function OpenClawSettingsPage() {
  const [environments, setEnvironments] = useState<OpenClawEnvironment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedEnvironment = useMemo(
    () => environments.find((environment) => environment.id === selectedId) ?? null,
    [environments, selectedId],
  );

  const loadEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/openclaw/environments", {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      const data = (await response.json()) as EnvironmentsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load OpenClaw environments");
      }

      setEnvironments(data.environments ?? []);
      const nextSelectedId =
        (selectedId && data.environments.some((environment) => environment.id === selectedId) && selectedId) ||
        data.defaultEnvironmentId ||
        data.environments[0]?.id ||
        null;
      setSelectedId(nextSelectedId);
      setForm(toFormState(data.environments.find((environment) => environment.id === nextSelectedId) ?? null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load OpenClaw environments");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  useEffect(() => {
    setForm(toFormState(selectedEnvironment));
  }, [selectedEnvironment]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: form.name,
        slug: normalizeSlug(form.slug || form.name),
        description: form.description,
        baseUrl: form.baseUrl,
        gatewayUrl: form.gatewayUrl,
        managementApiKey: form.managementApiKey,
        gatewayToken: form.gatewayToken,
        authToken: form.authToken,
        isActive: form.isActive,
        isDefault: form.isDefault,
        sortOrder: Number(form.sortOrder) || 0,
        config: {
          notes: form.notes,
          defaultProvider: form.defaultProvider,
          defaultModel: form.defaultModel,
          region: form.region,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          allowDestructiveActions: form.allowDestructiveActions,
          confirmHighRiskActions: form.confirmHighRiskActions,
          requestTimeoutMs: form.requestTimeoutMs ? Number(form.requestTimeoutMs) : undefined,
        },
      };

      const response = await fetch(
        form.id ? `/api/settings/openclaw/environments/${form.id}` : "/api/settings/openclaw/environments",
        {
          method: form.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { environment?: OpenClawEnvironment; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save OpenClaw environment");
      }

      const savedId = data.environment?.id ?? form.id;
      setSuccess(form.id ? "Environment updated." : "Environment created.");
      await loadEnvironments();
      if (savedId) {
        setSelectedId(savedId);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save OpenClaw environment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedEnvironment || selectedEnvironment.source !== "database") return;
    const confirmed = window.confirm(`Delete OpenClaw environment "${selectedEnvironment.name}"?`);
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/settings/openclaw/environments/${selectedEnvironment.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete OpenClaw environment");
      }

      setSuccess("Environment deleted.");
      await loadEnvironments();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete OpenClaw environment");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <GlowingEffect blur={0} spread={20} variant="white" movementDuration={2} disabled={false} />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            <ServerCog className="h-3.5 w-3.5" />
            OpenClaw environments
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Manage multiple OpenClaw targets</h1>
          <SectionDescription id="openclaw-settings">
            Configure one or more OpenClaw management endpoints, keep secrets isolated, and define runtime guardrails per environment.
          </SectionDescription>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Environment registry</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Switch between database-backed or env-backed targets.</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]/40"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-secondary)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading environments…
            </div>
          ) : (
            <div className="space-y-3">
              {environments.map((environment) => {
                const active = selectedId === environment.id;
                return (
                  <button
                    key={environment.id}
                    type="button"
                    onClick={() => setSelectedId(environment.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[var(--accent)]/40 bg-[rgba(0,212,126,0.08)]"
                        : "border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{environment.name}</span>
                          {environment.isDefault ? (
                            <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                              Default
                            </span>
                          ) : null}
                          {environment.source === "environment" ? (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                              ENV
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{environment.description || environment.baseUrl}</p>
                      </div>
                      <Globe className="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--text-tertiary)]">
                      <span className="rounded-full border border-[var(--border)] px-2 py-1">{environment.slug}</span>
                      {environment.managementApiKeyConfigured ? <span className="rounded-full border border-[var(--border)] px-2 py-1">mgmt key</span> : null}
                      {environment.gatewayTokenConfigured ? <span className="rounded-full border border-[var(--border)] px-2 py-1">gateway token</span> : null}
                      {environment.authTokenConfigured ? <span className="rounded-full border border-[var(--border)] px-2 py-1">auth token</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {form.id ? "Edit environment" : "Create environment"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Define management base URL, optional gateway metadata, and high-risk action policy.
              </p>
            </div>
            {selectedEnvironment?.source === "environment" ? (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <ShieldAlert className="h-4 w-4" />
                Env-backed fallback is read-only here.
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Name</span>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="prod-openclaw" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
              <span>Description</span>
              <input value={form.description} onChange={(event) => updateField("description", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Management base URL</span>
              <input value={form.baseUrl} onChange={(event) => updateField("baseUrl", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="https://openclaw.example.com:9998" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Gateway URL</span>
              <input value={form.gatewayUrl} onChange={(event) => updateField("gatewayUrl", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="https://gateway.example.com:18789" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Management API key</span>
              <input value={form.managementApiKey} onChange={(event) => updateField("managementApiKey", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder={selectedEnvironment?.managementApiKeyConfigured ? "Leave blank to keep current key" : "Paste management API key"} />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Gateway token</span>
              <input value={form.gatewayToken} onChange={(event) => updateField("gatewayToken", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder={selectedEnvironment?.gatewayTokenConfigured ? "Leave blank to keep current token" : "Optional gateway token"} />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Auth token</span>
              <input value={form.authToken} onChange={(event) => updateField("authToken", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder={selectedEnvironment?.authTokenConfigured ? "Leave blank to keep current token" : "Optional auth token"} />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Sort order</span>
              <input type="number" value={form.sortOrder} onChange={(event) => updateField("sortOrder", Number(event.target.value))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Default provider</span>
              <input value={form.defaultProvider} onChange={(event) => updateField("defaultProvider", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="anthropic" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Default model</span>
              <input value={form.defaultModel} onChange={(event) => updateField("defaultModel", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="anthropic/claude-sonnet-4-20250514" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Region</span>
              <input value={form.region} onChange={(event) => updateField("region", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="ap-southeast-1" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)]">
              <span>Request timeout (ms)</span>
              <input value={form.requestTimeoutMs} onChange={(event) => updateField("requestTimeoutMs", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="15000" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
              <span>Tags</span>
              <input value={form.tags} onChange={(event) => updateField("tags", event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" placeholder="production, vietnam, managed" />
            </label>
            <label className="space-y-2 text-sm text-[var(--text-secondary)] md:col-span-2">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] outline-none" />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                key: "isActive" as const,
                label: "Environment active",
                description: "Inactive targets stay in the registry but cannot be selected as default.",
              },
              {
                key: "isDefault" as const,
                label: "Use as default target",
                description: "The OpenClaw dashboard uses this target when no specific environment is selected.",
              },
              {
                key: "allowDestructiveActions" as const,
                label: "Allow destructive actions",
                description: "Gate resets, config apply, service stop, and similar risky endpoints for this target.",
              },
              {
                key: "confirmHighRiskActions" as const,
                label: "Require confirmation for high-risk actions",
                description: "Keep client confirmation enabled for restart, upgrade, cleanup, and mutation APIs.",
              },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                <input
                  type="checkbox"
                  checked={Boolean(form[toggle.key])}
                  onChange={(event) => updateField(toggle.key, event.target.checked as never)}
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] bg-transparent text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{toggle.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{toggle.description}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedEnvironment?.source === "environment" ? (
                <span>Update env-backed values in `.env.local` or create a database-backed environment instead.</span>
              ) : (
                <span>Secrets stay encrypted at rest and are masked after save.</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedEnvironment?.source === "database" ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/25 px-4 text-sm font-medium text-red-300 transition hover:border-red-500/50 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || selectedEnvironment?.source === "environment"}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[rgba(0,212,126,0.12)] px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save environment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
