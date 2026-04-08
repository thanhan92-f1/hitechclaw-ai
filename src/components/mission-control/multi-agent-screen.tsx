"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Brain, GitBranch, Network, Play, RefreshCcw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders, redirectToLogin } from "./api";
import { Card, ErrorState, SectionTitle, ShellHeader, StatCard } from "./dashboard";

type AgentOrchestrationMode = "sequential" | "parallel" | "debate" | "supervisor";

type RuntimeAgent = {
  id: string;
  name: string;
  persona?: string;
  model?: string;
};

type AgentResult = {
  agentId: string;
  agentName: string;
  content: string;
  duration: number;
};

type MultiAgentResult = {
  taskId: string;
  mode: AgentOrchestrationMode;
  finalContent: string;
  agentResults: AgentResult[];
  totalDuration: number;
  rounds: number;
};

type LiveRunItem = {
  id: number;
  agent_id: string;
  run_label: string;
  model: string;
  task_summary: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
};

type RequestState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const modeDescriptions: Record<AgentOrchestrationMode, string> = {
  sequential: "Each agent receives the previous output and extends it step by step.",
  parallel: "All agents work at the same time and the first agent synthesizes the combined answer.",
  debate: "Agents iteratively critique and improve the current answer over multiple rounds.",
  supervisor: "A designated supervisor decomposes the task, delegates to workers, then synthesizes the result.",
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

function formatDuration(value: number | null | undefined) {
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }

  return payload as T;
}

async function gatewayProxy<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const response = await fetch("/api/gateway/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ path, method, body }),
    cache: "no-store",
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; data?: T & { error?: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? payload?.data?.error ?? `${response.status} ${response.statusText}`);
  }

  return payload.data as T;
}

