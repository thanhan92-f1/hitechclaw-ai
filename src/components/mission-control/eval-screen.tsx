"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Brain, FlaskConical, Gauge, Play, Plus, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders, redirectToLogin } from "./api";
import { Card, ErrorState, SectionTitle, ShellHeader, StatCard } from "./dashboard";

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type EvalMetrics = {
  accuracy: number;
  relevance: number;
  latency_ms: number;
  tokenUsage: TokenUsage;
  hallucination: boolean;
  toolCallAccuracy?: number;
};

type EvalResult = {
  testCaseId: string;
  actualOutput: string;
  metrics: EvalMetrics;
  passed: boolean;
  error?: string;
};

type EvalSuiteResult = {
  suiteId: string;
  suiteName: string;
  model: string;
  totalTests: number;
  passed: number;
  failed: number;
  averageMetrics: {
    accuracy: number;
    relevance: number;
    latency_ms: number;
    toolCallAccuracy?: number;
  };
  results: EvalResult[];
  startedAt: string;
  completedAt: string;
};

type QuickEvalResponse = {
  result: EvalResult;
  summary: EvalSuiteResult["averageMetrics"];
};

type BenchmarkOverview = {
  summary: {
    total_runs: number;
    models_tested: number;
    unique_prompts: number;
    avg_latency_ms: number;
    avg_quality: number;
    total_cost: number;
    total_tokens: number;
  };
  byModel: Array<{
    model_id: string;
    model_provider: string;
    runs: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    avg_quality: number;
    avg_cost: number;
  }>;
  recent: Array<{
    id: number;
    model_id: string;
    model_provider: string;
    prompt_label: string | null;
    latency_ms: number;
    total_tokens: number;
    cost_usd: number;
    quality_score: number | null;
    created_at: string;
  }>;
};

type RequestState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

