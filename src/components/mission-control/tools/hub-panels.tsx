"use client";

import Link from "next/link";
import { Card, ErrorState, SectionTitle } from "../dashboard";
import { Badge, EmptyState, type ToolTone } from "./shared";

type ApprovalSummary = {
  id: number;
  title: string;
  content: string;
  priority: string;
  created_at: string;
};

type TaskSummary = {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
};

type RunSummary = {
  id: number;
  run_label: string;
  model: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  task_summary: string | null;
  error_message: string | null;
};

type ScheduleSummary = {
  id: number;
  item_type: string;
  status: string;
  scheduled_at: string;
  title: string;
  description: string | null;
};

type CommandSummary = {
  id: number;
  command: string;
  response: string | null;
  status: string;
  created_at: string;
};

type OverviewLinkItem = {
  label: string;
  href: string;
  description: string;
  tone: ToolTone;
};

type OverviewGroup = {
  title: string;
  note: string;
  items: OverviewLinkItem[];
};

export function PriorityQueuePanel({
  approvals,
  tasks,
  now,
  timeAgo,
  formatShortDate,
  priorityTone,
}: {
  approvals: ApprovalSummary[];
  tasks: TaskSummary[];
  now: number;
  timeAgo: (value: string | null | undefined) => string;
  formatShortDate: (value: string | null | undefined) => string;
  priorityTone: (priority: string) => ToolTone;
}) {
  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title="Priority queue" note="What operators should look at first." />
      <div className="space-y-3">
        {approvals.map((item) => (
          <Link key={`approval-${item.id}`} href="/tools/approvals" className="block rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">Approval</Badge>
                <Badge tone={item.priority === "urgent" ? "red" : item.priority === "low" ? "slate" : "cyan"}>{item.priority}</Badge>
              </div>
              <span className="text-xs text-text-dim">{timeAgo(item.created_at)}</span>
            </div>
            <div className="text-sm font-semibold text-text">{item.title}</div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-dim">{item.content}</p>
          </Link>
        ))}

        {tasks.map((item) => (
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

        {!approvals.length && !tasks.length ? <EmptyState label="No approval or task pressure detected right now." /> : null}
      </div>
    </Card>
  );
}

export function ExecutionMonitorPanel({
  runs,
  schedule,
  now,
  runTone,
  elapsedLabel,
  formatDate,
}: {
  runs: RunSummary[];
  schedule: ScheduleSummary[];
  now: number;
  runTone: (status: string) => ToolTone;
  elapsedLabel: (startedAt: string, completedAt: string | null, now: number) => string;
  formatDate: (value: string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
}) {
  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title="Execution monitor" note="Live agent activity and immediate schedule context." />
      <div className="space-y-3">
        {runs.map((run) => (
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

        {schedule.map((item) => (
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

        {!runs.length && !schedule.length ? <EmptyState label="No active runs or scheduled events in the current window." /> : null}
      </div>
    </Card>
  );
}

export function CommandPulsePanel({
  items,
  failedAgents,
  error,
  timeAgo,
}: {
  items: CommandSummary[];
  failedAgents: number;
  error: string | null;
  timeAgo: (value: string | null | undefined) => string;
}) {
  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title="Command pulse" note="Recent operator-to-agent requests and execution backlog." />
      <div className="grid gap-3 lg:grid-cols-3">
        {items.slice(0, 3).map((entry) => (
          <Link key={`command-${entry.id}`} href="/tools/command" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Badge tone={entry.status === "completed" ? "green" : entry.status === "processing" ? "amber" : "slate"}>{entry.status}</Badge>
              <span className="text-xs text-text-dim">{timeAgo(entry.created_at)}</span>
            </div>
            <div className="line-clamp-2 text-sm font-semibold text-text">{entry.command}</div>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-text-dim">{entry.response ?? "Awaiting response from agent."}</p>
          </Link>
        ))}
        {!items.length ? <EmptyState label="No recent command traffic." /> : null}
      </div>
      {failedAgents > 0 ? <div className="text-sm text-red">{failedAgents} recent sub-agent run(s) reported a failed status and may require follow-up.</div> : null}
      {error ? <ErrorState error={error} /> : null}
    </Card>
  );
}

export function InlineActionsPanel({
  quickActions,
  sendingCommand,
  quickMessage,
  onQuickMessageChange,
  onRefresh,
  onTriggerQuickAction,
  onSubmitQuickMessage,
}: {
  quickActions: string[];
  sendingCommand: boolean;
  quickMessage: string;
  onQuickMessageChange: (value: string) => void;
  onRefresh: () => void;
  onTriggerQuickAction: (command: string) => void;
  onSubmitQuickMessage: () => void;
}) {
  return (
    <Card className="space-y-4 border-border/70 bg-bg-deep/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle title="Inline actions" note="Take the most common operator actions without leaving the landing page." />
        <button
          type="button"
          onClick={onRefresh}
          className="min-h-11 rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
        >
          Refresh snapshot
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <Link href="/tools/approvals" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
          <Badge tone="green">Review approvals</Badge>
          <p className="mt-3 text-sm leading-6 text-text-dim">Open the moderated queue and clear pending decisions.</p>
        </Link>
        <Link href="/tools/tasks" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
          <Badge tone="amber">Reprioritize tasks</Badge>
          <p className="mt-3 text-sm leading-6 text-text-dim">Move active work, assign focus, and reduce overdue drift.</p>
        </Link>
        <Link href="/tools/agents-live" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
          <Badge tone="cyan">Inspect live agents</Badge>
          <p className="mt-3 text-sm leading-6 text-text-dim">Open active runs, inspect logs, and stop unhealthy executions.</p>
        </Link>
        <Link href="/tools/calendar" className="rounded-[20px] border border-border bg-bg-card/60 p-4 transition hover:border-cyan/30">
          <Badge tone="purple">Check schedule</Badge>
          <p className="mt-3 text-sm leading-6 text-text-dim">Review this week window and drill into upcoming operational events.</p>
        </Link>
      </div>

      <div className="rounded-[24px] border border-border bg-bg-card/50 p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={sendingCommand}
              onClick={() => onTriggerQuickAction(action)}
              className="min-h-11 rounded-full border border-border bg-bg-deep/80 px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <textarea
            rows={1}
            value={quickMessage}
            onChange={(event) => onQuickMessageChange(event.target.value)}
            placeholder="Send a quick operational command"
            className="min-h-11 flex-1 resize-none rounded-2xl border border-border bg-bg-deep/80 px-4 py-3 text-sm text-text outline-none"
          />
          <div className="flex gap-3">
            <Link
              href="/tools/command"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm text-text-dim transition hover:border-cyan/30 hover:text-text"
            >
              Open full command
            </Link>
            <button
              type="button"
              disabled={sendingCommand || !quickMessage.trim()}
              onClick={onSubmitQuickMessage}
              className="min-h-11 rounded-2xl border border-cyan/30 bg-cyan px-5 text-sm font-semibold text-bg-deep disabled:opacity-50"
            >
              {sendingCommand ? "Sending..." : "Send now"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PackageOverviewGroupsPanel({ groups }: { groups: OverviewGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
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
  );
}

export function PackageCoveragePanel({
  domainPackCount,
  totalDomainTools,
  integrationCount,
  skillEntryCount,
  algorithmCount,
  builtinSkillCount,
  sandboxPolicyCount,
  gpuImageCount,
}: {
  domainPackCount: number;
  totalDomainTools: number;
  integrationCount: number;
  skillEntryCount: number;
  algorithmCount: number;
  builtinSkillCount: number;
  sandboxPolicyCount: number;
  gpuImageCount: number;
}) {
  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title="Coverage" note="Current package surface area" />
      <ul className="space-y-2 text-sm leading-6 text-text-dim">
        <li>• {domainPackCount} domain packs with {totalDomainTools} packaged helper tools.</li>
        <li>• {integrationCount} integration definitions with additive rollout guidance.</li>
        <li>• {skillEntryCount} skill registry entries linked back to domains and integrations.</li>
        <li>• {algorithmCount} ML algorithms exposed as a browse-only catalog.</li>
        <li>• {builtinSkillCount} packaged runtime skills exposed without wiring risky live execution.</li>
        <li>• {sandboxPolicyCount} sandbox policies and {gpuImageCount} GPU image presets documented for safe rollout.</li>
      </ul>
    </Card>
  );
}

export function PackageRecommendedFlowPanel() {
  return (
    <Card className="space-y-3 border-border/70 bg-bg-deep/40">
      <SectionTitle title="Recommended flow" note="Use packages without replacing existing features" />
      <ul className="space-y-2 text-sm leading-6 text-text-dim">
        <li>• Discover reusable patterns in `Domains`, `Skills`, and `ML` first.</li>
        <li>• Validate connector assumptions in `Integrations` and `Docs` before rollout.</li>
        <li>• Execute through `AI Chat`, `MCP`, approvals, and existing workflows.</li>
      </ul>
    </Card>
  );
}

export type { OverviewGroup };
