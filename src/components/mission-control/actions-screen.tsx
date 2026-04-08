"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, RefreshCcw, ShieldAlert, SquareCheckBig } from "lucide-react";
import { toast } from "sonner";
import { activityStatus, getAuthHeaders, redirectToLogin, timeAgo } from "./api";
import { Card, ErrorState, LoadingState, SectionTitle, ShellHeader, StatCard } from "./dashboard";

type IncidentItem = {
  id: number;
  title: string;
  description: string | null;
  severity: "P1" | "P2" | "P3" | "P4";
  status: "created" | "assigned" | "investigating" | "resolved" | "postmortem" | "closed";
  assigned_to: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  created_at: string;
  updated_at: string;
  update_count: number;
};

type IncidentResponse = {
  incidents: IncidentItem[];
  stats: {
    open_count?: number;
    critical_count?: number;
    sla_breaches?: number;
    avg_resolution_hours?: number | string | null;
  };
  count: number;
  timestamp: string;
};

type ApprovalItem = {
  id: number;
  agent_id: string;
  title: string;
  status: string;
  priority: string;
  reviewer_note: string | null;
  created_at: string;
  expires_at: string | null;
  agent_name?: string;
};

type ApprovalResponse = {
  items: ApprovalItem[];
  pendingCount: number;
  timestamp: string;
};

type TaskItem = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done" | string;
  priority: string;
  assignee: string;
  due_date: string | null;
  category: string | null;
  updated_at: string;
};

type TaskResponse = {
  items: TaskItem[];
  timestamp: string;
};

type ActiveRunItem = {
  run_id?: string;
  id?: number;
  agent_id: string;
  agent_name?: string;
  run_label?: string;
  model: string | null;
  task_summary?: string | null;
  current_action?: string;
  status: "running" | "paused" | "failed" | "completed" | "killed" | string;
  started_at: string;
  source_channel?: string | null;
  is_main_agent?: boolean;
};

type ActiveRunsResponse = {
  runs: ActiveRunItem[];
  count: number;
  timestamp: string;
};

type AnomalyItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  anomaly_type: string;
  level: string;
  current_rate: number;
  baseline_rate: number;
  multiplier: number;
  created_at: string;
  acknowledged: boolean;
};

type AnomalyResponse = {
  anomalies: AnomalyItem[];
  count: number;
};

type RequestState = {
  loading: boolean;
  error: string | null;
};

const INCIDENT_NEXT_STATUS: Record<string, string | null> = {
  created: "assigned",
  assigned: "investigating",
  investigating: "resolved",
  resolved: "postmortem",
  postmortem: "closed",
  closed: null,
};

const TASK_NEXT_STATUS: Record<string, string | null> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
};

function severityTone(severity: string) {
  switch (severity) {
    case "P1":
      return "border-red/40 bg-red/10 text-red";
    case "P2":
      return "border-amber/40 bg-amber/10 text-amber";
    case "P3":
      return "border-cyan/40 bg-cyan/10 text-cyan";
    default:
      return "border-border bg-bg-deep/70 text-text-dim";
  }
}

function statusTone(status: string) {
  switch (status) {
    case "running":
    case "approved":
    case "resolved":
    case "done":
      return "border-green/30 bg-green/10 text-green";
    case "paused":
    case "pending":
    case "investigating":
    case "in_progress":
      return "border-amber/30 bg-amber/10 text-amber";
    case "failed":
    case "killed":
    case "rejected":
      return "border-red/30 bg-red/10 text-red";
    default:
      return "border-border bg-bg-deep/60 text-text-dim";
  }
}

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{children}</span>;
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        tone === "danger"
          ? "border-red/40 text-red hover:bg-red/10 disabled:border-border disabled:text-text-dim"
          : "border-border text-text hover:border-cyan/30 hover:bg-white/[0.03] disabled:text-text-dim"
      } disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
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

