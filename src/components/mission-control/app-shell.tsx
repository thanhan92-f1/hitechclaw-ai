"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode, useCallback, useEffect, useState } from "react";
import { PageTransitionWrapper } from "./charts";
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  Bot,
  Database,
  Network,
  ShieldCheck,
  Wallet,
  CheckCircle,
  Workflow,
  FileText,
  Plug,
  Shield,
  Lock,
  LogOut,
  Menu,
  Home,
  MoreHorizontal,
  ChevronDown,
  Star,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeft,
  GitBranch,
  KeyRound,
  Globe,
  Archive,
  Brain,
  MessageSquare,
  Puzzle,
  Smartphone,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { NotificationDropdown } from "./notification-dropdown";
// import { ActiveRunBanner } from "./active-run-banner"; // Replaced by FloatingKillSwitch
// import { MobileKillBar } from "./mobile-kill-bar"; // Replaced by FloatingKillSwitch
import { QuickKillDialog } from "./quick-kill-dialog";
import { FloatingKillSwitch } from "./floating-kill-switch";
import { GuidedTour } from "./guided-tour";
import { GlobalShortcuts } from "./global-shortcuts";
import { HelpPanel } from "./help-panel";
import { Breadcrumbs } from "../ui/breadcrumbs";
import { TenantSwitcher } from "./tenant-switcher";
import { ThemeToggle } from "./theme-toggle";
import { getAuthHeaders } from "./api";
import { WorkspaceModeToggle } from "./workspace-mode-toggle";
import { OpenClawManagement } from "./openclaw-management";
import { OpenClawTargetSwitcher } from "./openclaw-target-switcher";
import { useTenantFilter } from "./tenant-context";

const pageLabels: Record<string, string> = {
  "/": "Dashboard",
  "/tools": "Tools",
  "/tools/approvals": "Approvals",
  "/tools/docs": "Docs",
  "/tools/tasks": "Tasks",
  "/tools/calendar": "Calendar",
  "/tools/agents-live": "Live Agents",
  "/workflows": "Workflows",
  "/tools/command": "Command",
  "/security": "Threats",
  "/analytics": "Anomaly Detection",
  "/traces": "Traces",
  "/costs": "Costs",
  "/agents": "Agents",
  "/systems": "Infrastructure",
  "/confessions": "Confessions",
  "/visuals": "Visuals",
  "/actions": "Actions",
  "/activity": "Activity",
  "/tools/crons": "Cron Jobs",
  "/tools/intake": "Client Intake",
  "/tools/mcp": "MCP",
  "/tools/mcp-gateway": "MCP Gateway",
  "/admin": "Admin Panel",
  "/infrastructure": "Infrastructure",
  "/benchmarks": "Benchmarks",
  "/compliance": "Compliance",
  "/client": "Client Portal",
  "/client/agents": "Client Agents",
  "/client/events": "Client Events",
  "/client/costs": "Client Costs",
  "/incidents": "Incidents",
  "/settings": "Settings",
  "/settings/appearance": "Appearance",
  "/settings/notifications": "Notifications",
  "/settings/openclaw": "OpenClaw Targets",
  "/settings/openclaw/connectivity": "OpenClaw Connectivity",
  "/settings/openclaw/guardrails": "OpenClaw Guardrails",
  "/help/glossary": "Glossary",
  "/victoryos": "VictoryOS",
};

type NavItem = {
  href: string;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
};

type OpenClawNavItem = {
  key:
    | "overview"
    | "runtime"
    | "mcp"
    | "gateway"
    | "auth"
    | "provider"
    | "credentials"
    | "cron"
    | "config-advanced"
    | "memory"
    | "devices"
    | "agents"
    | "domain"
    | "backup"
    | "channels"
    | "plugins"
    | "skills"
    | "hooks"
    | "directory"
    | "models"
    | "system"
    | "sessions";
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

const mobileTabs: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/security", label: "Threats", icon: ShieldCheck },
  { href: "/costs", label: "Costs", icon: Wallet },
  { href: "##more##", label: "More", icon: MoreHorizontal },
];

