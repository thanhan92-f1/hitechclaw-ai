"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCcw, ServerCrash } from "lucide-react";
import { activityStatus, formatCompact, getAuthHeaders, getOverviewMetrics, redirectToLogin, timeAgo, useOverviewData } from "./api";
import { Card, ErrorState, LoadingState, SectionTitle, ShellHeader, StatCard } from "./dashboard";
import { HealthGauge, MetricTooltip, StatusSummary } from "./dashboard-clarity";
import { computeHealthScore } from "@/lib/health-score";

type HealthCheck = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  detail?: unknown;
};

type HealthResponse = {
  status: "healthy" | "degraded";
  checks?: Record<string, HealthCheck>;
  system?: {
    uptime: number;
    memory: {
      total_mb: number;
      free_mb: number;
      used_pct: number;
    };
    load_avg: number[];
    node_version: string;
  };
  timestamp?: string;
  version?: string;
};

function formatUptime(seconds: number | undefined) {
  if (!seconds || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCheckLabel(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractTimestamp(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const options = [record.last_event, record.last_metric, record.last_audit];
  for (const option of options) {
    if (typeof option === "string" && option) return option;
  }
  return null;
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

export function HealthScreen() {
  const { data: overview, error: overviewError, loading: overviewLoading } = useOverviewData();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setHealthLoading((current) => current || health == null);
    setHealthError(null);
    try {
      const payload = await fetchJson<HealthResponse>("/api/health");
      setHealth(payload);
      setHealthLoading(false);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Failed to load health checks");
      setHealthLoading(false);
    }
  }, [health]);

  useEffect(() => {
    void loadHealth();
    const timer = window.setInterval(() => {
      void loadHealth();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadHealth]);

  const metrics = getOverviewMetrics(overview);
  const checks = health?.checks ?? {};
  const checkEntries = Object.entries(checks);
  const passingChecks = checkEntries.filter(([, check]) => check.ok).length;
  const failingChecks = checkEntries.length - passingChecks;
  const freshnessTimestamp = useMemo(() => {
    const freshnessCheck = checks.data_freshness;
    return extractTimestamp(freshnessCheck?.detail) ?? health?.timestamp ?? overview?.timestamp ?? null;
  }, [checks, health?.timestamp, overview?.timestamp]);

  const healthScore = useMemo(
    () =>
      computeHealthScore({
        totalAgents: metrics.totalAgents,
        activeAgents: metrics.activeAgents,
        highestThreat: "none",
        threatCount: 0,
        monthSpend: 0,
        budgetLimit: 0,
        totalNodes: Math.max(checkEntries.length, 1),
        onlineNodes: passingChecks,
      }),
    [checkEntries.length, metrics.activeAgents, metrics.totalAgents, passingChecks]
  );

  const recommendations = useMemo(() => {
    const items: Array<{ title: string; note: string; tone: "good" | "warn" }> = [];
    if (failingChecks > 0) {
      items.push({
        title: `${failingChecks} backend checks need attention`,
        note: "Review failing dependencies and restore telemetry tables before they affect dashboards.",
        tone: "warn",
      });
    } else {
      items.push({
        title: "All backend checks are passing",
        note: "Core database, extension, and telemetry dependencies are responding normally.",
        tone: "good",
      });
    }

    if (metrics.totalAgents > 0 && metrics.activeAgents < metrics.totalAgents) {
      items.push({
        title: `${metrics.totalAgents - metrics.activeAgents} agents are not live`,
        note: "Inspect inactive agents and confirm expected idle behavior versus missed heartbeats.",
        tone: "warn",
      });
    } else {
      items.push({
        title: "Agent activity is within target",
        note: "Live agent participation is aligned with the current registered fleet.",
        tone: "good",
      });
    }

    return items;
  }, [failingChecks, metrics.activeAgents, metrics.totalAgents]);

  if (overviewLoading && !overview && healthLoading && !health) {
    return <LoadingState label="Loading health overview" />;
  }

  if (overviewError && !overview && healthError && !health) {
    return <ErrorState error={`${overviewError}; ${healthError}`} />;
  }

  return (
    <div className="space-y-5 pb-24">
      <ShellHeader
        eyebrow="Reliability"
        title="Health"
        subtitle="Track backend readiness, data freshness, and runtime capacity from a first-class operations screen instead of the old placeholder training view."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/infrastructure"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <Database className="h-4 w-4" />
              Infrastructure
            </Link>
            <button
              type="button"
              onClick={() => void loadHealth()}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {overviewError ? <ErrorState error={overviewError} /> : null}
      {healthError ? <ErrorState error={healthError} /> : null}

      <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center">
        <div>
          <HealthGauge score={healthScore.score} color={healthScore.color} breakdown={healthScore.breakdown} size="lg" />
        </div>
        <div className="min-w-0 flex-1">
          <StatusSummary
            totalAgents={metrics.totalAgents}
            activeAgents={metrics.activeAgents}
            eventsToday={metrics.events24h}
            threatCount={failingChecks}
            serverCount={checkEntries.length || undefined}
          />
          <p className="mt-3 text-sm text-text-dim">
            Last telemetry signal: <span className="text-text">{freshnessTimestamp ? timeAgo(freshnessTimestamp) : "Unknown"}</span>
            {health?.version ? <span> · version <span className="text-text">{health.version}</span></span> : null}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Checks passing" value={String(passingChecks)} accent="text-green" sublabel={`${checkEntries.length} total checks`} />
        <StatCard label="Checks failing" value={String(Math.max(failingChecks, 0))} accent="text-red" sublabel="Needs investigation" />
        <StatCard label="Live agents" value={String(metrics.activeAgents)} accent="text-cyan" sublabel={`${metrics.totalAgents} registered`} />
        <StatCard label="Events 24H" value={formatCompact(metrics.events24h)} accent="text-purple" sublabel="Telemetry throughput" />
        <StatCard label="System uptime" value={formatUptime(health?.system?.uptime)} accent="text-amber" sublabel="Current process lifetime" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <SectionTitle title="Dependency checks" note="Live backend readiness" bar />
          <div className="space-y-3">
            {checkEntries.length === 0 ? (
              <p className="text-sm text-text-dim">No health checks returned yet.</p>
            ) : (
              checkEntries.map(([key, check]) => {
                const status = check.ok ? "Live" : "Error";
                return (
                  <div key={key} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {check.ok ? <CheckCircle2 className="h-4 w-4 text-green" /> : <ServerCrash className="h-4 w-4 text-red" />}
                          <p className="text-sm font-semibold text-text">{formatCheckLabel(key)}</p>
                          <MetricTooltip text={check.error ?? "Measured from the live health endpoint."} />
                        </div>
                        <p className="mt-1 text-xs text-text-dim">
                          {check.ok ? "Responding normally" : check.error || "Check failed"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${check.ok ? "text-green" : "text-red"}`}>{status}</div>
                        <div className="text-[11px] text-text-dim">{typeof check.latencyMs === "number" ? `${check.latencyMs} ms` : "No timing"}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="System runtime" note="Host process snapshot" bar />
          <div className="space-y-3">
            <SystemRow label="Node version" value={health?.system?.node_version ?? "Unknown"} />
            <SystemRow label="Memory used" value={health?.system ? `${health.system.memory.used_pct}%` : "Unknown"} />
            <SystemRow label="Free memory" value={health?.system ? `${health.system.memory.free_mb} MB` : "Unknown"} />
            <SystemRow
              label="Load average"
              value={health?.system?.load_avg?.length ? health.system.load_avg.join(" / ") : "Unknown"}
            />
            <SystemRow label="Process uptime" value={formatUptime(health?.system?.uptime)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Actionable recommendations" note="Prioritized from current state" bar />
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                <div className="flex items-start gap-3">
                  {item.tone === "good" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-text">{item.title}</p>
                    <p className="mt-1 text-xs leading-6 text-text-dim">{item.note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Agent freshness" note="Based on overview feed" bar />
          <div className="space-y-3">
            {(overview?.agents ?? []).slice(0, 6).map((agent) => {
              const status = activityStatus(agent.last_active);
              return (
                <div key={agent.id} className="rounded-2xl border border-border bg-bg-deep/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{agent.name}</p>
                      <p className="mt-1 text-xs text-text-dim">{agent.id} · last active {timeAgo(agent.last_active)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                      <span className={status.tone}>{status.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {(overview?.agents ?? []).length === 0 ? (
              <p className="text-sm text-text-dim">No agents are registered yet.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickLink href="/infrastructure" label="Infrastructure" note="Inspect topology and node resources" icon={Activity} />
        <QuickLink href="/traces" label="Traces" note="Check runtime spans and execution timing" icon={Database} />
        <QuickLink href="/actions" label="Actions" note="Respond to incidents and runtime issues" icon={AlertTriangle} />
      </div>
    </div>
  );
}

function SystemRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-bg-deep/70 px-4 py-3 text-sm">
      <span className="text-text-dim">{label}</span>
      <span className="font-semibold text-text">{value}</span>
    </div>
  );
}

function QuickLink({ href, label, note, icon: Icon }: { href: string; label: string; note: string; icon: typeof Activity }) {
  return (
    <Link href={href} className="rounded-[22px] border border-border bg-bg-card p-4 transition hover:border-cyan/30 hover:bg-white/[0.03]">
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xs leading-6 text-text-dim">{note}</p>
    </Link>
  );
}