export function MultiAgentScreen() {
  const [mode, setMode] = useState<AgentOrchestrationMode>("parallel");
  const [input, setInput] = useState("");
  const [maxRounds, setMaxRounds] = useState("3");
  const [supervisorAgentId, setSupervisorAgentId] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentsState, setAgentsState] = useState<RequestState<RuntimeAgent[]>>({ loading: true, error: null, data: null });
  const [liveRunsState, setLiveRunsState] = useState<RequestState<LiveRunItem[]>>({ loading: true, error: null, data: null });
  const [executionState, setExecutionState] = useState<RequestState<MultiAgentResult>>({ loading: false, error: null, data: null });

  const loadAgents = useCallback(async () => {
    setAgentsState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const data = await gatewayProxy<{ agents: RuntimeAgent[] }>("/api/multi-agent/agents", "GET");
      setAgentsState({ loading: false, error: null, data: data.agents });
    } catch (error) {
      setAgentsState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load orchestrator agents",
        data: null,
      });
    }
  }, []);

  const loadLiveRuns = useCallback(async () => {
    setLiveRunsState((current) => ({ ...current, loading: current.data == null, error: null }));
    try {
      const data = await fetchJson<{ items: LiveRunItem[] }>("/api/tools/agents-live?limit=6");
      setLiveRunsState({ loading: false, error: null, data: data.items });
    } catch (error) {
      setLiveRunsState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load live agent runs",
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    void loadAgents();
    void loadLiveRuns();
  }, [loadAgents, loadLiveRuns]);

  useEffect(() => {
    if (agentsState.data && agentsState.data.length && selectedAgentIds.length === 0) {
      setSelectedAgentIds(agentsState.data.slice(0, Math.min(3, agentsState.data.length)).map((agent) => agent.id));
    }
    if (!supervisorAgentId && agentsState.data?.length) {
      setSupervisorAgentId(agentsState.data[0].id);
    }
  }, [agentsState.data, selectedAgentIds.length, supervisorAgentId]);

  const availableAgents = agentsState.data ?? [];
  const selectedAgents = useMemo(
    () => availableAgents.filter((agent) => selectedAgentIds.includes(agent.id)),
    [availableAgents, selectedAgentIds]
  );

  const canRunSupervisor = mode !== "supervisor" || selectedAgentIds.filter((id) => id !== supervisorAgentId).length > 0;

  const runTask = useCallback(async () => {
    if (!input.trim()) {
      toast.error("Enter a task for the multi-agent orchestrator");
      return;
    }
    if (selectedAgentIds.length === 0) {
      toast.error("Select at least one runtime agent");
      return;
    }
    if (!canRunSupervisor) {
      toast.error("Supervisor mode needs a supervisor plus at least one worker");
      return;
    }

    setExecutionState({ loading: true, error: null, data: null });
    try {
      const payload = await gatewayProxy<{ result: MultiAgentResult }>("/api/multi-agent/execute", "POST", {
        input: input.trim(),
        mode,
        agentIds: selectedAgentIds,
        maxRounds: mode === "debate" ? Number(maxRounds) || 3 : undefined,
        supervisorAgentId: mode === "supervisor" ? supervisorAgentId || undefined : undefined,
      });
      setExecutionState({ loading: false, error: null, data: payload.result });
      toast.success("Multi-agent task completed");
      void loadLiveRuns();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Multi-agent execution failed";
      setExecutionState({ loading: false, error: message, data: null });
      toast.error(message);
    }
  }, [canRunSupervisor, input, loadLiveRuns, maxRounds, mode, selectedAgentIds, supervisorAgentId]);

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgentIds((current) => (current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]));
  }, []);

  const result = executionState.data;
  const liveRuns = liveRunsState.data ?? [];

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Gateway-backed orchestration"
        title="Multi-Agent"
        subtitle="Operate the runtime orchestrator directly from Mission Control with sequential, parallel, debate, and supervisor coordination modes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/agents-live"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <Bot className="h-4 w-4" />
              Live agents
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadAgents();
                void loadLiveRuns();
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh runtime
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Registered agents"
          value={String(availableAgents.length || 0)}
          accent="text-cyan"
          sublabel="Agents currently registered in the orchestrator"
        />
        <StatCard
          label="Selected workers"
          value={String(selectedAgentIds.length)}
          accent="text-green"
          sublabel={selectedAgents.length ? selectedAgents.map((agent) => agent.name).slice(0, 2).join(", ") : "Choose worker agents"}
        />
        <StatCard
          label="Execution mode"
          value={mode}
          accent="text-purple"
          sublabel={modeDescriptions[mode]}
        />
        <StatCard
          label="Last duration"
          value={result ? formatDuration(result.totalDuration) : "—"}
          accent="text-amber"
          sublabel={result ? `${result.agentResults.length} agent outputs · ${result.rounds} rounds` : "Run a coordinated task"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Task orchestration" note="Send one problem to multiple agents through the gateway orchestrator" />
            <Badge tone="cyan">Runtime</Badge>
          </div>

          <label className="space-y-2 text-sm text-text-dim">
            <span>Task</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={7}
              placeholder="Describe the problem, target output, and any constraints for the collaborating agents"
              className="w-full rounded-2xl border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text outline-none"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm text-text-dim">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as AgentOrchestrationMode)}
                className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
              >
                <option value="parallel">parallel</option>
                <option value="sequential">sequential</option>
                <option value="debate">debate</option>
                <option value="supervisor">supervisor</option>
              </select>
            </label>

            {mode === "debate" ? (
              <label className="space-y-2 text-sm text-text-dim">
                <span>Max rounds</span>
                <input
                  value={maxRounds}
                  onChange={(event) => setMaxRounds(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
                />
              </label>
            ) : mode === "supervisor" ? (
              <label className="space-y-2 text-sm text-text-dim">
                <span>Supervisor</span>
                <select
                  value={supervisorAgentId}
                  onChange={(event) => setSupervisorAgentId(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-bg-deep/80 px-4 text-sm text-text outline-none"
                >
                  {availableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-[20px] border border-border/70 bg-bg-deep/40 p-4 text-sm text-text-dim">
                {modeDescriptions[mode]}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Runtime agents" note="Select the agents that may participate" />
              <Badge tone="purple">{selectedAgentIds.length} selected</Badge>
            </div>

            {agentsState.error ? <ErrorState error={agentsState.error} /> : null}

            <div className="grid gap-3 md:grid-cols-2">
              {availableAgents.map((agent) => {
                const selected = selectedAgentIds.includes(agent.id);
                const isSupervisor = mode === "supervisor" && supervisorAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`rounded-[20px] border p-4 text-left transition ${selected ? "border-cyan/40 bg-cyan/5" : "border-border/70 bg-bg-deep/40 hover:border-cyan/20"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={selected ? "cyan" : "slate"}>{selected ? "Selected" : "Available"}</Badge>
                      {isSupervisor ? <Badge tone="amber">Supervisor</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text">{agent.name}</p>
                    <p className="mt-1 text-xs text-text-dim">{agent.id}</p>
                    <p className="mt-2 text-sm text-text-dim">{agent.persona || "No persona summary provided."}</p>
                    <p className="mt-2 text-xs text-text-dim">Model: {agent.model || "Unknown"}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runTask()}
              disabled={executionState.loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/15 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {executionState.loading ? "Running…" : "Run multi-agent task"}
            </button>
            <Link href="/eval" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text">
              <Sparkles className="h-4 w-4" />
              Evaluation
            </Link>
            <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text">
              <Brain className="h-4 w-4" />
              Search grounding
            </Link>
          </div>

          {executionState.error ? <ErrorState error={executionState.error} /> : null}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Execution result" note="Synthesis plus per-agent contributions" />
            <Badge tone="green">{result ? "Complete" : "Idle"}</Badge>
          </div>

          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="purple">{result.mode}</Badge>
                <Badge tone="slate">{formatDuration(result.totalDuration)}</Badge>
                <Badge tone="cyan">{result.rounds} rounds</Badge>
              </div>

              <div className="rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Final synthesis</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">{result.finalContent}</p>
              </div>

              <div className="space-y-3">
                {result.agentResults.map((agentResult, index) => (
                  <div key={`${agentResult.agentId}-${index}`} className="rounded-[20px] border border-border/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="cyan">{agentResult.agentName}</Badge>
                      <Badge tone="slate">{formatDuration(agentResult.duration)}</Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-dim">{agentResult.content}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">
              No multi-agent execution has been run in this view yet.
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Mode guidance" note="Match the coordination pattern to the job" />
            <Badge tone="amber">4 patterns</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(["parallel", "sequential", "debate", "supervisor"] as AgentOrchestrationMode[]).map((item) => (
              <div key={item} className="rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={item === mode ? "cyan" : "slate"}>{item}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-dim">{modeDescriptions[item]}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Operational context" note="Recent agent activity and workflow recommendations" />
            <Badge tone="green">Mission Control</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-cyan/30 bg-cyan/10 p-2 text-cyan">
                <Network className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Validate runtime pool</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Confirm the orchestrator has registered agents before testing coordination logic.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-purple/30 bg-purple/10 p-2 text-purple">
                <GitBranch className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Use evaluation after orchestration</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Take successful multi-agent outputs into `Evaluation` to score quality, hallucination risk, and latency.</p>
            </div>
            <div className="rounded-[20px] border border-border/70 p-4">
              <div className="mb-3 inline-flex rounded-2xl border border-amber/30 bg-amber/10 p-2 text-amber">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-text">Promote stable flows</p>
              <p className="mt-2 text-sm leading-6 text-text-dim">Once a collaboration pattern is reliable, move it into `Workflows` for governed repeatability.</p>
            </div>
          </div>

          {liveRunsState.error ? <ErrorState error={liveRunsState.error} /> : null}

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Recent live runs</p>
            {liveRuns.length ? (
              liveRuns.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/70 bg-bg-deep/40 p-4">
                  <div>
                    <p className="text-sm font-semibold text-text">{run.run_label}</p>
                    <p className="mt-1 text-xs text-text-dim">{run.agent_id} · {run.model} · {timeAgo(run.started_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim">
                    <Badge tone={run.status === "running" ? "cyan" : run.status === "completed" ? "green" : "amber"}>{run.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/80 px-4 py-5 text-sm text-text-dim">
                No recent live agent runs available.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}