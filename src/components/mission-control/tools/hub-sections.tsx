import Link from "next/link";
import { Card, SectionTitle } from "../dashboard";
import { Badge, type ToolTone } from "./shared";

export const toolLinks = [
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

export const toolsHubQuickActions = ["Status", "Briefing", "Priority list", "Escalate blockers"];

export const packageMenuSections: Array<{
  title: string;
  note: string;
  items: Array<{ href: string; label: string; description: string; tone: ToolTone }>;
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

export const packageWorkspaceItems = [
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
] as const;

export type PackageWorkspaceItemId = (typeof packageWorkspaceItems)[number]["id"];

export const packageOverviewGroups: Array<{
  title: string;
  note: string;
  items: Array<{ label: string; href: string; description: string; tone: ToolTone }>;
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

export const toolsControlLanes: Array<{
  title: string;
  href: string;
  tone: ToolTone;
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

export const toolsOperatingRhythm: Array<{
  step: string;
  title: string;
  description: string;
  href: string;
  tone: ToolTone;
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

export function ToolsControlCenter() {
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

export function PackageWorkspaceNav({
  current,
  title = "Package Workspace",
  note = "Unified navigation for package-driven functions.",
}: {
  current: PackageWorkspaceItemId;
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

export function PackageActionBar({
  title = "Action bar",
  note = "Move across related package functions.",
  items,
}: {
  title?: string;
  note?: string;
  items: Array<{ href: string; label: string; tone: ToolTone }>;
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