async function mutateJson<T>(url: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
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

export function ActionsScreen() {
  const [incidents, setIncidents] = useState<IncidentResponse | null>(null);
  const [approvals, setApprovals] = useState<ApprovalResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse | null>(null);
  const [activeRuns, setActiveRuns] = useState<ActiveRunsResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>({ loading: true, error: null });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setRequestState((current) => ({ loading: current.error != null || current.loading, error: null }));
    try {
      const [incidentData, approvalData, taskData, runData, anomalyData] = await Promise.all([
        fetchJson<IncidentResponse>("/api/incidents?limit=6"),
        fetchJson<ApprovalResponse>("/api/tools/approvals?status=pending&limit=6"),
        fetchJson<TaskResponse>("/api/tools/tasks"),
        fetchJson<ActiveRunsResponse>("/api/active-runs"),
        fetchJson<AnomalyResponse>("/api/dashboard/anomalies?limit=6&unacknowledged=true"),
      ]);
      setIncidents(incidentData);
      setApprovals(approvalData);
      setTasks(taskData);
      setActiveRuns(runData);
      setAnomalies(anomalyData);
      setRequestState({ loading: false, error: null });
    } catch (error) {
      setRequestState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load action queues",
      });
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const criticalIncidents = useMemo(
    () => (incidents?.incidents ?? []).filter((incident) => ["P1", "P2"].includes(incident.severity)),
    [incidents]
  );
  const openTasks = useMemo(
    () => (tasks?.items ?? []).filter((task) => task.status !== "done").slice(0, 6),
    [tasks]
  );
  const liveRuns = useMemo(
    () => (activeRuns?.runs ?? []).filter((run) => ["running", "paused"].includes(run.status)).slice(0, 6),
    [activeRuns]
  );
  const pendingApprovals = approvals?.items ?? [];
  const unresolvedAnomalies = anomalies?.anomalies ?? [];

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>, successMessage: string) => {
      setBusyKey(key);
      try {
        await action();
        toast.success(successMessage);
        await loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      } finally {
        setBusyKey((current) => (current === key ? null : current));
      }
    },
    [loadData]
  );

  if (requestState.loading && !incidents && !approvals && !tasks && !activeRuns && !anomalies) {
    return <LoadingState label="Loading action queues" />;
  }

  if (requestState.error && !incidents && !approvals && !tasks && !activeRuns && !anomalies) {
    return <ErrorState error={requestState.error} />;
  }

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Mission control"
        title="Actions"
        subtitle="Drive the operational queue from one screen: triage incidents, clear approvals, advance tasks, control live runs, and acknowledge anomalies."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/incidents"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <AlertTriangle className="h-4 w-4" />
              Incidents
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Open incidents" value={String(incidents?.stats.open_count ?? 0)} accent="text-red" sublabel="Operationally active" />
        <StatCard label="Critical incidents" value={String(incidents?.stats.critical_count ?? 0)} accent="text-amber" sublabel="P1 and P2 queue" />
        <StatCard label="Pending approvals" value={String(approvals?.pendingCount ?? 0)} accent="text-cyan" sublabel="Awaiting review" />
        <StatCard label="Open tasks" value={String(openTasks.length)} accent="text-purple" sublabel="Todo or in progress" />
        <StatCard label="Live runs" value={String(liveRuns.length)} accent="text-green" sublabel="Running or paused" />
      </div>

      {requestState.error ? <ErrorState error={requestState.error} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionTitle title="Incident triage" note="Highest priority first" bar />
          <div className="space-y-3">
            {criticalIncidents.length === 0 ? (
              <p className="text-sm text-text-dim">No critical incidents need action right now.</p>
            ) : (
              criticalIncidents.map((incident) => {
                const nextStatus = INCIDENT_NEXT_STATUS[incident.status];
                const busy = busyKey === `incident:${incident.id}`;
                return (
                  <div key={incident.id} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={severityTone(incident.severity)}>{incident.severity}</Badge>
                          <Badge tone={statusTone(incident.status)}>{incident.status.replaceAll("_", " ")}</Badge>
                          {incident.sla_breached ? <Badge tone="border-red/40 bg-red/10 text-red">SLA breached</Badge> : null}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text">{incident.title}</p>
                          <p className="mt-1 text-xs text-text-dim">
                            {incident.assigned_to || "Unassigned"} · {incident.update_count} updates · opened {timeAgo(incident.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {nextStatus ? (
                          <ActionButton
                            label={`Move to ${nextStatus.replaceAll("_", " ")}`}
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                `incident:${incident.id}`,
                                async () => {
                                  await mutateJson(`/api/incidents/${incident.id}`, "PATCH", { status: nextStatus });
                                },
                                `Incident moved to ${nextStatus}`
                              )
                            }
                          />
                        ) : null}
                        <Link
                          href={`/incidents?id=${incident.id}`}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text transition hover:border-cyan/30 hover:bg-white/[0.03]"
                        >
                          Open details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Anomaly acknowledgements" note="Unacknowledged alerts" bar />
          <div className="space-y-3">
            {unresolvedAnomalies.length === 0 ? (
              <p className="text-sm text-text-dim">No anomaly alerts need acknowledgement.</p>
            ) : (
              unresolvedAnomalies.map((anomaly) => {
                const busy = busyKey === `anomaly:${anomaly.id}`;
                return (
                  <div key={anomaly.id} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(anomaly.level)}>{anomaly.level}</Badge>
                          <Badge tone="border-purple/30 bg-purple/10 text-purple">{anomaly.anomaly_type.replaceAll("_", " ")}</Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text">{anomaly.agent_name}</p>
                        <p className="mt-1 text-xs text-text-dim">
                          {anomaly.multiplier.toFixed(1)}x baseline · {timeAgo(anomaly.created_at)}
                        </p>
                      </div>
                      <ActionButton
                        label="Acknowledge"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            `anomaly:${anomaly.id}`,
                            async () => {
                              await mutateJson("/api/dashboard/anomalies", "PATCH", { id: anomaly.id });
                            },
                            "Anomaly acknowledged"
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Approvals queue" note="Pending reviews" bar />
          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-text-dim">No pending approvals in the queue.</p>
            ) : (
              pendingApprovals.map((approval) => {
                const busy = busyKey === `approval:${approval.id}`;
                return (
                  <div key={approval.id} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(approval.status)}>{approval.status}</Badge>
                          <Badge tone={severityTone(approval.priority.toUpperCase())}>{approval.priority}</Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text">{approval.title}</p>
                        <p className="mt-1 text-xs text-text-dim">
                          {approval.agent_name || approval.agent_id} · created {timeAgo(approval.created_at)}
                          {approval.expires_at ? ` · expires ${timeAgo(approval.expires_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          label="Approve"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `approval:${approval.id}`,
                              async () => {
                                await mutateJson(`/api/tools/approvals/${approval.id}`, "PATCH", { status: "approved" });
                              },
                              "Approval approved"
                            )
                          }
                        />
                        <ActionButton
                          label="Reject"
                          tone="danger"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `approval:${approval.id}`,
                              async () => {
                                await mutateJson(`/api/tools/approvals/${approval.id}`, "PATCH", { status: "rejected" });
                              },
                              "Approval rejected"
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Task flow" note="Advance work without leaving the queue" bar />
          <div className="space-y-3">
            {openTasks.length === 0 ? (
              <p className="text-sm text-text-dim">No open tasks require action.</p>
            ) : (
              openTasks.map((task) => {
                const nextStatus = TASK_NEXT_STATUS[task.status];
                const busy = busyKey === `task:${task.id}`;
                return (
                  <div key={task.id} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(task.status)}>{task.status.replaceAll("_", " ")}</Badge>
                          <Badge tone={severityTone(task.priority)}>{task.priority}</Badge>
                          {task.category ? <Badge tone="border-border bg-bg-card text-text-dim">{task.category}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text">{task.title}</p>
                        <p className="mt-1 text-xs text-text-dim">
                          {task.assignee} · updated {timeAgo(task.updated_at)}{task.due_date ? ` · due ${timeAgo(task.due_date)}` : ""}
                        </p>
                      </div>
                      {nextStatus ? (
                        <ActionButton
                          label={`Mark ${nextStatus.replaceAll("_", " ")}`}
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `task:${task.id}`,
                              async () => {
                                await mutateJson(`/api/tools/tasks/${task.id}`, "PATCH", { status: nextStatus });
                              },
                              `Task moved to ${nextStatus}`
                            )
                          }
                        />
                      ) : (
                        <Badge tone="border-green/30 bg-green/10 text-green">Done</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Live runtime controls" note="Running and paused sessions" bar />
        <div className="space-y-3">
          {liveRuns.length === 0 ? (
            <p className="text-sm text-text-dim">No live runs require intervention.</p>
          ) : (
            liveRuns.map((run) => {
              const runId = run.id ?? run.run_id;
              const busy = busyKey === `run:${runId}`;
              const activity = activityStatus(run.started_at);
              const isManagedRun = typeof run.id === "number";
              return (
                <div key={String(runId)} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                        <Badge tone="border-border bg-bg-card text-text-dim">{run.model || "unknown model"}</Badge>
                        {run.is_main_agent ? <Badge tone="border-cyan/30 bg-cyan/10 text-cyan">Main agent</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-text">{run.agent_name || run.run_label || run.agent_id}</p>
                      <p className="mt-1 text-xs text-text-dim">
                        {run.current_action || run.task_summary || "Processing"} · started {timeAgo(run.started_at)}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-text-dim">
                        <span className={`h-2 w-2 rounded-full ${activity.dot}`} />
                        <span className={activity.tone}>{activity.label}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isManagedRun && run.status === "running" ? (
                        <ActionButton
                          label="Pause"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `run:${runId}`,
                              async () => {
                                await mutateJson(`/api/tools/agents-live/${runId}/pause`, "POST");
                              },
                              "Run paused"
                            )
                          }
                        />
                      ) : null}
                      {isManagedRun && run.status === "paused" ? (
                        <ActionButton
                          label="Resume"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `run:${runId}`,
                              async () => {
                                await mutateJson(`/api/tools/agents-live/${runId}/resume`, "POST");
                              },
                              "Run resumed"
                            )
                          }
                        />
                      ) : null}
                      {isManagedRun ? (
                        <ActionButton
                          label="Kill"
                          tone="danger"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `run:${runId}`,
                              async () => {
                                await mutateJson(`/api/tools/agents-live/${runId}/kill`, "POST", { reason: "Stopped from Actions queue" });
                              },
                              "Run stopped"
                            )
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <QuickLink href="/incidents" label="Incidents" note="Deep incident workflow" icon={<ShieldAlert className="h-4 w-4" />} />
        <QuickLink href="/tools/approvals" label="Approvals" note="Full approval workspace" icon={<CheckCircle2 className="h-4 w-4" />} />
        <QuickLink href="/tools/tasks" label="Tasks" note="Kanban and planning" icon={<SquareCheckBig className="h-4 w-4" />} />
        <QuickLink href="/tools/agents-live" label="Live agents" note="Runtime controls and history" icon={<Bot className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function QuickLink({ href, label, note, icon }: { href: string; label: string; note: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-border bg-bg-card p-4 transition hover:border-cyan/30 hover:bg-white/[0.03]"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xs leading-6 text-text-dim">{note}</p>
    </Link>
  );
}