const moreSheetItems: NavItem[] = [
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/infrastructure", label: "Infrastructure", icon: Network },
  { href: "/traces", label: "Traces", icon: GitBranch },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/tools/mcp", label: "MCP", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

const openClawNavItems: OpenClawNavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, subtitle: "Service identity & health" },
  { key: "runtime", label: "Runtime", icon: Activity, subtitle: "Service control & logs" },
  { key: "mcp", label: "MCP", icon: Plug, subtitle: "MCP server inventory" },
  { key: "gateway", label: "Gateway", icon: Network, subtitle: "Gateway discovery & nodes" },
  { key: "auth", label: "Auth", icon: Lock, subtitle: "Management login control" },
  { key: "provider", label: "Provider", icon: Bot, subtitle: "Provider and model control" },
  { key: "credentials", label: "Credentials", icon: KeyRound, subtitle: "API keys and secrets" },
  { key: "cron", label: "Cron", icon: Workflow, subtitle: "Scheduler jobs and runs" },
  { key: "config-advanced", label: "Config Advanced", icon: Settings, subtitle: "Schema, patch, and raw file" },
  { key: "memory", label: "Memory", icon: Brain, subtitle: "Index, search, and health" },
  { key: "devices", label: "Devices", icon: Smartphone, subtitle: "Pairing and token lifecycle" },
  { key: "agents", label: "Agents", icon: Bot, subtitle: "Agent registry and files" },
  { key: "domain", label: "Domain", icon: Globe, subtitle: "Domain and SSL" },
  { key: "backup", label: "Backup", icon: Archive, subtitle: "Snapshots and verify" },
  { key: "channels", label: "Channels", icon: MessageSquare, subtitle: "Messaging connectors" },
  { key: "plugins", label: "Plugins", icon: Puzzle, subtitle: "Plugin inventory & toggles" },
  { key: "skills", label: "Skills", icon: Puzzle, subtitle: "Skill inventory and config" },
  { key: "hooks", label: "Hooks", icon: Wrench, subtitle: "Hook checks and toggles" },
  { key: "directory", label: "Directory", icon: Database, subtitle: "Peers and groups" },
  { key: "models", label: "Models", icon: Settings, subtitle: "Aliases and fallbacks" },
  { key: "system", label: "System", icon: Shield, subtitle: "Presence and heartbeat" },
  { key: "sessions", label: "Sessions", icon: Database, subtitle: "Session inventory & cleanup" },
];

const openClawSettingsItems: NavItem[] = [
  { href: "/settings/openclaw", label: "Targets", subtitle: "Database-backed environments", icon: Settings },
  { href: "/settings/openclaw/connectivity", label: "Connectivity", subtitle: "URLs and credentials", icon: Globe },
  { href: "/settings/openclaw/guardrails", label: "Guardrails", subtitle: "Runtime defaults and policy", icon: Shield },
];

const navGroups: Array<{ label: string; key: string; items: NavItem[] }> = [
  {
    label: "Observe",
    key: "observe",
    items: [
      { href: "/", label: "Dashboard", subtitle: "System health & key metrics", icon: LayoutDashboard },
      { href: "/agents", label: "Agents", subtitle: "Monitor your AI agents", icon: Bot },
      { href: "/security", label: "Threats", subtitle: "Detect & respond to threats", icon: ShieldCheck },
      { href: "/costs", label: "Costs", subtitle: "Spending by agent & model", icon: Wallet },
      { href: "/traces", label: "Traces", subtitle: "Agent execution traces & spans", icon: GitBranch },
      { href: "/infrastructure", label: "Infrastructure", subtitle: "Server topology & resources", icon: Network },
    ],
  },
  {
    label: "Respond",
    key: "respond",
    items: [
      { href: "/incidents", label: "Incidents", subtitle: "Track operational incidents", icon: AlertTriangle },
      { href: "/tools/approvals", label: "Approvals", subtitle: "Review pending requests", icon: CheckCircle },
      { href: "/workflows", label: "Workflows", subtitle: "Automate operations", icon: Workflow },
    ],
  },
  {
    label: "Manage",
    key: "manage",
    items: [
      { href: "/tools/mcp", label: "MCP", subtitle: "Manage tool providers", icon: Plug },
      { href: "/tools/docs", label: "Docs", subtitle: "Agent documentation", icon: FileText },
      { href: "/compliance", label: "Compliance", subtitle: "Audit logs & data export", icon: Shield },
      { href: "/settings", label: "Settings", subtitle: "Notifications & preferences", icon: Settings },
    ],
  },
  {
    label: "Admin",
    key: "admin",
    items: [
      { href: "/admin", label: "Admin Panel", subtitle: "System configuration", icon: Lock },
    ],
  },
];

/* ── localStorage-persisted collapsed state ── */

const NAV_COLLAPSED_KEY = "mc-nav-collapsed";
const DEFAULT_EXPANDED = new Set(["observe", "respond"]);

function getDefaultCollapsedGroups(): Set<string> {
  const collapsed = new Set<string>();
  for (const g of navGroups) {
    if (!DEFAULT_EXPANDED.has(g.key)) collapsed.add(g.key);
  }
  return collapsed;
}

