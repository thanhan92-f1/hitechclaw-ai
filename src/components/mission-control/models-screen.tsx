"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Settings } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders, redirectToLogin } from "./api";
import { Card, ErrorState, LoadingState, SectionTitle, ShellHeader, StatCard } from "./dashboard";
import { useTenantFilter } from "./tenant-context";

type FetchState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type PollingState<T> = FetchState<T> & {
  refresh: () => Promise<void>;
};

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

type AliasEntry = {
  alias: string;
  model: string;
};

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "green" | "cyan" | "amber" | "purple" | "slate" }) {
  const styles: Record<NonNullable<typeof tone>, string> = {
    green: "border-[rgba(0,212,126,0.28)] bg-[rgba(0,212,126,0.1)] text-[var(--accent)]",
    cyan: "border-cyan/30 bg-cyan/10 text-cyan",
    amber: "border-amber/30 bg-amber/10 text-amber",
    purple: "border-purple/30 bg-purple/10 text-purple",
    slate: "border-border bg-bg-deep/60 text-text-dim",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

async function requestOpenClaw<T>(path: string, environmentId: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/openclaw-management${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(environmentId ? { "x-openclaw-environment-id": environmentId } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
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
    data = text;
  }

  if (!response.ok) {
    if (typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string") {
      throw new Error((data as { error: string }).error);
    }
    throw new Error(typeof data === "string" && data ? data : `${response.status} ${response.statusText}`);
  }

  return data as T;
}

function useOpenClawResource<T>(path: string, environmentId: string | null, enabled = true, intervalMs = 0): PollingState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    loading: enabled,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const data = await requestOpenClaw<T>(path, environmentId);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        error: error instanceof Error ? error.message : "OpenClaw request failed",
        loading: false,
      }));
    }
  }, [enabled, environmentId, path]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, refresh]);

  return {
    ...state,
    refresh,
  };
}

function normalizeModelName(entry: string | { id?: string; name?: string; model?: string; label?: string } | null | undefined) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  return entry.name ?? entry.model ?? entry.label ?? entry.id ?? null;
}

function normalizeModelList(data: ModelFallbacksInfo | ModelsCatalogInfo | null | undefined) {
  const source = [
    ...(Array.isArray(data?.models) ? data.models : []),
    ...(Array.isArray((data as ModelFallbacksInfo | undefined)?.fallbacks) ? (data as ModelFallbacksInfo).fallbacks ?? [] : []),
    ...(Array.isArray(data?.items) ? data.items : []),
  ];

  return Array.from(
    new Set(
      source
        .map((entry) => normalizeModelName(entry as string | { id?: string; name?: string; model?: string; label?: string }))
        .filter((entry): entry is string => Boolean(entry?.trim()))
        .map((entry) => entry.trim())
    )
  ).sort((left, right) => left.localeCompare(right));
}

function normalizeAliases(data: ModelAliasesInfo | null | undefined): AliasEntry[] {
  const fromArray = (source: Array<Record<string, unknown>>) =>
    source
      .map((entry) => ({
        alias: String(entry.alias ?? entry.name ?? entry.id ?? "").trim(),
        model: String(entry.model ?? entry.target ?? entry.value ?? "").trim(),
      }))
      .filter((entry) => entry.alias && entry.model);

  if (Array.isArray(data?.items)) {
    return fromArray(data.items).sort((left, right) => left.alias.localeCompare(right.alias));
  }

  if (Array.isArray(data?.aliases)) {
    return fromArray(data.aliases).sort((left, right) => left.alias.localeCompare(right.alias));
  }

  if (data?.aliases && typeof data.aliases === "object") {
    return Object.entries(data.aliases)
      .map(([alias, value]) => ({
        alias: alias.trim(),
        model:
          typeof value === "string"
            ? value.trim()
            : String(value?.model ?? value?.target ?? value?.value ?? "").trim(),
      }))
      .filter((entry) => entry.alias && entry.model)
      .sort((left, right) => left.alias.localeCompare(right.alias));
  }

  return [];
}