type SuiteDraft = {
  id: string;
  input: string;
  expectedOutput: string;
};

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "green" | "cyan" | "amber" | "purple" | "slate" | "red" }) {
  const styles: Record<NonNullable<typeof tone>, string> = {
    green: "border-[rgba(0,212,126,0.28)] bg-[rgba(0,212,126,0.1)] text-[var(--accent)]",
    cyan: "border-cyan/30 bg-cyan/10 text-cyan",
    amber: "border-amber/30 bg-amber/10 text-amber",
    purple: "border-purple/30 bg-purple/10 text-purple",
    red: "border-red/30 bg-red/10 text-red",
    slate: "border-border bg-bg-deep/60 text-text-dim",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

async function fetchWithAuth<T>(url: string, options?: RequestInit & { redirectOnUnauthorized?: boolean }): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 401 && options?.redirectOnUnauthorized !== false) {
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

async function gatewayProxy<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch("/api/gateway/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ path, method: "POST", body }),
    cache: "no-store",
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; data?: { error?: string } & T }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? payload?.data?.error ?? `${response.status} ${response.statusText}`);
  }

  return payload.data as T;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatQuality(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}/10`;
}

function formatLatency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function timeAgo(dateLike: string | null | undefined) {
  if (!dateLike) return "Unknown";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (Math.abs(diffMinutes) < 1) return "Just now";
  if (Math.abs(diffMinutes) < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

export function EvalScreen() {
  const [agentConfigId, setAgentConfigId] = useState("");
  const [suiteName, setSuiteName] = useState("mission-control-suite");
  const [quickInput, setQuickInput] = useState("");
  const [quickExpected, setQuickExpected] = useState("");
  const [cases, setCases] = useState<SuiteDraft[]>([
    { id: createLocalId(), input: "", expectedOutput: "" },
    { id: createLocalId(), input: "", expectedOutput: "" },
  ]);
  const [quickState, setQuickState] = useState<RequestState<QuickEvalResponse>>({ loading: false, error: null, data: null });
  const [suiteState, setSuiteState] = useState<RequestState<EvalSuiteResult>>({ loading: false, error: null, data: null });
  const [benchmarksState, setBenchmarksState] = useState<RequestState<BenchmarkOverview>>({ loading: true, error: null, data: null });

  const loadBenchmarks = useCallback(async () => {
    setBenchmarksState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const data = await fetchWithAuth<BenchmarkOverview>("/api/benchmarks/overview?range=30d", {
        redirectOnUnauthorized: false,
      });
      setBenchmarksState({ loading: false, error: null, data });
    } catch (error) {
      setBenchmarksState({
        loading: false,
        error: error instanceof Error ? error.message : "Benchmark insights unavailable",
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    void loadBenchmarks();
  }, [loadBenchmarks]);

  const completedCases = useMemo(
    () => cases.filter((item) => item.input.trim().length > 0),
    [cases]
  );

  const lastQuick = quickState.data?.result ?? null;
  const suiteAverage = suiteState.data?.averageMetrics ?? null;
  const benchmarkSummary = benchmarksState.data?.summary ?? null;
  const leadingModels = benchmarksState.data?.byModel.slice(0, 3) ?? [];
  const recentRuns = benchmarksState.data?.recent.slice(0, 4) ?? [];

  const runQuickEval = useCallback(async () => {
    if (!quickInput.trim()) {
      toast.error("Enter a prompt to run a quick evaluation");
      return;
    }

    setQuickState({ loading: true, error: null, data: null });
    try {
      const data = await gatewayProxy<QuickEvalResponse>("/api/eval/quick", {
        input: quickInput.trim(),
        expectedOutput: quickExpected.trim() || undefined,
        agentConfigId: agentConfigId.trim() || undefined,
      });
      setQuickState({ loading: false, error: null, data });
      toast.success("Quick evaluation completed");
      void loadBenchmarks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quick evaluation failed";
      setQuickState({ loading: false, error: message, data: null });
      toast.error(message);
    }
  }, [agentConfigId, loadBenchmarks, quickExpected, quickInput]);

  const runSuiteEval = useCallback(async () => {
    const testCases = completedCases.map((item) => ({
      id: item.id,
      input: item.input.trim(),
      expectedOutput: item.expectedOutput.trim() || undefined,
    }));

    if (!testCases.length) {
      toast.error("Add at least one test case with an input");
      return;
    }

    setSuiteState({ loading: true, error: null, data: null });
    try {
      const data = await gatewayProxy<{ result: EvalSuiteResult }>("/api/eval/run", {
        suiteName: suiteName.trim() || "mission-control-suite",
        agentConfigId: agentConfigId.trim() || undefined,
        testCases,
      });
      setSuiteState({ loading: false, error: null, data: data.result });
      toast.success("Evaluation suite completed");
      void loadBenchmarks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Suite evaluation failed";
      setSuiteState({ loading: false, error: message, data: null });
      toast.error(message);
    }
  }, [agentConfigId, completedCases, loadBenchmarks, suiteName]);

  const addCase = useCallback(() => {
    setCases((current) => [...current, { id: createLocalId(), input: "", expectedOutput: "" }]);
  }, []);

  const updateCase = useCallback((id: string, field: "input" | "expectedOutput", value: string) => {
    setCases((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }, []);

  const removeCase = useCallback((id: string) => {
    setCases((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }, []);

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Gateway-backed validation"
        title="Evaluation"
        subtitle="Run quick prompt checks and small suites against the gateway evaluation framework, then compare outcomes with benchmark evidence already captured in Mission Control."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/benchmarks"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <Gauge className="h-4 w-4" />
              Benchmarks
            </Link>
            <button
              type="button"
              onClick={() => void loadBenchmarks()}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh evidence
            </button>
          </div>
        }
      />

      <Card className="space-y-4">
        <SectionTitle title="Evaluation control plane" note="Gateway eval endpoints plus benchmark evidence already present in the workspace" />
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <label className="space-y-2 text-sm text-text-dim">
            <span>Agent config ID</span>
            <input
              value={agentConfigId}
              onChange={(event) => setAgentConfigId(event.target.value)}
              placeholder="Optional agent override"
              className="min-h-11 rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
          </label>
          <div className="rounded-[20px] border border-border/70 bg-bg-deep/40 p-4 text-sm text-text-dim">
            <p className="font-medium text-text">How this screen works</p>
            <ul className="mt-2 space-y-1.5 leading-6">
              <li>• Quick eval calls the gateway `POST /api/eval/quick` route through a server-side proxy.</li>
              <li>• Suite eval calls `POST /api/eval/run` with multiple test cases and aggregates pass/fail metrics.</li>
              <li>• Benchmark evidence reads the existing `benchmark_runs` dataset when the current account can access it.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/search" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Search coverage</Link>
          <Link href="/models" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Model routing</Link>
          <Link href="/tools/ml" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">ML catalog</Link>
          <Link href="/multi-agent" className="rounded-2xl border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-cyan/30 hover:text-text">Multi-Agent</Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Benchmark runs"
          value={benchmarkSummary ? String(benchmarkSummary.total_runs) : "—"}
          accent="text-cyan"
          sublabel={benchmarkSummary ? `${benchmarkSummary.models_tested} models in the last 30d` : "Owner-only benchmark evidence"}
        />
        <StatCard
          label="Avg quality"
          value={benchmarkSummary ? formatQuality(benchmarkSummary.avg_quality) : lastQuick ? formatPercent(lastQuick.metrics.accuracy) : "—"}
          accent="text-green"
          sublabel={benchmarkSummary ? `${benchmarkSummary.unique_prompts} unique prompts benchmarked` : "Latest quick accuracy if available"}
        />
        <StatCard
          label="Quick eval"
          value={lastQuick ? (lastQuick.passed ? "Pass" : "Fail") : "Idle"}
          accent={lastQuick?.passed ? "text-green" : "text-amber"}
          sublabel={lastQuick ? `Latency ${formatLatency(lastQuick.metrics.latency_ms)}` : "Run a single prompt check"}
        />
        <StatCard
          label="Suite average"
          value={suiteAverage ? formatPercent(suiteAverage.accuracy) : "—"}
          accent="text-purple"
          sublabel={suiteAverage ? `${formatLatency(suiteAverage.latency_ms)} avg latency` : "Run a multi-case evaluation suite"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Quick eval" note="Single prompt and expected answer check" />
            <Badge tone="cyan">Gateway</Badge>
          </div>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Prompt</span>
            <textarea
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              rows={6}
              placeholder="Ask the agent a question or give it an instruction to score"
              className="w-full rounded-2xl border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text outline-none"
            />
          </label>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Expected output</span>
            <textarea
              value={quickExpected}
              onChange={(event) => setQuickExpected(event.target.value)}
              rows={4}
              placeholder="Optional expected answer used for accuracy and hallucination checks"
              className="w-full rounded-2xl border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runQuickEval()}
              disabled={quickState.loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/15 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {quickState.loading ? "Running…" : "Run quick eval"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickInput("");
                setQuickExpected("");
                setQuickState({ loading: false, error: null, data: null });
              }}
              className="min-h-11 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-cyan/30"
            >
              Reset
            </button>
          </div>

          {quickState.error ? <ErrorState error={quickState.error} /> : null}

          {quickState.data ? (
            <div className="space-y-3 rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={quickState.data.result.passed ? "green" : "amber"}>{quickState.data.result.passed ? "Passed" : "Needs review"}</Badge>
                <Badge tone={quickState.data.result.metrics.hallucination ? "red" : "green"}>
                  {quickState.data.result.metrics.hallucination ? "Hallucination flagged" : "No hallucination flagged"}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Accuracy</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatPercent(quickState.data.result.metrics.accuracy)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Relevance</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatPercent(quickState.data.result.metrics.relevance)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Latency</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatLatency(quickState.data.result.metrics.latency_ms)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Actual output</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">{quickState.data.result.actualOutput || "No output returned."}</p>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Suite eval" note="Multiple test cases sent to the evaluation framework" />
            <Badge tone="purple">{completedCases.length} ready</Badge>
          </div>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Suite name</span>
            <input
              value={suiteName}
              onChange={(event) => setSuiteName(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
            />
          </label>

          <div className="space-y-3">
            {cases.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="slate">Case {index + 1}</Badge>
                    {item.input.trim() ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Draft</Badge>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCase(item.id)}
                    disabled={cases.length === 1}
                    className="inline-flex min-h-9 items-center gap-2 rounded-2xl border border-border px-3 text-xs text-text-dim transition hover:border-red/30 hover:text-red disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>

                <textarea
                  value={item.input}
                  onChange={(event) => updateCase(item.id, "input", event.target.value)}
                  rows={3}
                  placeholder="Prompt or task for this evaluation case"
                  className="w-full rounded-2xl border border-border bg-bg-card/80 px-4 py-3 text-sm text-text outline-none"
                />
                <textarea
                  value={item.expectedOutput}
                  onChange={(event) => updateCase(item.id, "expectedOutput", event.target.value)}
                  rows={3}
                  placeholder="Optional expected output"
                  className="w-full rounded-2xl border border-border bg-bg-card/80 px-4 py-3 text-sm text-text outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addCase}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-cyan/30"
            >
              <Plus className="h-4 w-4" />
              Add case
            </button>
            <button
              type="button"
              onClick={() => void runSuiteEval()}
              disabled={suiteState.loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-purple/10 px-4 text-sm font-semibold text-purple transition hover:bg-purple/15 disabled:opacity-50"
            >
              <FlaskConical className="h-4 w-4" />
              {suiteState.loading ? "Running suite…" : "Run suite"}
            </button>
          </div>

          {suiteState.error ? <ErrorState error={suiteState.error} /> : null}

          {suiteState.data ? (
            <div className="space-y-3 rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={suiteState.data.failed === 0 ? "green" : "amber"}>
                  {suiteState.data.passed}/{suiteState.data.totalTests} passed
                </Badge>
                <Badge tone="purple">{suiteState.data.model}</Badge>
                <Badge tone="slate">{formatLatency(suiteState.data.averageMetrics.latency_ms)} avg</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Accuracy</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatPercent(suiteState.data.averageMetrics.accuracy)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Relevance</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatPercent(suiteState.data.averageMetrics.relevance)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Tool accuracy</p>
                  <p className="mt-2 text-lg font-semibold text-text">{formatPercent(suiteState.data.averageMetrics.toolCallAccuracy)}</p>
                </div>
              </div>

              <div className="space-y-2">
                {suiteState.data.results.map((result, index) => (
                  <div key={`${result.testCaseId}-${index}`} className="rounded-2xl border border-border/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={result.passed ? "green" : "amber"}>{result.passed ? "Pass" : "Review"}</Badge>
                      <span className="text-xs text-text-dim">{result.testCaseId}</span>
                      {result.metrics.hallucination ? <Badge tone="red">Hallucination</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-text-dim">
                      Accuracy {formatPercent(result.metrics.accuracy)} · Relevance {formatPercent(result.metrics.relevance)} · Latency {formatLatency(result.metrics.latency_ms)}
                    </p>
                    {result.error ? <p className="mt-2 text-sm text-red">{result.error}</p> : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">{result.actualOutput || "No output returned."}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Benchmark evidence" note="Existing aggregated runs from `benchmark_runs`" />
            <Badge tone="amber">30d</Badge>
          </div>

          {benchmarksState.error ? (
            <div className="rounded-[20px] border border-amber/30 bg-amber/5 p-4 text-sm text-text-dim">
              <p className="font-medium text-text">Benchmark evidence is limited</p>
              <p className="mt-2 leading-6">{benchmarksState.error}. The evaluation controls above still work if the gateway exposes the eval framework.</p>
            </div>
          ) : null}

          {!benchmarksState.error && benchmarkSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Average latency</p>
                <p className="mt-2 text-lg font-semibold text-text">{formatLatency(benchmarkSummary.avg_latency_ms)}</p>
              </div>
              <div className="rounded-[20px] border border-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Prompt coverage</p>
                <p className="mt-2 text-lg font-semibold text-text">{benchmarkSummary.unique_prompts}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {leadingModels.length ? (
              leadingModels.map((model) => (
                <div key={`${model.model_id}-${model.model_provider}`} className="rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="purple">{model.model_provider}</Badge>
                    <Badge tone="slate">{model.runs} runs</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-text">{model.model_id}</p>
                  <p className="mt-2 text-sm text-text-dim">
                    P50 {formatLatency(model.p50_latency_ms)} · P95 {formatLatency(model.p95_latency_ms)} · Quality {formatQuality(model.avg_quality)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">
                No benchmark model evidence is available for this account yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Operational guidance" note="How to use eval alongside search, models, and benchmarks" />
            <Badge tone="green">Workflow-ready</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-cyan/30 bg-cyan/10 p-2 text-cyan">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Start with quick checks</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Verify prompt intent, hallucination risk, and raw latency before spending time on broader suite design.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-purple/30 bg-purple/10 p-2 text-purple">
                <Brain className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Promote to suites</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Capture reusable prompts as suite cases so operators can compare pass rates after model or workflow changes.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-amber/30 bg-amber/10 p-2 text-amber">
                <Gauge className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Correlate with benchmarks</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Use benchmark trends to decide whether a model change improved quality enough to justify cost and latency.</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Recent benchmark runs</p>
            {recentRuns.length ? (
              recentRuns.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                  <div>
                    <p className="text-sm font-semibold text-text">{run.model_id}</p>
                    <p className="mt-1 text-xs text-text-dim">{run.prompt_label || "Unlabeled prompt"} · {timeAgo(run.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim">
                    <Badge tone="slate">{formatLatency(run.latency_ms)}</Badge>
                    <Badge tone="amber">{formatQuality(run.quality_score)}</Badge>
                    <Badge tone="purple">{run.total_tokens} tok</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">
                No recent benchmark runs available.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}