function parseCollapsedGroups(raw: string | null): Set<string> {
  if (!raw) {
    return getDefaultCollapsedGroups();
  }
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return getDefaultCollapsedGroups();
  }
}

function saveCollapsedGroups(collapsed: Set<string>) {
  try {
    localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Silent
  }
}

/* ── Pinned docs for Quick Access ── */

type PinnedDoc = {
  id: number;
  title: string;
  category: string;
  file_path: string | null;
};

/* ── Tour target IDs for guided tour ── */
const TOUR_IDS: Record<string, string> = {
  "/": "dashboard",
  "/agents": "nav-agents",
  "/security": "nav-threatguard",
  "/costs": "nav-costs",
  "/workflows": "nav-workflows",
};

function isRouteActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NotionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, openClawSection, setMode, setOpenClawSection } = useTenantFilter();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  // alertCount removed — NotificationDropdown now self-manages via /api/notifications
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => getDefaultCollapsedGroups());
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDoc[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickKillOpen, setQuickKillOpen] = useState(false);

  const isPublicPage = pathname === "/login" || pathname?.startsWith("/setup");
  const isOpenClawSettingsRoute = Boolean(pathname?.startsWith("/settings/openclaw"));
  const renderOpenClawRouteChildren = mode === "openclaw" && isOpenClawSettingsRoute;

  // First-run detection: redirect to setup wizard if not completed
  useEffect(() => {
    if (isPublicPage) return;
    let mounted = true;
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: { needs_setup?: boolean }) => {
        if (mounted && data.needs_setup) {
          router.replace("/setup");
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [router, isPublicPage]);

  useEffect(() => {
    if (isPublicPage) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setCollapsedGroups(parseCollapsedGroups(localStorage.getItem(NAV_COLLAPSED_KEY)));
      } catch {
        setCollapsedGroups(getDefaultCollapsedGroups());
      }
      if (!active) return;
      try {
        setSidebarCollapsed(localStorage.getItem("hitechclaw-ai-sidebar-collapsed") === "true");
      } catch {
        setSidebarCollapsed(false);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isPublicPage]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("hitechclaw-ai-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  // Fetch pending approvals
  useEffect(() => {
    if (isPublicPage) return;
    let mounted = true;
    const run = async () => {
      try {
        const response = await fetch("/api/tools/approvals?status=pending&limit=1", {
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { pendingCount?: number };
        if (!mounted) return;
        setPendingCount(payload.pendingCount ?? 0);
      } catch {
        if (!mounted) return;
        setPendingCount(null);
      }
    };
    run();
    const timer = window.setInterval(run, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [isPublicPage]);

  // Alert count polling removed — NotificationDropdown self-manages via /api/notifications

  // Fetch pinned docs (max 3 for Quick Access)
  useEffect(() => {
    if (isPublicPage) return;
    let mounted = true;
    fetch("/api/tools/docs?pinned=true&limit=3", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d: { items?: PinnedDoc[] }) => {
        if (mounted) setPinnedDocs((d.items ?? []).slice(0, 3));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isPublicPage]);

  // Cmd+K listener (command palette) + Ctrl+Shift+K (quick kill)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        setQuickKillOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeNavigationOverlays = () => {
    setIsOpen(false);
    setMoreOpen(false);
  };

  const handleOpenClawNavSelect = (nextOpenClawSection: OpenClawNavItem["key"]) => {
    closeNavigationOverlays();
    if (mode === "openclaw") {
      setOpenClawSection(nextOpenClawSection);
      if (isOpenClawSettingsRoute) {
        router.push("/");
      }
    }
  };

  // Skip shell chrome for login and setup pages (after all hooks to satisfy Rules of Hooks)
  if (isPublicPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    document.cookie = "mc_auth=; path=/; max-age=0";
    document.cookie = "mc_csrf=; path=/; max-age=0";
    document.cookie = "mc_role=; path=/; max-age=0";
    router.push("/login");
  };

  const openClawSidebar = (
    <div className="flex h-full flex-col bg-[var(--bg-primary)] text-[var(--text-secondary)]">
      <div className="flex h-14 items-center border-b border-[var(--border)]/50 px-4">
        <div className="flex-1 min-w-0">
          {!sidebarCollapsed && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text-tertiary)]">
                HiTechClaw AI
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">OpenClaw Control</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition hover:bg-white/[0.03] hover:text-[var(--text-secondary)]"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-3 px-3">
          {!sidebarCollapsed && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Manage</p>}
        </div>
        <div className="space-y-1">
          {openClawNavItems.map((item) => {
            const active = item.key === openClawSection;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  handleOpenClawNavSelect(item.key);
                }}
                className={`flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                }`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                {!sidebarCollapsed && <div className="min-w-0 flex-1 text-left">
                  <span>{item.label}</span>
                  <span className="block truncate text-[10px] font-normal text-[var(--text-tertiary)]">{item.subtitle}</span>
                </div>}
              </button>
            );
          })}
        </div>

          <div className="mt-4 border-t border-[var(--border)]/50 pt-3">
            <div className="mb-3 px-3">
              {!sidebarCollapsed && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Settings</p>}
            </div>
            <div className="space-y-1">
              {openClawSettingsItems.map((item) => {
                const active = isRouteActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeNavigationOverlays}
                    className={`flex min-h-9 items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
                      active
                        ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                    {!sidebarCollapsed && <div className="min-w-0 flex-1 text-left">
                      <span>{item.label}</span>
                      {item.subtitle ? <span className="block truncate text-[10px] font-normal text-[var(--text-tertiary)]">{item.subtitle}</span> : null}
                    </div>}
                  </Link>
                );
              })}
            </div>
          </div>

        <div className="mt-4 border-t border-[var(--border)]/50 pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-red-500/[0.06] hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--bg-primary)] text-[var(--text-secondary)]">
      <div className="flex h-14 items-center border-b border-[var(--border)]/50 px-4">
        <div className="flex-1 min-w-0">
          {!sidebarCollapsed && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text-tertiary)]">
                HiTechClaw AI
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">Workspace</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition hover:bg-white/[0.03] hover:text-[var(--text-secondary)]"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Search trigger */}
      {!sidebarCollapsed && <div className="px-2 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex min-h-9 w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-[var(--border)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
            <span suppressHydrationWarning>{typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318K" : "Ctrl+K"}</span>
          </kbd>
        </button>
      </div>}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key);
          return (
            <section key={group.key} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex min-h-8 w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left transition hover:bg-white/[0.02]"
              >
                {!sidebarCollapsed && <ChevronDown
                  className={`h-3 w-3 text-[var(--text-tertiary)] transition-transform duration-200 ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />}
                {!sidebarCollapsed && <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">
                  {group.label}
                </span>}
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                }`}
              >
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const active = isRouteActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeNavigationOverlays}
                        data-tour={TOUR_IDS[item.href]}
                        className={`flex min-h-9 items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
                          active
                            ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                        {!sidebarCollapsed && <div className="min-w-0 flex-1">
                          <span>{item.label}</span>
                          {item.subtitle && (
                            <span className="block truncate text-[10px] font-normal text-[var(--text-tertiary)]">{item.subtitle}</span>
                          )}
                        </div>}
                        {item.href === "/tools/approvals" && pendingCount && pendingCount > 0 ? (
                          <span className="rounded-full bg-[var(--warning)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-foreground)]">
                            {pendingCount > 9 ? "9+" : pendingCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}

        {/* Quick Access — pinned docs (max 3) */}
        {pinnedDocs.length > 0 && !sidebarCollapsed ? (
          <>
            <div className="my-2 border-t border-[var(--border)]/50" />
            <section>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">
                Quick Access
              </p>
              <div className="space-y-0.5">
                {pinnedDocs.map((doc) => (
                  <Link
                    key={`pinned-${doc.id}`}
                    href={`/tools/docs?id=${doc.id}`}
                    onClick={closeNavigationOverlays}
                    className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[13px] text-[var(--text-secondary)] transition hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <div className="mt-2 border-t border-[var(--border)]/50 pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-red-500/[0.06] hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="flex min-h-screen">
        <aside className={`hidden shrink-0 border-r border-[var(--border)]/50 md:block transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-60"}`}>
          <div className="sticky top-0 h-screen">{mode === "openclaw" ? openClawSidebar : sidebar}</div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-[var(--border)]/50 bg-[var(--bg-primary)]/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] md:hidden active:scale-95 transition-transform touch-manipulation"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <Breadcrumbs />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{mode === "openclaw" ? "OpenClaw Management" : (pageLabels[pathname ?? ""] ?? "HiTechClaw AI")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="hidden md:flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[12px] text-[var(--text-tertiary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                  <kbd className="ml-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] font-medium">
                    <span suppressHydrationWarning>{typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318K" : "Ctrl+K"}</span>
                  </kbd>
                </button>
                <OpenClawTargetSwitcher />
                <ThemeToggle />
                <TenantSwitcher />
                <WorkspaceModeToggle />
                <HelpPanel />
                <NotificationDropdown />
              </div>
            </div>
          </header>

          {/* ActiveRunBanner replaced by FloatingKillSwitch */}

          <main className="min-w-0 flex-1 px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 md:pb-6">
            <div className="mx-auto w-full max-w-6xl">
              <PageTransitionWrapper pathname={mode === "openclaw" && !renderOpenClawRouteChildren ? "/openclaw" : (pathname ?? "/")}>
                {mode === "openclaw" && !renderOpenClawRouteChildren ? <OpenClawManagement /> : children}
              </PageTransitionWrapper>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/70 cursor-pointer"
            role="button"
            aria-label="Close sidebar"
            tabIndex={-1}
            onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
          />
          <div className="relative h-full w-[272px] max-w-[85vw] border-r border-[var(--border)]/50 shadow-[0_20px_60px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
            {mode === "openclaw" ? openClawSidebar : sidebar}
          </div>
        </div>
      ) : null}

      {/* Mobile more sheet */}
      {moreOpen ? (
        <div className="fixed inset-0 z-[45] md:hidden">
          <div
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/50 cursor-pointer"
            role="button"
            aria-label="Close more menu"
            tabIndex={-1}
            onKeyDown={(e) => { if (e.key === "Escape") setMoreOpen(false); }}
          />
          <div className="absolute inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] mx-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">
              {mode === "openclaw" ? "OpenClaw actions" : "More"}
            </div>
            {mode === "openclaw" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5">
                  {openClawNavItems.map((item) => {
                    const active = item.key === openClawSection;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          handleOpenClawNavSelect(item.key);
                          setMoreOpen(false);
                        }}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${
                          active
                            ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                        <div className="min-w-0 flex-1">
                          <div>{item.label}</div>
                          <div className="truncate text-[10px] font-normal text-[var(--text-tertiary)]">{item.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-1.5 border-t border-[var(--border)]/50 pt-3">
                  {openClawSettingsItems.map((item) => {
                    const active = isRouteActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${
                          active
                            ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                        <div className="min-w-0 flex-1">
                          <div>{item.label}</div>
                          {item.subtitle ? <div className="truncate text-[10px] font-normal text-[var(--text-tertiary)]">{item.subtitle}</div> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border)]/50 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("hitechclaw");
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>HiTechClaw</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-red-400 transition hover:bg-red-500/[0.08]"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {moreSheetItems.map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-[rgba(0,212,126,0.08)] text-[var(--accent)]"
                          : "text-[var(--text-secondary)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Mobile kill bar — above bottom nav when active run exists */}
      {/* MobileKillBar replaced by FloatingKillSwitch */}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)]/50 bg-[var(--bg-primary)]/95 backdrop-blur md:hidden">
        <div className="mx-auto grid h-[56px] max-w-3xl grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),4px)] pt-1">
          {(mode === "openclaw"
            ? [
                ...openClawNavItems.map((item) => ({ href: `##${item.key}##`, label: item.label, icon: item.icon })),
                { href: "##more##", label: "More", icon: MoreHorizontal },
              ]
            : mobileTabs).map((tab) => {
            if (tab.href === "##more##") {
              const Icon = tab.icon;
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex min-h-10 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition ${
                    moreOpen ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  <Icon className="mb-0.5 h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            }
            if (mode === "openclaw" && tab.href.startsWith("##")) {
              const sectionKey = tab.href.replace(/#/g, "") as OpenClawNavItem["key"];
              const active = sectionKey === openClawSection;
              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => handleOpenClawNavSelect(sectionKey)}
                  className={`flex min-h-10 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition ${
                    active
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  }`}
                >
                  <tab.icon className="mb-0.5 h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            }

            const active = isRouteActive(pathname, tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-h-10 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className="relative mb-0.5">
                  <Icon className="h-5 w-5" />
                  {tab.href === "/tools" && pendingCount && pendingCount > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex min-h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--warning)] px-0.5 text-[8px] font-bold text-[var(--accent-foreground)]">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={(action) => {
          if (action === "quick-kill") setQuickKillOpen(true);
        }}
      />

      {/* Floating Kill Switch FAB */}
      <FloatingKillSwitch />

      {/* Quick Kill Dialog (Ctrl+Shift+K) */}
      <QuickKillDialog open={quickKillOpen} onClose={() => setQuickKillOpen(false)} />

      {/* Guided Tour (activated by ?tour=1 after setup wizard) */}
      {/* Global Keyboard Shortcuts */}
      <GlobalShortcuts onOpenPalette={() => setPaletteOpen(true)} />
      <Suspense fallback={null}>
        <GuidedTour />
      </Suspense>
    </div>
  );
}
