// src/components/mission-control/workflows.tsx
// Phase 5 — Visual Workflow Builder page
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CardEntranceWrapper, SkeletonCard, StatCountUp } from "./charts";
import { ShellHeader } from "./dashboard";
import { EmptyState, WorkflowsEmpty } from "./empty-states";
import { SectionDescription } from "./dashboard-clarity";
import {
  Workflow as WorkflowIcon,
  HeartPulse,
  ShieldAlert,
  BarChart3,
  Activity,
  Wallet,
  Bell,
  LayoutGrid,
  ChevronRight,
  Info,
} from "lucide-react";
import { WorkflowBuilder, type WorkflowDefinition } from "./workflow-builder";
import { toast } from "sonner";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// ── Workflow Templates ───────────────────────────────────────────────────────

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  trigger_type: "cron" | "manual";
  trigger_config: { cron_expression?: string } | null;
  definition: WorkflowDefinition;
  customizationHints: string[];
  packageResources?: Array<{
    href: string;
    label: string;
  }>;
}

interface PackageWorkflowKit {
  id: string;
  title: string;
  description: string;
  packageHref: string;
  packageLabel: string;
  workflowHint: string;
  tone: string;
}

const PACKAGE_WORKFLOW_KITS: PackageWorkflowKit[] = [
  {
    id: "builtin-skills",
    title: "Built-in Skill Rollout",
    description: "Review packaged runtime handlers, config keys, and rollout notes before activating project workflows.",
    packageHref: "/tools/builtin-skills",
    packageLabel: "Built-in Skills",
    workflowHint: "Use packaged handler metadata to define safe workflow inputs, approvals, and docs.",
    tone: "#06b6d4",
  },
  {
    id: "sandbox",
    title: "Sandbox Governance",
    description: "Validate policy templates, host allow-lists, and GPU presets before connecting ML or connector execution.",
    packageHref: "/tools/sandbox",
    packageLabel: "Sandbox Lab",
    workflowHint: "Pair workflow nodes with the least-permissive policy and documented integration mapping.",
    tone: "#64748b",
  },
  {
    id: "ml",
    title: "ML Review Loop",
    description: "Use the catalog and sandbox presets together to plan training, inference, and approval checkpoints.",
    packageHref: "/tools/ml",
    packageLabel: "ML Catalog",
    workflowHint: "Start with browse-only evaluation, then layer approval and operational notifications.",
    tone: "#f59e0b",
  },
];

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "health-check",
    name: "Health Check",
    description: "Monitor platform health every 5 minutes and alert when the stack reports a degraded state.",
    icon: HeartPulse,
    color: "#00D47E",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/5 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 5 Minutes", cron_expression: "*/5 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Check Platform Health", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/health", headers: {}, timeout: 15000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Platform Healthy?", field: "body.status", operator: "eq", value: "healthy" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Alert: Platform Degraded", channel: "telegram", message: "Platform health check failed. Latest status: {{body}}. Review health and infrastructure dashboards." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "false" },
      ],
    },
    customizationHints: ["Adjust check frequency in the cron trigger", "Keep the health endpoint internal so bearer auth is injected automatically", "Customize the degradation alert message and escalation channel"],
  },
  {
    id: "threat-auto-response",
    name: "Threat Auto-Response",
    description: "Automatically pause an agent when critical threats are detected in the recent security overview.",
    icon: ShieldAlert,
    color: "#ef4444",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/5 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Check Every 5 Min", cron_expression: "*/5 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Get Critical Threats", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/security/overview?range=24h&severity=critical", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Critical Threats Found?", field: "body.events.length", operator: "gt", value: "0" } },
        { id: "4", type: "http-request", position: { x: 80, y: 500 }, data: { label: "Pause Agent", method: "POST", url: "{{HITECHCLAW_AI_BASE_URL}}/api/tools/agents-live/default/pause", headers: {}, timeout: 10000 } },
        { id: "5", type: "notify", position: { x: 80, y: 660 }, data: { label: "Alert: Agent Paused", channel: "telegram", message: "Critical threat detected. Agent auto-paused. Review threats in ThreatGuard." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
        { id: "e4-5", source: "4", target: "5" },
      ],
    },
    customizationHints: ["Set the agent ID to pause in the HTTP Request node", "Change the severity query parameter if you want high or medium threat review", "Customize the notification message and approval flow before using this in production"],
  },
  {
    id: "daily-cost-report",
    name: "Daily Cost Report",
    description: "Get a daily summary of agent spending sent to your preferred channel.",
    icon: BarChart3,
    color: "#3b82f6",
    trigger_type: "cron",
    trigger_config: { cron_expression: "0 6 * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Daily at 8am SAST", cron_expression: "0 6 * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Get Cost Summary", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/costs/overview", headers: {}, timeout: 10000 } },
        { id: "3", type: "notify", position: { x: 250, y: 340 }, data: { label: "Send Cost Report", channel: "telegram", message: "Daily Cost Report\nTotal today: {{body}}\nCheck the Costs page for a full breakdown." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
      ],
    },
    customizationHints: ["Change report time in the cron trigger", "Switch notification channel", "Customize the report message format"],
  },
  {
    id: "client-heartbeat",
    name: "Live Agent Heartbeat",
    description: "Alert operators when no live agent runs are detected during the scheduled review window.",
    icon: Activity,
    color: "#f59e0b",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/30 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 30 Minutes", cron_expression: "*/30 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Check Live Runs", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/active-runs", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Any Live Runs?", field: "body.count", operator: "eq", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Alert: No Live Runs", channel: "telegram", message: "No live agent runs were detected in the last review window. Check active runs, agents, and infrastructure telemetry." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Adjust the review cadence to match your operational coverage", "Append agent_id to the active-runs API call for a scoped heartbeat", "Change notification routing for tenant-specific on-call teams"],
  },
  {
    id: "budget-alert",
    name: "Budget Alert",
    description: "Review configured budgets hourly and notify operators when tracked budget records are present for manual follow-up.",
    icon: Wallet,
    color: "#00D47E",
    trigger_type: "cron",
    trigger_config: { cron_expression: "0 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Hourly", cron_expression: "0 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Get Cost Summary", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/costs/overview", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Budgets Configured?", field: "body.budgets.length", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Budget Review Needed", channel: "telegram", message: "Budget records are configured and should be reviewed with the latest cost overview. Confirm thresholds and current spend before pausing agents. Summary: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Use tenant_id in the request URL for customer-specific budget checks", "Pair this with Cost Anomaly Watch for stronger automated escalation", "Customize the alert copy with your current budget governance process"],
  },
  {
    id: "new-threat-alert",
    name: "High Threat Alert",
    description: "Send immediate notification when high-severity threats are detected in the recent security window.",
    icon: Bell,
    color: "#f97316",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/5 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 5 Minutes", cron_expression: "*/5 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Get High Threats", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/security/overview?range=24h&severity=high", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "High Threats Found?", field: "body.events.length", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Threat Alert", channel: "telegram", message: "High-severity threats were detected in the recent review window. Review the security overview immediately." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Switch severity=high to severity=critical for stricter paging", "Adjust polling frequency based on alert fatigue tolerance", "Route alerts to different channels per severity tier"],
    packageResources: [
      { href: "/tools/builtin-skills", label: "Built-in Skills" },
      { href: "/tools/sandbox", label: "Sandbox Lab" },
    ],
  },
  {
    id: "docs-library-digest",
    name: "Docs Library Digest",
    description: "Send a daily digest of indexed project documentation so operators can review package guidance before rollout.",
    icon: Info,
    color: "#8b5cf6",
    trigger_type: "cron",
    trigger_config: { cron_expression: "30 7 * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Daily at 7:30", cron_expression: "30 7 * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Docs Library", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/tools/docs/library?limit=12", headers: {}, timeout: 10000 } },
        { id: "3", type: "notify", position: { x: 250, y: 340 }, data: { label: "Send Docs Digest", channel: "telegram", message: "Daily docs digest ready. Review indexed guidance from the repository docs library and align upcoming workflow changes with the latest package notes. Response: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
      ],
    },
    customizationHints: ["Filter the docs library by category or search terms in the request URL", "Switch the digest channel from Telegram to log-only during staging", "Pair the digest with Built-in Skills guidance before enabling production workflows"],
    packageResources: [
      { href: "/tools/docs", label: "Docs Tools" },
      { href: "/tools/builtin-skills", label: "Built-in Skills" },
    ],
  },
  {
    id: "infra-self-report-review",
    name: "Infra Self-Report Review",
    description: "Submit a controlled infrastructure self-report payload, then alert operators when the node reports a degraded status.",
    icon: HeartPulse,
    color: "#22c55e",
    trigger_type: "manual",
    trigger_config: null,
    definition: {
      nodes: [
        { id: "1", type: "manual-trigger", position: { x: 250, y: 30 }, data: { label: "Run Review" } },
        {
          id: "2",
          type: "http-request",
          position: { x: 250, y: 180 },
          data: {
            label: "Submit Infra Report",
            method: "POST",
            url: "{{HITECHCLAW_AI_BASE_URL}}/api/infra/report",
            headers: {},
            timeout: 10000,
            body: '{"nodeId":"replace-with-node-id","cpu":92,"memUsed":15360,"memTotal":16384,"diskUsed":920,"diskTotal":1000,"dockerRunning":true,"gpuUtil":78,"services":[{"name":"gateway","status":"running"},{"name":"scheduler","status":"running"}]}'
          }
        },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Report Degraded?", field: "body.status", operator: "eq", value: "degraded" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Infra Risk", channel: "telegram", message: "Infrastructure self-report returned degraded status. Review the affected node, confirm service health, and inspect infrastructure dashboards. Response: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Replace the placeholder node ID before saving the template", "Tune CPU, memory, and disk values to match your real node payload format", "Keep this template manual until the node-side cron sender has been verified in staging"],
    packageResources: [
      { href: "/infrastructure", label: "Infrastructure" },
      { href: "/tools/sandbox", label: "Sandbox Lab" },
    ],
  },
  {
    id: "security-daily-brief",
    name: "Security Daily Brief",
    description: "Review the last 24 hours of security posture and escalate only when critical findings are present.",
    icon: ShieldAlert,
    color: "#dc2626",
    trigger_type: "cron",
    trigger_config: { cron_expression: "0 8 * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Daily at 8:00", cron_expression: "0 8 * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Critical Overview", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/security/overview?range=24h&severity=critical", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Critical Findings Present?", field: "body.events.length", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Critical Brief", channel: "telegram", message: "Critical findings detected in the last 24 hours. Review the security overview and validate containment or sandbox policy changes immediately." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Expand the range to 7d for weekly posture reviews", "Change the condition keyword if you want to escalate high severity findings too", "Link the notification runbook to Sandbox Lab when containment depends on policy changes"],
    packageResources: [
      { href: "/tools/sandbox", label: "Sandbox Lab" },
      { href: "/tools/builtin-skills", label: "Built-in Skills" },
    ],
  },
  {
    id: "cost-anomaly-watch",
    name: "Cost Anomaly Watch",
    description: "Check for agent spend spikes and route operators to the right package catalogs before scaling usage.",
    icon: Wallet,
    color: "#14b8a6",
    trigger_type: "cron",
    trigger_config: { cron_expression: "0 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Hourly Review", cron_expression: "0 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Cost Overview", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/costs/overview?range=7d", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Anomalies Detected?", field: "body.agent_anomalies.length", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Spend Spike", channel: "telegram", message: "Cost anomaly detected. Review agent spikes, then confirm model and sandbox choices before increasing throughput. Summary: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Narrow the tenant scope in the request URL for customer-specific monitoring", "Adjust the cadence if hourly checks are too noisy", "Use ML Catalog and Sandbox Lab together before approving higher-cost runtime changes"],
    packageResources: [
      { href: "/tools/ml", label: "ML Catalog" },
      { href: "/tools/sandbox", label: "Sandbox Lab" },
    ],
  },
  {
    id: "package-readiness-review",
    name: "Package Readiness Review",
    description: "Run a manual pre-release review that checks docs coverage first, then logs a security snapshot for the rollout decision.",
    icon: LayoutGrid,
    color: "#0ea5e9",
    trigger_type: "manual",
    trigger_config: null,
    definition: {
      nodes: [
        { id: "1", type: "manual-trigger", position: { x: 250, y: 30 }, data: { label: "Launch Review" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Docs Inventory", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/tools/docs/library?limit=20", headers: {}, timeout: 10000 } },
        { id: "3", type: "http-request", position: { x: 250, y: 340 }, data: { label: "Fetch Security Snapshot", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/security/overview?range=7d", headers: {}, timeout: 10000 } },
        { id: "4", type: "notify", position: { x: 250, y: 500 }, data: { label: "Publish Readiness Summary", channel: "log", message: "Package readiness review completed. Confirm docs coverage, security posture, and rollout approvals before enabling the next workflow set. Latest snapshot: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4" },
      ],
    },
    customizationHints: ["Keep this manual until your release checklist is stable", "Switch the final notification to Telegram when the review owners are defined", "Open each linked package surface while refining the checklist and approval wording"],
    packageResources: [
      { href: "/tools/docs", label: "Docs Tools" },
      { href: "/tools/builtin-skills", label: "Built-in Skills" },
      { href: "/tools/sandbox", label: "Sandbox Lab" },
    ],
  },
  {
    id: "infra-node-watch",
    name: "Infra Node Watch",
    description: "Review registered infrastructure nodes on a schedule and escalate when any node reports degraded health.",
    icon: HeartPulse,
    color: "#10b981",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/15 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 15 Minutes", cron_expression: "*/15 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Infra Nodes", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/infra/nodes", headers: {}, timeout: 12000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Any Degraded Nodes?", field: "body.nodes.*.status", operator: "eq", value: "degraded" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Node Health", channel: "telegram", message: "Infrastructure review detected a degraded lead node. Inspect /api/infra/nodes and infrastructure dashboards for the latest metrics. Snapshot: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Refine this to specific nodes by extending the API or adding a scoped route", "Use the topology view alongside node metrics before deciding on failover actions", "Keep the alert copy focused on the node roles your operators recognize"],
    packageResources: [
      { href: "/infrastructure", label: "Infrastructure" },
      { href: "/tools/sandbox", label: "Sandbox Lab" },
    ],
  },
  {
    id: "mesh-topology-review",
    name: "Mesh Topology Review",
    description: "Run a scheduled topology review and alert when the generated network mesh has no active edges.",
    icon: Activity,
    color: "#06b6d4",
    trigger_type: "cron",
    trigger_config: { cron_expression: "0 */6 * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 6 Hours", cron_expression: "0 */6 * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Topology Mesh", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/infra/topology", headers: {}, timeout: 12000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "No Mesh Edges?", field: "body.edges.length", operator: "eq", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Mesh Gap", channel: "telegram", message: "Topology review found no active mesh edges. Validate node registration, connectivity, and topology metadata before rollout changes." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Switch this to a manual review if topology data changes only during planned maintenance", "Use the mesh review together with sandbox and ML rollout plans when capacity depends on node connectivity", "Tune the cadence if your infra graph is expensive to inspect frequently"],
    packageResources: [
      { href: "/infrastructure", label: "Infrastructure" },
      { href: "/tools/ml", label: "ML Catalog" },
    ],
  },
  {
    id: "ops-dashboard-review",
    name: "Ops Dashboard Review",
    description: "Summarize daily operational activity and escalate when any agent shows recent threat volume.",
    icon: BarChart3,
    color: "#6366f1",
    trigger_type: "cron",
    trigger_config: { cron_expression: "15 7 * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Daily at 7:15", cron_expression: "15 7 * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Dashboard Overview", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/dashboard/overview", headers: {}, timeout: 12000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Recent Threat Volume?", field: "body.agents.*.threats_30d", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Publish Ops Review", channel: "telegram", message: "Daily ops review found at least one agent with recent threat activity. Review dashboard overview, tenant mix, and recent agent metrics before enabling new automation." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Use tenant-specific dashboard routes later if you want cleaner customer segmentation", "Pair this daily review with Docs Library Digest when rollout decisions depend on both ops and documentation readiness", "Tune the condition to a higher threat count if your baseline noise is non-zero"],
    packageResources: [
      { href: "/analytics", label: "Analytics" },
      { href: "/tools/docs", label: "Docs Tools" },
    ],
  },
  {
    id: "incident-backlog-watch",
    name: "Incident Backlog Watch",
    description: "Check the incident queue on a schedule and escalate when open critical incidents remain unresolved.",
    icon: ShieldAlert,
    color: "#e11d48",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/20 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 20 Minutes", cron_expression: "*/20 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Open Incidents", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/incidents?status=all&limit=25", headers: {}, timeout: 12000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Critical Incidents Open?", field: "body.stats.critical_count", operator: "gt", value: "0" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Incident Queue", channel: "telegram", message: "Incident backlog review found open P1/P2 incidents. Review SLA exposure, assignment state, and unresolved updates in the incidents console." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Add severity=P1 if you want a narrower paging rule", "Tune the cadence to match your incident response coverage window", "Pair this with notification backlog monitoring so operators can clear unread alerts before escalation"],
    packageResources: [
      { href: "/incidents", label: "Incidents" },
      { href: "/tools/tasks", label: "Tasks" },
    ],
  },
  {
    id: "notification-backlog-watch",
    name: "Notification Backlog Watch",
    description: "Review unread notifications and escalate when the operator queue starts to accumulate pending alerts.",
    icon: Bell,
    color: "#f59e0b",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/15 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 15 Minutes", cron_expression: "*/15 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Unread Notifications", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/notifications?unread_only=true&limit=20", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Unread Queue Growing?", field: "body.unread_count", operator: "gt", value: "10" } },
        { id: "4", type: "notify", position: { x: 80, y: 500 }, data: { label: "Escalate Notification Queue", channel: "telegram", message: "Unread notification backlog exceeded the review threshold. Clear or route pending alerts before operators miss critical incidents." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
      ],
    },
    customizationHints: ["Raise or lower the unread threshold to match your on-call staffing", "Route the escalation to chat during business hours and log-only after hours if needed", "Use this with Incident Backlog Watch to separate operator load from true incident severity"],
    packageResources: [
      { href: "/settings/notifications", label: "Notification Settings" },
      { href: "/incidents", label: "Incidents" },
    ],
  },
  {
    id: "incident-intake-drill",
    name: "Incident Intake Drill",
    description: "Create a manual incident record for response drills so operators can validate intake, ownership, and follow-up workflows.",
    icon: LayoutGrid,
    color: "#8b5cf6",
    trigger_type: "manual",
    trigger_config: null,
    definition: {
      nodes: [
        { id: "1", type: "manual-trigger", position: { x: 250, y: 30 }, data: { label: "Run Drill" } },
        {
          id: "2",
          type: "http-request",
          position: { x: 250, y: 180 },
          data: {
            label: "Create Incident",
            method: "POST",
            url: "{{HITECHCLAW_AI_BASE_URL}}/api/incidents",
            headers: {},
            timeout: 12000,
            body: '{"title":"Workflow drill: operator validation","description":"Manual workflow drill created from Mission Control templates.","severity":"P2","assigned_to":"ops-oncall","source_type":"workflow","source_id":"incident-intake-drill","metadata":{"exercise":true,"origin":"mission-control"}}'
          }
        },
        { id: "3", type: "notify", position: { x: 250, y: 340 }, data: { label: "Publish Drill Result", channel: "log", message: "Incident intake drill created a fresh incident record. Confirm ownership, update cadence, and resolution checklist in the incidents workspace. Response: {{body}}" } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
      ],
    },
    customizationHints: ["Keep this manual so drills only run with operator awareness", "Swap the assigned owner to the real on-call alias used in your incident process", "Extend the drill with a follow-up update route after dynamic incident references are supported"],
    packageResources: [
      { href: "/incidents", label: "Incidents" },
      { href: "/tools/docs", label: "Docs Tools" },
    ],
  },
  {
    id: "incident-escalation-followup",
    name: "Incident Escalation Follow-up",
    description: "Create a drill incident, move it into investigation, then append a timeline note so operators can validate the full escalation path.",
    icon: ShieldAlert,
    color: "#ec4899",
    trigger_type: "manual",
    trigger_config: null,
    definition: {
      nodes: [
        { id: "1", type: "manual-trigger", position: { x: 260, y: 30 }, data: { label: "Run Escalation Drill" } },
        {
          id: "2",
          type: "http-request",
          position: { x: 260, y: 180 },
          data: {
            label: "Create Drill Incident",
            method: "POST",
            url: "{{HITECHCLAW_AI_BASE_URL}}/api/incidents",
            headers: {},
            timeout: 12000,
            body: '{"title":"Workflow drill: escalation follow-up","description":"Validate incident escalation and timeline updates from workflow automation.","severity":"P2","assigned_to":"ops-oncall","source_type":"workflow","source_id":"incident-escalation-followup","metadata":{"exercise":true,"origin":"mission-control","playbook":"escalation-followup"}}'
          }
        },
        {
          id: "2b",
          type: "set-context",
          position: { x: 260, y: 260 },
          data: {
            label: "Store Incident ID",
            context_key: "incident_id",
            context_value: "{{body.incident.id}}"
          }
        },
        {
          id: "3",
          type: "http-request",
          position: { x: 260, y: 420 },
          data: {
            label: "Move To Investigating",
            method: "PATCH",
            url: "{{HITECHCLAW_AI_BASE_URL}}/api/incidents/{{incident_id}}",
            headers: {},
            timeout: 12000,
            body: '{"status":"investigating","metadata":{"exercise":true,"workflow":"incident-escalation-followup"}}'
          }
        },
        {
          id: "4",
          type: "http-request",
          position: { x: 260, y: 580 },
          data: {
            label: "Append Timeline Update",
            method: "POST",
            url: "{{HITECHCLAW_AI_BASE_URL}}/api/incidents/{{incident_id}}/updates",
            headers: {},
            timeout: 12000,
            body: '{"update_type":"comment","content":"Workflow escalation drill moved this incident into active investigation.","metadata":{"exercise":true,"workflow":"incident-escalation-followup"}}'
          }
        },
        { id: "5", type: "notify", position: { x: 260, y: 740 }, data: { label: "Publish Escalation Summary", channel: "log", message: "Escalation follow-up drill updated incident {{incident_id}} and appended a timeline note. Review the incident workspace to confirm assignment, SLA state, and operator handoff." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-2b", source: "2", target: "2b" },
        { id: "e2b-3", source: "2b", target: "3" },
        { id: "e3-4", source: "3", target: "4" },
        { id: "e4-5", source: "4", target: "5" },
      ],
    },
    customizationHints: ["Keep this manual until dynamic branching for incident failures is in place", "Use a real on-call alias in assigned_to if you want the drill to mirror production routing", "Append more updates later for postmortem validation once your incident lifecycle is stable"],
    packageResources: [
      { href: "/incidents", label: "Incidents" },
      { href: "/tools/tasks", label: "Tasks" },
    ],
  },
  {
    id: "notification-queue-clearance",
    name: "Notification Queue Clearance",
    description: "Review unread notifications and clear the queue automatically once the backlog crosses the threshold.",
    icon: Bell,
    color: "#f97316",
    trigger_type: "cron",
    trigger_config: { cron_expression: "*/30 * * * *" },
    definition: {
      nodes: [
        { id: "1", type: "cron-trigger", position: { x: 250, y: 30 }, data: { label: "Every 30 Minutes", cron_expression: "*/30 * * * *" } },
        { id: "2", type: "http-request", position: { x: 250, y: 180 }, data: { label: "Fetch Unread Queue", method: "GET", url: "{{HITECHCLAW_AI_BASE_URL}}/api/notifications?unread_only=true&limit=20", headers: {}, timeout: 10000 } },
        { id: "3", type: "condition", position: { x: 250, y: 340 }, data: { label: "Backlog Above Threshold?", field: "body.unread_count", operator: "gt", value: "10" } },
        { id: "4", type: "http-request", position: { x: 80, y: 500 }, data: { label: "Mark Notifications Read", method: "PATCH", url: "{{HITECHCLAW_AI_BASE_URL}}/api/notifications", headers: {}, timeout: 10000, body: '{"all":true}' } },
        { id: "5", type: "notify", position: { x: 80, y: 660 }, data: { label: "Publish Queue Clearance", channel: "telegram", message: "Notification queue clearance marked unread alerts as read after crossing the configured backlog threshold. Review notification settings and incident routing if the queue refills quickly." } },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "true" },
        { id: "e4-5", source: "4", target: "5" },
      ],
    },
    customizationHints: ["Use this carefully because it clears unread state for the whole tenant", "Raise the threshold or switch the final step to log-only if you only want dry-run validation", "Pair this with Notification Backlog Watch so operators see both queue growth and cleanup behavior"],
    packageResources: [
      { href: "/settings/notifications", label: "Notification Settings" },
      { href: "/incidents", label: "Incidents" },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  status: string;
  trigger_type: string;
  trigger_config: { cron_expression?: string } | null;
  created_by: string | null;
  tenant_id: string;
  last_run_at: string | null;
  run_count: number;
  total_runs: number;
  failed_runs: number;
  created_at: string;
  updated_at: string;
}

interface WorkflowRun {
  id: number;
  workflow_id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  step_results: StepResult[];
  error: string | null;
  triggered_by: string;
}

interface StepResult {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "success" | "failed" | "skipped";
  output: unknown;
  error?: string;
  durationMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof document !== "undefined") {
    const csrf = document.cookie.match(/mc_csrf=([^;]+)/)?.[1];
    if (csrf) headers["x-csrf-token"] = decodeURIComponent(csrf);
  }
  return headers;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "rgba(100,116,139,0.15)", text: "#8888A0" },
  active: { bg: "rgba(0,212,126,0.15)", text: "#00D47E" },
  paused: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  archived: { bg: "rgba(100,116,139,0.1)", text: "#8888A0" },
  running: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  completed: { bg: "rgba(0,212,126,0.15)", text: "#00D47E" },
  failed: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  success: { bg: "rgba(0,212,126,0.15)", text: "#00D47E" },
  skipped: { bg: "rgba(100,116,139,0.1)", text: "#8888A0" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

// ── Workflows Screen ──────────────────────────────────────────────────────────

type View = "list" | "editor" | "runs";

export function WorkflowsScreen() {
  const [view, setView] = useState<View>("list");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [templateStep, setTemplateStep] = useState<"gallery" | "customize">("gallery");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);

  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows?status=${statusFilter}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch workflows");
      const data = (await res.json()) as { workflows: Workflow[] };
      setWorkflows(data.workflows);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Fetch runs for selected workflow
  const fetchRuns = useCallback(async (workflowId: number) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs?limit=20`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch runs");
      const data = (await res.json()) as { runs: WorkflowRun[] };
      setRuns(data.runs);
    } catch {
      setRuns([]);
    }
  }, []);

  // Create workflow
  const handleCreate = async () => {
    if (!newName.trim() || !newDesc.trim()) return;
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          definition: {
            nodes: [{ id: "1", type: "manual-trigger", position: { x: 250, y: 50 }, data: { label: "Manual Trigger" } }],
            edges: [],
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      const data = (await res.json()) as { workflow: Workflow };
      toast.success(`Workflow "${data.workflow.name}" created`);
      setShowNewModal(false);
      setNewName("");
      setNewDesc("");
      setSelectedWorkflow(data.workflow);
      setView("editor");
      fetchWorkflows();
    } catch {
      toast.error("Failed to create workflow");
    }
  };

  // Install from template
  const handleInstallTemplate = async (asDraft: boolean) => {
    if (!selectedTemplate || !newName.trim() || !newDesc.trim()) return;
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          definition: selectedTemplate.definition,
          status: asDraft ? "draft" : "active",
          trigger_type: selectedTemplate.trigger_type,
          trigger_config: selectedTemplate.trigger_config,
        }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      const data = (await res.json()) as { workflow: Workflow };
      toast.success(`Workflow "${data.workflow.name}" created from template`);
      closeTemplateModal();
      setSelectedWorkflow(data.workflow);
      setView("editor");
      fetchWorkflows();
    } catch {
      toast.error("Failed to create workflow from template");
    }
  };

  const closeTemplateModal = () => {
    setShowNewModal(false);
    setNewName("");
    setNewDesc("");
    setTemplateStep("gallery");
    setSelectedTemplate(null);
    setPreviewTemplate(null);
  };

  const selectTemplate = (tmpl: WorkflowTemplate) => {
    setSelectedTemplate(tmpl);
    setNewName(tmpl.name);
    setNewDesc(tmpl.description);
    setTemplateStep("customize");
  };

  // Save workflow definition
  const handleSave = async (def: WorkflowDefinition) => {
    if (!selectedWorkflow) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${selectedWorkflow.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ definition: def }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = (await res.json()) as { workflow: Workflow };
      setSelectedWorkflow(data.workflow);
      toast.success("Workflow saved");
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  // Update workflow metadata
  const handleUpdateMeta = async (updates: Partial<Workflow>) => {
    if (!selectedWorkflow) return;
    try {
      const res = await fetch(`/api/workflows/${selectedWorkflow.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = (await res.json()) as { workflow: Workflow };
      setSelectedWorkflow(data.workflow);
      fetchWorkflows();
      toast.success("Workflow updated");
    } catch {
      toast.error("Failed to update workflow");
    }
  };

  // Execute workflow
  const handleExecute = async () => {
    if (!selectedWorkflow) return;
    setExecuting(true);
    try {
      const res = await fetch(`/api/workflows/${selectedWorkflow.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Execution failed");
      const data = (await res.json()) as { run_id: number; status: string; steps: StepResult[]; error: string | null };
      if (data.status === "completed") {
        toast.success(`Run #${data.run_id} completed (${data.steps.length} steps)`);
      } else {
        toast.error(`Run #${data.run_id} failed: ${data.error}`);
      }
      fetchRuns(selectedWorkflow.id);
      fetchWorkflows();
    } catch {
      toast.error("Failed to execute workflow");
    } finally {
      setExecuting(false);
    }
  };

  // Delete workflow
  const handleDelete = async (wf: Workflow) => {
    if (!confirm(`Delete "${wf.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/workflows/${wf.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(`Deleted "${wf.name}"`);
      if (selectedWorkflow?.id === wf.id) {
        setSelectedWorkflow(null);
        setView("list");
      }
      fetchWorkflows();
    } catch {
      toast.error("Failed to delete workflow");
    }
  };

  // ── List View ─────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div>
        <ShellHeader
          title="Workflows"
          subtitle="Visual workflow builder for automating multi-step operations"
          eyebrow="Operate"
        />

        <SectionDescription id="workflows">
          Workflows let you automate responses to events in your AI infrastructure.
          For example: automatically pause an agent when a critical threat is detected,
          send a daily cost report, or check server health every 5 minutes.
        </SectionDescription>

        <div className="mb-6 grid gap-3 xl:grid-cols-3">
          {PACKAGE_WORKFLOW_KITS.map((kit) => (
            <div key={kit.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ background: `${kit.tone}20`, color: kit.tone }}>
                  {kit.packageLabel}
                </span>
                <Link href={kit.packageHref} className="text-xs text-[var(--accent)] hover:underline">
                  Open package
                </Link>
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{kit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{kit.description}</p>
              <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{kit.workflowHint}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {["all", "draft", "active", "paused", "archived"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-white/10 text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent)]/90 transition active:scale-95"
          >
            + New Workflow
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : workflows.length === 0 ? (
          <WorkflowsEmpty />
        ) : (
          <div className="space-y-3">
            {workflows.map((wf, i) => (
              <CardEntranceWrapper key={wf.id} index={i}>
                <div className="relative card-hover rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition">
                  <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => { setSelectedWorkflow(wf); setView("editor"); }}
                          className="text-base font-semibold text-white hover:text-[var(--accent)] transition truncate"
                        >
                          {wf.name}
                        </button>
                        <StatusBadge status={wf.status} />
                      </div>
                      {wf.description ? (
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-1 mb-2">{wf.description}</p>
                      ) : (
                        <p className="text-sm text-amber-400/50 italic mb-2">No description</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
                        <span>
                          Trigger: {wf.trigger_type}
                          {wf.trigger_type === "cron" && wf.trigger_config?.cron_expression && (
                            <span className="ml-1 font-mono text-cyan-400">({wf.trigger_config.cron_expression})</span>
                          )}
                        </span>
                        <span>Runs: <StatCountUp value={wf.run_count} /></span>
                        {wf.failed_runs > 0 && (
                          <span className="text-red-400">Failed: {wf.failed_runs}</span>
                        )}
                        {wf.last_run_at && <span>Last run: {timeAgo(wf.last_run_at)}</span>}
                        <span>Created: {timeAgo(wf.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setSelectedWorkflow(wf); fetchRuns(wf.id); setView("runs"); }}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
                      >
                        Runs
                      </button>
                      <button
                        onClick={() => { setSelectedWorkflow(wf); setView("editor"); }}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(wf)}
                        className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </CardEntranceWrapper>
            ))}
          </div>
        )}

        {/* Template Gallery / New Workflow Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            {templateStep === "gallery" ? (
              /* ── Template Gallery ── */
              <div className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h3 className="text-lg font-bold text-white">New Workflow</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">Start from a template or build from scratch</p>
                  </div>
                  <button onClick={closeTemplateModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3">
                  {WORKFLOW_TEMPLATES.map((tmpl) => {
                    const Icon = tmpl.icon;
                    return (
                      <div
                        key={tmpl.id}
                        className="relative card-hover group rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 hover:border-[var(--border-strong)] transition cursor-pointer"
                        onClick={() => selectTemplate(tmpl)}
                      >
                        <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                        <div className="flex items-start gap-4">
                          <div
                            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg"
                            style={{ background: `${tmpl.color}15`, border: `1px solid ${tmpl.color}30` }}
                          >
                            <Icon className="w-5 h-5" style={{ color: tmpl.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-white group-hover:text-[var(--accent)] transition">{tmpl.name}</span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: `${tmpl.color}15`, color: tmpl.color }}
                              >
                                {tmpl.trigger_type}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">{tmpl.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-tertiary)]">
                              <span>{tmpl.definition.nodes.length} nodes</span>
                              {tmpl.trigger_config?.cron_expression && (
                                <span className="font-mono text-cyan-400/70">{tmpl.trigger_config.cron_expression}</span>
                              )}
                            </div>
                            {tmpl.packageResources?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {tmpl.packageResources.map((resource) => (
                                  <Link
                                    key={`${tmpl.id}-${resource.href}`}
                                    href={resource.href}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                                  >
                                    {resource.label}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplate(previewTemplate?.id === tmpl.id ? null : tmpl);
                              }}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
                            >
                              Preview
                            </button>
                            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition" />
                          </div>
                        </div>

                        {/* Inline Preview */}
                        {previewTemplate?.id === tmpl.id && (
                          <div className="mt-3 rounded-lg border border-[var(--border)] overflow-hidden" style={{ height: 220 }}>
                            <WorkflowBuilder definition={tmpl.definition} onChange={() => {}} readOnly />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Blank Canvas Option */}
                  <div
                    className="group rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-primary)] p-4 hover:border-[var(--border-strong)] transition cursor-pointer"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setNewName("");
                      setNewDesc("");
                      setTemplateStep("customize");
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                        <LayoutGrid className="w-5 h-5 text-[var(--text-tertiary)]" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition">Blank Canvas</span>
                        <p className="text-sm text-[var(--text-tertiary)]">Start from scratch with an empty workflow</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Customize / Create Step ── */
              <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => { setTemplateStep("gallery"); setSelectedTemplate(null); setNewName(""); setNewDesc(""); }}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-sm"
                  >
                    &larr; Back
                  </button>
                  <h3 className="text-lg font-bold text-white">
                    {selectedTemplate ? `Install: ${selectedTemplate.name}` : "New Workflow"}
                  </h3>
                </div>

                {selectedTemplate && (
                  <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">Customize before activating</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedTemplate.customizationHints.map((hint, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                          <span className="text-[var(--text-tertiary)] mt-0.5">&#8226;</span>
                          <span>{hint}</span>
                        </li>
                      ))}
                    </ul>
                    {selectedTemplate.packageResources?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                        {selectedTemplate.packageResources.map((resource) => (
                          <Link
                            key={`selected-${resource.href}`}
                            href={resource.href}
                            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                          >
                            {resource.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Daily Health Check"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[var(--accent)] focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                      placeholder="In plain English, what does this workflow do?"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[var(--accent)] focus:outline-none resize-none"
                    />
                    {!newDesc.trim() && newName.trim() && (
                      <p className="text-[11px] text-amber-400/70 mt-1">Description is required — tell users what this workflow does</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={closeTemplateModal}
                    className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                  >
                    Cancel
                  </button>
                  {selectedTemplate ? (
                    <>
                      <button
                        onClick={() => handleInstallTemplate(true)}
                        disabled={!newName.trim() || !newDesc.trim()}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save as Draft
                      </button>
                      <button
                        onClick={() => handleInstallTemplate(false)}
                        disabled={!newName.trim() || !newDesc.trim()}
                        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent)]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Activate Now
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim() || !newDesc.trim()}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent)]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Editor View ───────────────────────────────────────────────────────────

  if (view === "editor" && selectedWorkflow) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView("list"); setSelectedWorkflow(null); }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-sm"
            >
              &larr; Back
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">{selectedWorkflow.name}</h2>
              {selectedWorkflow.description ? (
                <p className="text-xs text-[var(--text-secondary)]">{selectedWorkflow.description}</p>
              ) : (
                <button
                  onClick={() => {
                    const desc = prompt("What does this workflow do?");
                    if (desc?.trim()) handleUpdateMeta({ description: desc.trim() } as Partial<Workflow>);
                  }}
                  className="text-xs text-amber-400/70 hover:text-amber-400 transition"
                >
                  + Add description (required)
                </button>
              )}
            </div>
            <StatusBadge status={selectedWorkflow.status} />
          </div>
          <div className="flex gap-2">
            {selectedWorkflow.status === "draft" && (
              <button
                onClick={() => handleUpdateMeta({ status: "active" } as Partial<Workflow>)}
                className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
              >
                Activate
              </button>
            )}
            {selectedWorkflow.status === "active" && (
              <button
                onClick={() => handleUpdateMeta({ status: "paused" } as Partial<Workflow>)}
                className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-1.5 text-xs font-medium text-[var(--warning)] hover:bg-[var(--warning)]/20 transition"
              >
                Pause
              </button>
            )}
            {selectedWorkflow.status === "paused" && (
              <button
                onClick={() => handleUpdateMeta({ status: "active" } as Partial<Workflow>)}
                className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
              >
                Resume
              </button>
            )}
            <button
              onClick={handleExecute}
              disabled={executing}
              className="rounded-lg bg-[var(--info)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--info)]/90 transition disabled:opacity-50"
            >
              {executing ? "Running..." : "Run Now"}
            </button>
            <button
              onClick={() => { fetchRuns(selectedWorkflow.id); setView("runs"); }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
            >
              View Runs ({selectedWorkflow.run_count})
            </button>
          </div>
        </div>

        {/* Cron Trigger Config Bar */}
        {selectedWorkflow.trigger_type === "cron" && (
          <CronConfigBar
            workflow={selectedWorkflow}
            onUpdate={(updates) => handleUpdateMeta(updates as Partial<Workflow>)}
          />
        )}

        {/* Trigger Type Toggle */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">Trigger:</span>
          {["manual", "cron"].map((t) => (
            <button
              key={t}
              onClick={() => {
                const updates: Record<string, unknown> = { trigger_type: t };
                if (t === "cron" && !selectedWorkflow.trigger_config?.cron_expression) {
                  updates.trigger_config = { cron_expression: "*/5 * * * *" };
                }
                handleUpdateMeta(updates as Partial<Workflow>);
              }}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedWorkflow.trigger_type === t
                  ? t === "cron" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "bg-white/10 text-white border border-white/20"
                  : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] border border-transparent"
              }`}
            >
              {t === "cron" ? "\u23F0 Cron" : "\u25B6 Manual"}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ height: selectedWorkflow.trigger_type === "cron" ? "calc(100vh - 320px)" : "calc(100vh - 260px)" }}>
          <WorkflowBuilder
            definition={selectedWorkflow.definition}
            onChange={(def) => handleSave(def)}
          />
        </div>

        {saving && (
          <div className="fixed bottom-20 right-6 z-50 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-secondary)] shadow-lg">
            Saving...
          </div>
        )}
      </div>
    );
  }

  // ── Runs View ─────────────────────────────────────────────────────────────

  if (view === "runs" && selectedWorkflow) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("list")}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-sm"
            >
              &larr; Back
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">{selectedWorkflow.name} — Run History</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("editor")}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
            >
              Edit Workflow
            </button>
            <button
              onClick={handleExecute}
              disabled={executing}
              className="rounded-lg bg-[var(--info)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--info)]/90 transition disabled:opacity-50"
            >
              {executing ? "Running..." : "Run Now"}
            </button>
          </div>
        </div>

        {runs.length === 0 ? (
          <EmptyState
            icon={WorkflowIcon}
            title="No runs yet"
            description="Execute this workflow to see results here."
            compact
          />
        ) : (
          <div className="space-y-3">
            {runs.map((run, i) => (
              <CardEntranceWrapper key={run.id} index={i}>
                <RunCard run={run} />
              </CardEntranceWrapper>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return null;
}

// ── Cron Config Bar ──────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { expr: "*/5 * * * *", label: "Every 5 min" },
  { expr: "*/15 * * * *", label: "Every 15 min" },
  { expr: "*/30 * * * *", label: "Every 30 min" },
  { expr: "0 * * * *", label: "Hourly" },
  { expr: "0 6 * * *", label: "Daily 8am SAST" },
  { expr: "0 6 * * 1-5", label: "Weekdays 8am SAST" },
];

function getNextCronRunClient(expression: string): string | null {
  // Lightweight client-side next-run calculator
  // Same logic as server-side getNextCronRun
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    function parseField(field: string, min: number, max: number): Set<number> {
      const values = new Set<number>();
      for (const part of field.split(",")) {
        const t = part.trim();
        if (t === "*") { for (let i = min; i <= max; i++) values.add(i); continue; }
        const stepMatch = t.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
        if (stepMatch) {
          const step = parseInt(stepMatch[4], 10);
          let s = min, e = max;
          if (stepMatch[2] !== undefined) { s = parseInt(stepMatch[2], 10); e = parseInt(stepMatch[3], 10); }
          for (let i = s; i <= e; i += step) values.add(i);
          continue;
        }
        const rangeMatch = t.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) { for (let i = parseInt(rangeMatch[1], 10); i <= parseInt(rangeMatch[2], 10); i++) values.add(i); continue; }
        const num = parseInt(t, 10);
        if (!isNaN(num)) values.add(num);
      }
      return values;
    }

    const minutes = parseField(parts[0], 0, 59);
    const hours = parseField(parts[1], 0, 23);
    const daysOfMonth = parseField(parts[2], 1, 31);
    const months = parseField(parts[3], 1, 12);
    const daysOfWeek = parseField(parts[4], 0, 6);

    const check = new Date();
    check.setSeconds(0, 0);
    check.setMinutes(check.getMinutes() + 1);

    for (let i = 0; i < 2880; i++) { // 48h
      if (
        minutes.has(check.getMinutes()) &&
        hours.has(check.getHours()) &&
        daysOfMonth.has(check.getDate()) &&
        months.has(check.getMonth() + 1) &&
        daysOfWeek.has(check.getDay())
      ) {
        return check.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
      }
      check.setMinutes(check.getMinutes() + 1);
    }
    return null;
  } catch {
    return null;
  }
}

function CronConfigBar({ workflow, onUpdate }: { workflow: Workflow; onUpdate: (updates: Record<string, unknown>) => void }) {
  const cronExpr = workflow.trigger_config?.cron_expression ?? "*/5 * * * *";
  const [editing, setEditing] = useState(false);
  const [expr, setExpr] = useState(cronExpr);
  const nextRun = getNextCronRunClient(cronExpr);

  const saveCron = () => {
    if (expr.trim().split(/\s+/).length === 5) {
      onUpdate({ trigger_config: { cron_expression: expr.trim() } });
      setEditing(false);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 text-sm">{"\u23F0"}</span>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                className="rounded border border-cyan-500/30 bg-[var(--bg-primary)] px-2 py-1 text-sm font-mono text-white w-40 focus:border-cyan-400 focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") saveCron(); if (e.key === "Escape") { setExpr(cronExpr); setEditing(false); } }}
                autoFocus
              />
              <button onClick={saveCron} className="text-xs text-cyan-400 hover:text-[var(--text-primary)] transition">Save</button>
              <button onClick={() => { setExpr(cronExpr); setEditing(false); }} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="font-mono text-sm text-white hover:text-cyan-400 transition">
              {cronExpr}
            </button>
          )}
          {!editing && (
            <div className="flex gap-1">
              {CRON_PRESETS.slice(0, 4).map((p) => (
                <button
                  key={p.expr}
                  onClick={() => onUpdate({ trigger_config: { cron_expression: p.expr } })}
                  className={`rounded px-2 py-0.5 text-[10px] transition ${
                    cronExpr === p.expr ? "bg-cyan-500/20 text-cyan-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)]">
          {nextRun ? (
            <span>Next run: <span className="text-cyan-400">{nextRun} SAST</span></span>
          ) : (
            <span className="text-amber-400">Invalid expression</span>
          )}
          {workflow.status === "active" && <span className="ml-2 text-green-400">Scheduled</span>}
          {workflow.status !== "active" && <span className="ml-2 text-[var(--text-tertiary)]">Activate to enable</span>}
        </div>
      </div>
    </div>
  );
}

// ── Run Card (with expandable step results) ─────────────────────────────────

function RunCard({ run }: { run: WorkflowRun }) {
  const [expanded, setExpanded] = useState(false);
  const steps = (run.step_results ?? []) as StepResult[];
  const duration =
    run.completed_at && run.started_at
      ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
      : null;

  return (
    <div className="relative card-hover rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
    <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-[var(--text-tertiary)]">#{run.id}</span>
            <StatusBadge status={run.status} />
            <span className="text-xs text-[var(--text-tertiary)]">{steps.length} steps</span>
            {duration !== null && (
              <span className="text-xs text-[var(--text-tertiary)]">{duration}ms</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-tertiary)]">{timeAgo(run.started_at)}</span>
            <span className="text-[var(--text-tertiary)] text-xs">{expanded ? "\u25B2" : "\u25BC"}</span>
          </div>
        </div>
        {run.error && (
          <p className="mt-2 text-xs text-red-400 line-clamp-1">{run.error}</p>
        )}
      </button>

      {expanded && steps.length > 0 && (
        <div className="border-t border-[var(--border)] p-4 space-y-2">
          {steps.map((step, i) => (
            <div
              key={`${step.nodeId}-${i}`}
              className="flex items-start gap-3 rounded-lg p-2"
              style={{
                background:
                  step.status === "success"
                    ? "rgba(0,212,126,0.05)"
                    : step.status === "failed"
                    ? "rgba(239,68,68,0.05)"
                    : "rgba(100,116,139,0.05)",
              }}
            >
              <div className="shrink-0 mt-0.5">
                <StatusBadge status={step.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{step.label}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{step.nodeType}</span>
                  {step.durationMs > 0 && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">{step.durationMs}ms</span>
                  )}
                </div>
                {step.error && (
                  <p className="text-xs text-red-400 mt-1">{step.error}</p>
                )}
                {step.output != null && (
                  <pre className="text-[11px] text-[var(--text-secondary)] mt-1 overflow-x-auto max-h-24 font-mono">
                    {typeof step.output === "string"
                      ? step.output
                      : JSON.stringify(step.output as Record<string, unknown>, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