export function ModelsScreen() {
  const { openClawEnvironmentId } = useTenantFilter();
  const [defaultModelDraft, setDefaultModelDraft] = useState("");
  const [imageModelDraft, setImageModelDraft] = useState("");
  const [aliasName, setAliasName] = useState("");
  const [aliasModel, setAliasModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [imageFallbackModel, setImageFallbackModel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [hydratedDrafts, setHydratedDrafts] = useState(false);

  const catalog = useOpenClawResource<ModelsCatalogInfo>("/models", openClawEnvironmentId, true, 30000);
  const status = useOpenClawResource<ModelsStatusInfo>("/models/status?agentId=main&probe=true", openClawEnvironmentId, true, 30000);
  const aliases = useOpenClawResource<ModelAliasesInfo>("/models/aliases", openClawEnvironmentId, true, 30000);
  const fallbacks = useOpenClawResource<ModelFallbacksInfo>("/models/fallbacks", openClawEnvironmentId, true, 30000);
  const imageFallbacks = useOpenClawResource<ModelFallbacksInfo>("/models/image-fallbacks", openClawEnvironmentId, true, 30000);

  useEffect(() => {
    setHydratedDrafts(false);
  }, [openClawEnvironmentId]);

  useEffect(() => {
    if (hydratedDrafts || !status.data) return;
    setDefaultModelDraft(status.data.defaultModel ?? status.data.currentModel ?? status.data.activeModel ?? "");
    setImageModelDraft(status.data.imageDefaultModel ?? "");
    setHydratedDrafts(true);
  }, [hydratedDrafts, status.data]);

  const catalogModels = useMemo(() => normalizeModelList(catalog.data), [catalog.data]);
  const aliasEntries = useMemo(() => normalizeAliases(aliases.data), [aliases.data]);
  const fallbackEntries = useMemo(() => normalizeModelList(fallbacks.data), [fallbacks.data]);
  const imageFallbackEntries = useMemo(() => normalizeModelList(imageFallbacks.data), [imageFallbacks.data]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      catalog.refresh(),
      status.refresh(),
      aliases.refresh(),
      fallbacks.refresh(),
      imageFallbacks.refresh(),
    ]);
  }, [aliases, catalog, fallbacks, imageFallbacks, status]);

  const handleSetModel = useCallback(async (endpoint: "/models/default" | "/models/image-default", value: string, label: string) => {
    if (!value.trim()) {
      toast.error(`Enter a ${label} model first`);
      return;
    }

    setBusy(endpoint);
    try {
      await requestOpenClaw(endpoint, openClawEnvironmentId, {
        method: "PUT",
        body: JSON.stringify({ model: value.trim() }),
      });
      toast.success(`${label} model updated`);
      await Promise.all([catalog.refresh(), status.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Model update failed");
    } finally {
      setBusy(null);
    }
  }, [catalog, openClawEnvironmentId, status]);

  const handleSaveAlias = useCallback(async () => {
    if (!aliasName.trim() || !aliasModel.trim()) {
      toast.error("Enter both alias and target model");
      return;
    }

    setBusy("alias-save");
    try {
      await requestOpenClaw("/models/aliases", openClawEnvironmentId, {
        method: "POST",
        body: JSON.stringify({ alias: aliasName.trim(), model: aliasModel.trim() }),
      });
      toast.success(`Alias ${aliasName.trim()} saved`);
      setAliasName("");
      setAliasModel("");
      await aliases.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save alias");
    } finally {
      setBusy(null);
    }
  }, [aliasModel, aliasName, aliases, openClawEnvironmentId]);

  const handleDeleteAlias = useCallback(async (alias: string) => {
    setBusy(`alias-delete-${alias}`);
    try {
      await requestOpenClaw(`/models/aliases/${encodeURIComponent(alias)}`, openClawEnvironmentId, {
        method: "DELETE",
      });
      toast.success(`Alias ${alias} removed`);
      await aliases.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove alias");
    } finally {
      setBusy(null);
    }
  }, [aliases, openClawEnvironmentId]);

  const handleAddFallback = useCallback(async (kind: "fallbacks" | "image-fallbacks", value: string, reset: () => void) => {
    if (!value.trim()) {
      toast.error("Enter a fallback model first");
      return;
    }

    setBusy(`add-${kind}`);
    try {
      await requestOpenClaw(`/models/${kind}`, openClawEnvironmentId, {
        method: "POST",
        body: JSON.stringify({ model: value.trim() }),
      });
      toast.success(kind === "fallbacks" ? "Fallback added" : "Image fallback added");
      reset();
      await (kind === "fallbacks" ? fallbacks.refresh() : imageFallbacks.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add fallback");
    } finally {
      setBusy(null);
    }
  }, [fallbacks, imageFallbacks, openClawEnvironmentId]);

  const handleRemoveFallback = useCallback(async (kind: "fallbacks" | "image-fallbacks", value: string) => {
    setBusy(`remove-${kind}-${value}`);
    try {
      await requestOpenClaw(`/models/${kind}/${encodeURIComponent(value)}`, openClawEnvironmentId, {
        method: "DELETE",
      });
      toast.success(kind === "fallbacks" ? "Fallback removed" : "Image fallback removed");
      await (kind === "fallbacks" ? fallbacks.refresh() : imageFallbacks.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove fallback");
    } finally {
      setBusy(null);
    }
  }, [fallbacks, imageFallbacks, openClawEnvironmentId]);

  const initialLoading =
    catalog.loading &&
    status.loading &&
    aliases.loading &&
    fallbacks.loading &&
    imageFallbacks.loading &&
    !catalog.data &&
    !status.data;

  const primaryError = catalog.error ?? status.error ?? aliases.error ?? fallbacks.error ?? imageFallbacks.error;

  if (initialLoading) {
    return <LoadingState label="Syncing model operations" />;
  }

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Model operations"
        title="Models"
        subtitle="Operational model routing for OpenClaw targets, including default selection, aliases, and fallback chains."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/settings/openclaw"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <Settings className="h-4 w-4" />
              Targets
            </Link>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {!openClawEnvironmentId ? (
        <Card className="border-amber/30 bg-amber/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">No OpenClaw target selected</p>
              <p className="mt-1 text-sm text-text-dim">Choose a target in the top bar or in Settings / OpenClaw to make model changes against the correct environment.</p>
            </div>
            <Link href="/settings/openclaw" className="inline-flex min-h-10 items-center rounded-2xl bg-amber/15 px-4 text-sm font-medium text-amber transition hover:bg-amber/20">
              Open targets
            </Link>
          </div>
        </Card>
      ) : null}

      {primaryError && !catalog.data && !status.data ? <ErrorState error={primaryError} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Catalog" value={catalogModels.length.toString()} accent="text-cyan" sublabel="Available model entries" />
        <StatCard label="Default" value={status.data?.defaultModel ?? status.data?.currentModel ?? "—"} accent="text-green" sublabel="Primary text model" />
        <StatCard label="Aliases" value={aliasEntries.length.toString()} accent="text-purple" sublabel="Friendly routing names" />
        <StatCard label="Fallbacks" value={(fallbackEntries.length + imageFallbackEntries.length).toString()} accent="text-amber" sublabel="Text + image recovery chain" />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Default routing" note={openClawEnvironmentId ? `Target ${openClawEnvironmentId}` : "No target selected"} />
          <div className="flex flex-wrap gap-2">
            {status.data?.defaultModel ? <Badge tone="green">default {status.data.defaultModel}</Badge> : null}
            {status.data?.imageDefaultModel ? <Badge tone="purple">image {status.data.imageDefaultModel}</Badge> : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-text-dim">
            <span>Default model</span>
            <input
              list="models-screen-catalog"
              value={defaultModelDraft}
              onChange={(event) => setDefaultModelDraft(event.target.value)}
              placeholder="anthropic/claude-sonnet-4-20250514"
              className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-text-dim">
            <span>Image model</span>
            <input
              list="models-screen-catalog"
              value={imageModelDraft}
              onChange={(event) => setImageModelDraft(event.target.value)}
              placeholder="openai/gpt-image-1"
              className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
          </label>
        </div>
        <datalist id="models-screen-catalog">
          {catalogModels.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSetModel("/models/default", defaultModelDraft, "Default")}
            disabled={busy != null}
            className="rounded-2xl bg-[rgba(0,212,126,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(0,212,126,0.18)] disabled:opacity-50"
          >
            {busy === "/models/default" ? "Saving…" : "Set default"}
          </button>
          <button
            type="button"
            onClick={() => void handleSetModel("/models/image-default", imageModelDraft, "Image")}
            disabled={busy != null}
            className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-text transition hover:border-cyan/30 disabled:opacity-50"
          >
            {busy === "/models/image-default" ? "Saving…" : "Set image model"}
          </button>
        </div>
        {(catalog.error || status.error) && (catalog.data || status.data) ? (
          <p className="text-xs text-red">Partial sync warning: {catalog.error ?? status.error}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-4">
          <SectionTitle title="Aliases" note="Friendly names for operator and workflow routing" />
          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
            <input
              value={aliasName}
              onChange={(event) => setAliasName(event.target.value)}
              placeholder="fast-chat"
              className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
            <input
              list="models-screen-catalog"
              value={aliasModel}
              onChange={(event) => setAliasModel(event.target.value)}
              placeholder="anthropic/claude-sonnet-4-20250514"
              className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSaveAlias()}
              disabled={busy != null}
              className="rounded-2xl bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition hover:bg-cyan/15 disabled:opacity-50"
            >
              {busy === "alias-save" ? "Saving…" : "Save alias"}
            </button>
          </div>
          <div className="space-y-2">
            {aliasEntries.length ? (
              aliasEntries.map((entry) => (
                <div key={entry.alias} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/80 bg-bg-deep/40 p-4">
                  <div>
                    <p className="text-sm font-semibold text-text">{entry.alias}</p>
                    <p className="mt-1 text-xs text-text-dim">{entry.model}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAlias(entry.alias)}
                    disabled={busy != null}
                    className="rounded-2xl border border-red/30 px-3 py-1.5 text-xs font-medium text-red transition hover:bg-red/10 disabled:opacity-50"
                  >
                    {busy === `alias-delete-${entry.alias}` ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">No aliases configured yet.</p>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionTitle title="Fallback chains" note="Recovery order for text and image requests" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-[20px] border border-border/80 bg-bg-deep/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">Text fallbacks</p>
                <Badge tone="amber">{fallbackEntries.length} entries</Badge>
              </div>
              <div className="flex gap-2">
                <input
                  list="models-screen-catalog"
                  value={fallbackModel}
                  onChange={(event) => setFallbackModel(event.target.value)}
                  placeholder="backup text model"
                  className="min-h-11 flex-1 rounded-2xl border border-border bg-bg-card/70 px-4 text-sm text-text outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleAddFallback("fallbacks", fallbackModel, () => setFallbackModel(""))}
                  disabled={busy != null}
                  className="rounded-2xl bg-amber/10 px-4 py-2 text-sm font-semibold text-amber transition hover:bg-amber/15 disabled:opacity-50"
                >
                  {busy === "add-fallbacks" ? "Adding…" : "Add"}
                </button>
              </div>
              <div className="space-y-2">
                {fallbackEntries.length ? (
                  fallbackEntries.map((entry) => (
                    <div key={entry} className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 px-3 py-2">
                      <span className="text-sm text-text">{entry}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveFallback("fallbacks", entry)}
                        disabled={busy != null}
                        className="text-xs font-medium text-red disabled:opacity-50"
                      >
                        {busy === `remove-fallbacks-${entry}` ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-dim">No text fallbacks configured.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-[20px] border border-border/80 bg-bg-deep/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">Image fallbacks</p>
                <Badge tone="purple">{imageFallbackEntries.length} entries</Badge>
              </div>
              <div className="flex gap-2">
                <input
                  list="models-screen-catalog"
                  value={imageFallbackModel}
                  onChange={(event) => setImageFallbackModel(event.target.value)}
                  placeholder="backup image model"
                  className="min-h-11 flex-1 rounded-2xl border border-border bg-bg-card/70 px-4 text-sm text-text outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleAddFallback("image-fallbacks", imageFallbackModel, () => setImageFallbackModel(""))}
                  disabled={busy != null}
                  className="rounded-2xl bg-purple/10 px-4 py-2 text-sm font-semibold text-purple transition hover:bg-purple/15 disabled:opacity-50"
                >
                  {busy === "add-image-fallbacks" ? "Adding…" : "Add"}
                </button>
              </div>
              <div className="space-y-2">
                {imageFallbackEntries.length ? (
                  imageFallbackEntries.map((entry) => (
                    <div key={entry} className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 px-3 py-2">
                      <span className="text-sm text-text">{entry}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveFallback("image-fallbacks", entry)}
                        disabled={busy != null}
                        className="text-xs font-medium text-red disabled:opacity-50"
                      >
                        {busy === `remove-image-fallbacks-${entry}` ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-dim">No image fallbacks configured.</p>
                )}
              </div>
            </div>
          </div>
          {(aliases.error || fallbacks.error || imageFallbacks.error) && (aliasEntries.length || fallbackEntries.length || imageFallbackEntries.length) ? (
            <p className="text-xs text-red">Partial sync warning: {aliases.error ?? fallbacks.error ?? imageFallbacks.error}</p>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Catalog snapshot" note="Current model names returned by the selected OpenClaw target" />
          <div className="flex flex-wrap gap-2">
            <Link href="/tools/ml" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">
              Open ML catalog
            </Link>
            <Link href="/tools/integrations?category=ai" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">
              Open AI integrations
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {catalogModels.length ? (
            catalogModels.map((model) => <Badge key={model} tone="slate">{model}</Badge>)
          ) : (
            <p className="text-sm text-text-dim">No model catalog entries returned yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
