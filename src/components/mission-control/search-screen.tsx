"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { BookOpenText, Brain, RefreshCcw, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders, redirectToLogin } from "./api";
import { Card, ErrorState, SectionTitle, ShellHeader, StatCard } from "./dashboard";
import { useTenantFilter } from "./tenant-context";

type DocsResult = {
  id: number;
  title: string;
  category: string;
  preview?: string;
  file_path: string | null;
  updated_at: string;
  pinned: boolean;
};

type DocsResponse = {
  items: DocsResult[];
  timestamp?: string;
};

type LibraryResult = {
  id: string;
  title: string;
  category: string;
  snippet?: string;
  filePath: string;
  updatedAt: string;
  score?: number | null;
  tags?: string[];
};

type LibraryResponse = {
  items: LibraryResult[];
  timestamp?: string;
};

type MemoryResult = Record<string, unknown>;

type MemoryResponse = {
  results?: MemoryResult[];
  items?: MemoryResult[];
  matches?: MemoryResult[];
  ok?: boolean;
};

type SearchState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "cyan" | "purple" | "amber" | "green" | "slate" }) {
  const styles: Record<NonNullable<typeof tone>, string> = {
    cyan: "border-cyan/30 bg-cyan/10 text-cyan",
    purple: "border-purple/30 bg-purple/10 text-purple",
    amber: "border-amber/30 bg-amber/10 text-amber",
    green: "border-[rgba(0,212,126,0.28)] bg-[rgba(0,212,126,0.1)] text-[var(--accent)]",
    slate: "border-border bg-bg-deep/60 text-text-dim",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
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

async function requestOpenClaw<T>(path: string, environmentId: string | null): Promise<T> {
  return fetchJson<T>(`/api/openclaw-management${path}`, {
    headers: environmentId ? { "x-openclaw-environment-id": environmentId } : undefined,
  });
}

function formatRelative(dateLike: string | null | undefined) {
  if (!dateLike) return "Unknown";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) return "Just now";
  if (Math.abs(diffMinutes) < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function scoreLabel(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

function extractMemoryItems(data: MemoryResponse | null) {
  return data?.results ?? data?.items ?? data?.matches ?? [];
}

function extractMemoryTitle(item: MemoryResult, index: number) {
  const values = [item.title, item.name, item.key, item.id, item.file, item.path];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `Memory result ${index + 1}`;
}

function extractMemorySnippet(item: MemoryResult) {
  const values = [item.snippet, item.preview, item.content, item.text, item.summary, item.raw];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 280);
    }
  }
  return "No preview returned for this memory match.";
}

function extractMemoryMeta(item: MemoryResult) {
  const values = [item.path, item.file, item.namespace, item.agentId, item.kind];
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "OpenClaw memory";
}

export function SearchScreen() {
  const { openClawEnvironmentId } = useTenantFilter();
  const [query, setQuery] = useState("");
  const [docsCategory, setDocsCategory] = useState("all");
  const [memoryAgentId, setMemoryAgentId] = useState("main");
  const [lastQuery, setLastQuery] = useState("");
  const [docs, setDocs] = useState<SearchState<DocsResponse>>({ loading: false, error: null, data: null });
  const [library, setLibrary] = useState<SearchState<LibraryResponse>>({ loading: false, error: null, data: null });
  const [memory, setMemory] = useState<SearchState<MemoryResponse>>({ loading: false, error: null, data: null });

  const docsItems = docs.data?.items ?? [];
  const libraryItems = library.data?.items ?? [];
  const memoryItems = useMemo(() => extractMemoryItems(memory.data), [memory.data]);
  const totalResults = docsItems.length + libraryItems.length + memoryItems.length;

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Enter a search query first");
      return;
    }

    setLastQuery(trimmed);
    setDocs((current) => ({ ...current, loading: true, error: null }));
    setLibrary((current) => ({ ...current, loading: true, error: null }));
    setMemory((current) => ({ ...current, loading: true, error: null }));

    const docsUrl = `/api/tools/docs?limit=8${docsCategory !== "all" ? `&category=${encodeURIComponent(docsCategory)}` : ""}&search=${encodeURIComponent(trimmed)}`;
    const libraryUrl = `/api/tools/docs/library?limit=8${docsCategory !== "all" ? `&category=${encodeURIComponent(docsCategory)}` : ""}&search=${encodeURIComponent(trimmed)}`;

    const docsPromise = fetchJson<DocsResponse>(docsUrl)
      .then((data) => setDocs({ loading: false, error: null, data }))
      .catch((error) => {
        setDocs({ loading: false, error: error instanceof Error ? error.message : "Docs search failed", data: null });
      });

    const libraryPromise = fetchJson<LibraryResponse>(libraryUrl)
      .then((data) => setLibrary({ loading: false, error: null, data }))
      .catch((error) => {
        setLibrary({ loading: false, error: error instanceof Error ? error.message : "Library search failed", data: null });
      });

    const memoryPromise = openClawEnvironmentId
      ? requestOpenClaw<MemoryResponse>(
          `/memory/search?${new URLSearchParams({
            query: trimmed,
            agentId: memoryAgentId.trim() || "main",
            maxResults: "8",
          }).toString()}`,
          openClawEnvironmentId
        )
          .then((data) => setMemory({ loading: false, error: null, data }))
          .catch((error) => {
            setMemory({ loading: false, error: error instanceof Error ? error.message : "Memory search failed", data: null });
          })
      : Promise.resolve(setMemory({ loading: false, error: "Select an OpenClaw target to query memory.", data: null }));

    await Promise.all([docsPromise, libraryPromise, memoryPromise]);
  }, [docsCategory, memoryAgentId, openClawEnvironmentId, query]);

  const resetSearch = useCallback(() => {
    setLastQuery("");
    setDocs({ loading: false, error: null, data: null });
    setLibrary({ loading: false, error: null, data: null });
    setMemory({ loading: false, error: null, data: null });
  }, []);

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Unified retrieval"
        title="Search"
        subtitle="Run one operator query across document records, repository docs, and OpenClaw memory to verify retrieval coverage before wiring deeper workflows."
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
              onClick={() => void runSearch()}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Search now
            </button>
          </div>
        }
      />

      <Card className="space-y-4">
        <SectionTitle title="Search workspace" note="Docs records, repository library, and OpenClaw memory in one view" />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <label className="space-y-2 text-sm text-text-dim">
            <span>Operator query</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="Search playbooks, specs, memory, or agent knowledge"
                className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 pl-10 pr-4 text-sm text-text outline-none"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Docs category</span>
            <select
              value={docsCategory}
              onChange={(event) => setDocsCategory(event.target.value)}
              className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            >
              <option value="all">All categories</option>
              <option value="sop">SOP</option>
              <option value="spec">Spec</option>
              <option value="report">Report</option>
              <option value="log">Log</option>
              <option value="plan">Plan</option>
              <option value="research">Research</option>
              <option value="guide">Guide</option>
              <option value="brief">Brief</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Memory agent</span>
            <input
              value={memoryAgentId}
              onChange={(event) => setMemoryAgentId(event.target.value)}
              placeholder="main"
              className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={!query.trim() || docs.loading || library.loading || memory.loading}
              className="min-h-11 rounded-2xl bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/15 disabled:opacity-50"
            >
              {docs.loading || library.loading || memory.loading ? "Searching…" : "Run search"}
            </button>
            <button
              type="button"
              onClick={resetSearch}
              className="min-h-11 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-cyan/30"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/tools/docs" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Docs viewer</Link>
          <Link href="/models" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Model routing</Link>
          <Link href="/eval" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Evaluation</Link>
          <Link href="/multi-agent" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Multi-Agent</Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Last query" value={lastQuery || "—"} accent="text-cyan" sublabel="Most recent operator search" />
        <StatCard label="Total hits" value={totalResults.toString()} accent="text-green" sublabel="Combined matches across all sources" />
        <StatCard label="Docs records" value={docsItems.length.toString()} accent="text-purple" sublabel="Structured records from documents table" />
        <StatCard label="Memory hits" value={memoryItems.length.toString()} accent="text-amber" sublabel="Selected OpenClaw target memory matches" />
      </div>

      {!openClawEnvironmentId ? (
        <Card className="border-amber/30 bg-amber/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">OpenClaw memory search is idle</p>
              <p className="mt-1 text-sm text-text-dim">Choose a target to include memory results beside docs and repository search.</p>
            </div>
            <Link href="/settings/openclaw" className="inline-flex min-h-10 items-center rounded-2xl bg-amber/15 px-4 text-sm font-medium text-amber transition hover:bg-amber/20">
              Select target
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Docs records" note="Documents table search via /api/tools/docs" />
            <Badge tone="cyan">{docsItems.length} hits</Badge>
          </div>
          {docs.error ? <ErrorState error={docs.error} /> : null}
          {!docs.error && !docs.loading && lastQuery && docsItems.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">No document records matched this query.</p>
          ) : null}
          <div className="space-y-3">
            {docsItems.map((item) => (
              <Link key={item.id} href={`/tools/docs?id=${item.id}`} className="block rounded-[20px] border border-border/80 bg-bg-deep/40 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="cyan">{item.category}</Badge>
                  {item.pinned ? <Badge tone="green">Pinned</Badge> : null}
                  <span className="text-xs text-text-dim">{formatRelative(item.updated_at)}</span>
                </div>
                <p className="text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-text-dim">{item.preview ?? "No preview available."}</p>
                {item.file_path ? <p className="mt-2 text-xs text-text-dim">{item.file_path}</p> : null}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Repository docs" note="Library search over local docs/ content" />
            <Badge tone="purple">{libraryItems.length} hits</Badge>
          </div>
          {library.error ? <ErrorState error={library.error} /> : null}
          {!library.error && !library.loading && lastQuery && libraryItems.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">No repository docs matched this query.</p>
          ) : null}
          <div className="space-y-3">
            {libraryItems.map((item) => (
              <Link key={item.id} href={`/tools/docs?library=${encodeURIComponent(item.id)}`} className="block rounded-[20px] border border-border/80 bg-bg-deep/40 p-4 transition hover:border-cyan/30">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{item.category}</Badge>
                  {scoreLabel(item.score) ? <Badge tone="amber">score {scoreLabel(item.score)}</Badge> : null}
                  <span className="text-xs text-text-dim">{formatRelative(item.updatedAt)}</span>
                </div>
                <p className="text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-text-dim">{item.snippet ?? "No snippet available."}</p>
                <p className="mt-2 text-xs text-text-dim">{item.filePath}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="OpenClaw memory" note={openClawEnvironmentId ? `Target ${openClawEnvironmentId}` : "Select target to enable"} />
            <Badge tone="amber">{memoryItems.length} hits</Badge>
          </div>
          {memory.error ? <ErrorState error={memory.error} /> : null}
          {!memory.error && !memory.loading && lastQuery && memoryItems.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">No memory items matched this query.</p>
          ) : null}
          <div className="space-y-3">
            {memoryItems.map((item, index) => (
              <div key={`${extractMemoryTitle(item, index)}-${index}`} className="rounded-[20px] border border-border/80 bg-bg-deep/40 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="amber">Memory</Badge>
                  {scoreLabel(item.score) ? <Badge tone="green">score {scoreLabel(item.score)}</Badge> : null}
                  <span className="text-xs text-text-dim">{extractMemoryMeta(item)}</span>
                </div>
                <p className="text-sm font-semibold text-text">{extractMemoryTitle(item, index)}</p>
                <p className="mt-2 text-sm leading-6 text-text-dim">{extractMemorySnippet(item)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {!lastQuery ? (
        <Card className="space-y-4 border-border/70 bg-bg-deep/40">
          <SectionTitle title="Search flow" note="Current first-class search surface" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-cyan/30 bg-cyan/10 p-2 text-cyan">
                <Search className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Query once</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Use one operator query to check whether the current workspace already contains the information you need.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-purple/30 bg-purple/10 p-2 text-purple">
                <BookOpenText className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Compare sources</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Separate document records from repository docs so rollout teams can spot missing ingestion or stale content.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-amber/30 bg-amber/10 p-2 text-amber">
                <Brain className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Validate memory</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Probe OpenClaw memory before wiring evaluation and multi-agent flows on top of retrieval assumptions.</p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}