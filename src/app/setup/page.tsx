"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  Zap,
  Rocket,
  Check,
  Copy,
  ShieldCheck,
  Wallet,
  Workflow,
  Network,
  BookOpen,
  Loader2,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const TOTAL_STEPS = 5;

const FRAMEWORKS = [
  { value: "openclaw", label: "OpenClaw" },
  { value: "nemoclaw", label: "NemoClaw" },
  { value: "crewai", label: "CrewAI" },
  { value: "autogen", label: "AutoGen" },
  { value: "custom", label: "Custom / Other" },
];

const INSTALL_MODES = [
  {
    value: "script",
    label: "Generate script only",
    description: "Prepare install/config snippets for manual execution.",
  },
  {
    value: "remote",
    label: "Remote deploy",
    description: "Apply configuration directly over SSH.",
  },
  {
    value: "both",
    label: "Remote + script",
    description: "Apply over SSH and keep a reusable script.",
  },
] as const;

type SetupAgentDraft = {
  clientId: string;
  name: string;
  description: string;
  framework: string;
  installMode: "script" | "remote" | "both";
  sshHost: string;
  sshUser: string;
  sshPort: string;
  sshKeyPath: string;
  nodeName: string;
  configPath: string;
  serviceName: string;
  runtimeUser: string;
};

type RegisteredAgent = {
  name: string;
  agent_id: string;
  token: string;
  framework: string;
  install_mode: "script" | "remote" | "both";
  config_path: string;
  service_name: string | null;
  ssh_host: string | null;
  ssh_user: string | null;
  ssh_port?: number | null;
  ssh_key_path?: string | null;
  runtime_user?: string | null;
  node_id: string | null;
  install_snippet: string;
  deployment?: {
    ok: boolean;
    mode: "script" | "remote" | "both";
    output?: string;
    error?: string;
  };
};

type RetryDeployState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

type SshTestState = {
  status: "idle" | "testing" | "success" | "error";
  message: string;
};

function createDraftId() {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyAgentDraft(framework = "openclaw"): SetupAgentDraft {
  return {
    clientId: createDraftId(),
    name: "",
    description: "",
    framework,
    installMode: framework === "openclaw" || framework === "nemoclaw" ? "both" : "script",
    sshHost: "",
    sshUser: "",
    sshPort: "22",
    sshKeyPath: "",
    nodeName: "",
    configPath: "",
    serviceName:
      framework === "openclaw"
        ? "openclaw-gateway.service"
        : framework === "nemoclaw"
          ? "nemoclaw.service"
          : "",
    runtimeUser: "",
  };
}

/* ── Main Setup Wizard ─────────────────────────────────────────────────────── */

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — Account
  const [orgName, setOrgName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 — Agents
  const [agents, setAgents] = useState<SetupAgentDraft[]>([
    createEmptyAgentDraft("openclaw"),
    createEmptyAgentDraft("nemoclaw"),
  ]);
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [sshTestResults, setSshTestResults] = useState<Record<string, SshTestState>>({});
  const [retryDeployResults, setRetryDeployResults] = useState<Record<string, RetryDeployState>>({});

  // Step 4 — First Event
  const [eventReceived, setEventReceived] = useState(false);
  const [listening, setListening] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if setup already done
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: { setup_completed?: boolean }) => {
        if (data.setup_completed) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const currentAgent =
    registeredAgents.find((agent) => agent.agent_id === selectedAgentId) ??
    registeredAgents[0] ??
    null;

  function updateDraft(clientId: string, patch: Partial<SetupAgentDraft>) {
    setAgents((current) =>
      current.map((agent) =>
        agent.clientId === clientId
          ? {
              ...agent,
              ...patch,
            }
          : agent
      )
    );
  }

  function updateFramework(clientId: string, nextFramework: string) {
    setAgents((current) =>
      current.map((agent) => {
        if (agent.clientId !== clientId) return agent;
        const nextInstallMode =
          nextFramework === "openclaw" || nextFramework === "nemoclaw"
            ? agent.installMode === "script"
              ? "both"
              : agent.installMode
            : agent.installMode;

        return {
          ...agent,
          framework: nextFramework,
          installMode: nextInstallMode,
          serviceName:
            nextFramework === "openclaw"
              ? agent.serviceName || "openclaw-gateway.service"
              : nextFramework === "nemoclaw"
                ? agent.serviceName || "nemoclaw.service"
                : agent.serviceName,
        };
      })
    );
  }

  function addAgentDraft() {
    setAgents((current) => [...current, createEmptyAgentDraft("custom")]);
  }

  function removeAgentDraft(clientId: string) {
    setAgents((current) =>
      current.length > 1 ? current.filter((agent) => agent.clientId !== clientId) : current
    );
    setSshTestResults((current) => {
      const next = { ...current };
      delete next[clientId];
      return next;
    });
  }

  async function testSshConnection(agent: SetupAgentDraft) {
    const sshHost = agent.sshHost.trim();
    const sshUser = agent.sshUser.trim();
    const sshPort = agent.sshPort.trim();
    const sshKeyPath = agent.sshKeyPath.trim();

    if (!sshHost || !sshUser) {
      setSshTestResults((current) => ({
        ...current,
        [agent.clientId]: {
          status: "error",
          message: "SSH host and SSH user are required.",
        },
      }));
      return;
    }

    setSshTestResults((current) => ({
      ...current,
      [agent.clientId]: {
        status: "testing",
        message: "Testing SSH connectivity...",
      },
    }));

    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "test-ssh",
          ssh_host: sshHost,
          ssh_user: sshUser,
          ssh_port: sshPort || undefined,
          ssh_key_path: sshKeyPath || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSshTestResults((current) => ({
          ...current,
          [agent.clientId]: {
            status: "error",
            message: data.error || "SSH test failed.",
          },
        }));
        return;
      }

      setSshTestResults((current) => ({
        ...current,
        [agent.clientId]: {
          status: "success",
          message: data.output || "SSH connection successful.",
        },
      }));
    } catch {
      setSshTestResults((current) => ({
        ...current,
        [agent.clientId]: {
          status: "error",
          message: "Connection error while testing SSH.",
        },
      }));
    }
  }

  async function handleStep1() {
    if (!orgName.trim() || !adminEmail.trim()) {
      setError("Organization name and email are required.");
      return;
    }
    if (password && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "account",
          org_name: orgName.trim(),
          admin_email: adminEmail.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account.");
        return;
      }
      setStep(2);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    const trimmedAgents = agents.map((agent) => ({
      ...agent,
      name: agent.name.trim(),
      description: agent.description.trim(),
      sshHost: agent.sshHost.trim(),
      sshUser: agent.sshUser.trim(),
      sshPort: agent.sshPort.trim(),
      sshKeyPath: agent.sshKeyPath.trim(),
      nodeName: agent.nodeName.trim(),
      configPath: agent.configPath.trim(),
      serviceName: agent.serviceName.trim(),
      runtimeUser: agent.runtimeUser.trim(),
    }));

    if (trimmedAgents.some((agent) => !agent.name)) {
      setError("Every agent needs a name.");
      return;
    }
    if (
      trimmedAgents.some(
        (agent) =>
          (agent.installMode === "remote" || agent.installMode === "both") &&
          (!agent.sshHost || !agent.sshUser)
      )
    ) {
      setError("SSH host and SSH user are required for remote deployment.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "agent",
          agents: trimmedAgents.map((agent) => ({
            name: agent.name,
            description: agent.description,
            framework: agent.framework,
            install_mode: agent.installMode,
            ssh_host: agent.sshHost || undefined,
            ssh_user: agent.sshUser || undefined,
            ssh_port: agent.sshPort || undefined,
            ssh_key_path: agent.sshKeyPath || undefined,
            node_name: agent.nodeName || undefined,
            config_path: agent.configPath || undefined,
            service_name: agent.serviceName || undefined,
            runtime_user: agent.runtimeUser || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to register agent.");
        return;
      }
      const data = (await res.json()) as { agents?: RegisteredAgent[] };
      const nextAgents = data.agents ?? [];
      setRegisteredAgents(nextAgents);
      setSelectedAgentId(nextAgents[0]?.agent_id ?? "");
      setEventReceived(false);
      setListening(false);
      setStep(3);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function retryDeployment(agent: RegisteredAgent) {
    const retryKey = agent.agent_id;
    setRetryDeployResults((current) => ({
      ...current,
      [retryKey]: {
        status: "loading",
        message: "Retrying remote deployment...",
      },
    }));
    setError("");

    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "retry-deploy",
          agent_id: agent.agent_id,
          token: agent.token,
          framework: agent.framework,
          install_mode: agent.install_mode,
          config_path: agent.config_path,
          service_name: agent.service_name ?? undefined,
          ssh_host: agent.ssh_host ?? undefined,
          ssh_user: agent.ssh_user ?? undefined,
          ssh_port: agent.ssh_port ?? undefined,
          ssh_key_path: agent.ssh_key_path ?? undefined,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        install_snippet?: string;
        deployment?: RegisteredAgent["deployment"];
      };

      if (!res.ok || !data.deployment) {
        setRetryDeployResults((current) => ({
          ...current,
          [retryKey]: {
            status: "error",
            message: data.error || "Failed to retry deployment.",
          },
        }));
        return;
      }

      setRegisteredAgents((current) =>
        current.map((item) =>
          item.agent_id === agent.agent_id
            ? {
                ...item,
                install_snippet: data.install_snippet || item.install_snippet,
                deployment: data.deployment,
              }
            : item
        )
      );
      setRetryDeployResults((current) => ({
        ...current,
        [retryKey]: {
          status: data.deployment?.ok ? "success" : "error",
          message: data.deployment?.ok
            ? data.deployment.output || "Deployment retried successfully."
            : data.deployment?.error || "Deployment still needs attention.",
        },
      }));
    } catch {
      setRetryDeployResults((current) => ({
        ...current,
        [retryKey]: {
          status: "error",
          message: "Connection error. Please try again.",
        },
      }));
    }
  }

  function startListening() {
    if (!currentAgent?.agent_id) return;
    setListening(true);
    setEventReceived(false);

    // Poll for events from this agent
    const start = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const since = new Date(start).toISOString();
        const res = await fetch(
          `/api/dashboard/activity?agent_id=${currentAgent.agent_id}&since=${since}&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.events && data.events.length > 0) {
            setEventReceived(true);
            setListening(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // Silent — keep polling
      }

      // Timeout after 2 minutes
      if (Date.now() - start > 120000) {
        setListening(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }

  async function sendTestEvent() {
    if (!currentAgent?.token) return;
    try {
      const baseUrl = window.location.origin;
      await fetch(`${baseUrl}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentAgent.token}`,
        },
        body: JSON.stringify({
          agent_id: currentAgent.agent_id,
          type: "message_sent",
          content: "Hello from HiTechClaw AI setup wizard! This is a test event.",
          metadata: { source: "setup-wizard", test: true },
        }),
      });
    } catch {
      // Silent — the polling will detect it
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "complete" }),
      });
      router.push("/?tour=1");
    } catch {
      router.push("/");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
      {/* Background effects */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0, 212, 126, 0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(0,212,126,0.06), transparent 60%), radial-gradient(ellipse at 50% 80%, rgba(0,212,126,0.04), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo + progress */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)]">
            <span className="text-2xl font-bold text-[var(--accent)]">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 && "Welcome to HiTechClaw AI"}
            {step === 2 && "Register Your Agents"}
            {step === 3 && "Install and Configure Agents"}
            {step === 4 && "Send Your First Event"}
            {step === 5 && "You're All Set!"}
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            AI Control Plane
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  i + 1 <= step
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--bg-surface-2)]"
                }`}
              />
            </div>
          ))}
          <span className="ml-2 text-xs text-[var(--text-tertiary)]">
            {step}/{TOTAL_STEPS}
          </span>
        </div>

        {/* Step content */}
        <div className="relative card-hover rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Step 1: Account ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Let&apos;s get your governance platform running in a few minutes.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme AI Labs"
                  autoFocus
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                />
              </div>
              <button
                type="button"
                onClick={handleStep1}
                disabled={loading || !orgName.trim() || !adminEmail.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Step 2: Register Agent ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Provision multiple agents now. OpenClaw and NemoClaw can be configured in parallel without token or config conflicts.
              </p>
              <div className="space-y-4">
                {agents.map((agent, index) => {
                  const needsRemoteFields =
                    agent.installMode === "remote" || agent.installMode === "both";
                  const sshTest = sshTestResults[agent.clientId];

                  return (
                    <div
                      key={agent.clientId}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Agent {index + 1}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            Isolated token, config path, and deployment status.
                          </p>
                        </div>
                        {agents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAgentDraft(agent.clientId)}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                            Agent Name
                          </label>
                          <input
                            type="text"
                            value={agent.name}
                            onChange={(e) => updateDraft(agent.clientId, { name: e.target.value })}
                            placeholder="e.g. Lumina, Atlas, Support Bot"
                            autoFocus={index === 0}
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                            Description <span className="text-[var(--text-tertiary)]">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={agent.description}
                            onChange={(e) => updateDraft(agent.clientId, { description: e.target.value })}
                            placeholder="What does this agent do?"
                            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                            Framework
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {FRAMEWORKS.map((fw) => (
                              <button
                                key={fw.value}
                                type="button"
                                onClick={() => updateFramework(agent.clientId, fw.value)}
                                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                  agent.framework === fw.value
                                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                                    : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                                }`}
                              >
                                {fw.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                            Install Mode
                          </label>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {INSTALL_MODES.map((mode) => (
                              <button
                                key={mode.value}
                                type="button"
                                onClick={() => updateDraft(agent.clientId, { installMode: mode.value })}
                                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                  agent.installMode === mode.value
                                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                                    : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                                }`}
                              >
                                <span className="block font-medium">{mode.label}</span>
                                <span className="mt-1 block text-[11px] leading-4 text-[var(--text-tertiary)]">
                                  {mode.description}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {needsRemoteFields && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                SSH Host
                              </label>
                              <input
                                type="text"
                                value={agent.sshHost}
                                onChange={(e) => updateDraft(agent.clientId, { sshHost: e.target.value })}
                                placeholder="192.168.1.20 or server.example.com"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                SSH User
                              </label>
                              <input
                                type="text"
                                value={agent.sshUser}
                                onChange={(e) => updateDraft(agent.clientId, { sshUser: e.target.value })}
                                placeholder="ubuntu"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                SSH Port <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={agent.sshPort}
                                onChange={(e) => updateDraft(agent.clientId, { sshPort: e.target.value })}
                                placeholder="22"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                SSH Key Path <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={agent.sshKeyPath}
                                onChange={(e) => updateDraft(agent.clientId, { sshKeyPath: e.target.value })}
                                placeholder="~/.ssh/id_rsa"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                Node Name <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={agent.nodeName}
                                onChange={(e) => updateDraft(agent.clientId, { nodeName: e.target.value })}
                                placeholder="Production GPU Node"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                Service Name <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={agent.serviceName}
                                onChange={(e) => updateDraft(agent.clientId, { serviceName: e.target.value })}
                                placeholder={agent.framework === "openclaw" ? "openclaw-gateway.service" : "nemoclaw.service"}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                Runtime User <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={agent.runtimeUser}
                                onChange={(e) => updateDraft(agent.clientId, { runtimeUser: e.target.value })}
                                placeholder={agent.framework === "openclaw" ? "openclaw" : "nemoclaw"}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                                Config Path <span className="text-[var(--text-tertiary)]">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={agent.configPath}
                                onChange={(e) => updateDraft(agent.clientId, { configPath: e.target.value })}
                                placeholder={agent.framework === "openclaw" ? "~/.openclaw/my-agent.env" : agent.framework === "nemoclaw" ? "~/.nemoclaw/my-agent.yaml" : "~/.hitechclaw/my-agent.env"}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-white placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[#00D47E]/50 transition"
                              />
                            </div>
                            <div className="sm:col-span-2 space-y-2">
                              <button
                                type="button"
                                onClick={() => testSshConnection(agent)}
                                disabled={!agent.sshHost.trim() || !agent.sshUser.trim() || sshTest?.status === "testing"}
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {sshTest?.status === "testing" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                Test SSH connection
                              </button>
                              {sshTest && (
                                <div
                                  className={`rounded-lg border px-3 py-2 text-xs ${
                                    sshTest.status === "success"
                                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--text-secondary)]"
                                      : sshTest.status === "error"
                                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                                        : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                                  }`}
                                >
                                  {sshTest.message}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addAgentDraft}
                className="w-full rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
              >
                + Add another agent
              </button>

              <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 text-xs leading-5 text-[var(--text-secondary)]">
                Use separate config paths and service names when OpenClaw and NemoClaw share the same host. The wizard will generate unique tokens per agent automatically.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2}
                  disabled={loading || agents.some((agent) => !agent.name.trim())}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Register Agents
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: SDK Install ────────────────────────────────────── */}
          {step === 3 && (
            <SdkStep
              agents={registeredAgents}
              retryDeployResults={retryDeployResults}
              onRetryDeployment={retryDeployment}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {/* ── Step 4: First Event ────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {registeredAgents.length > 1 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Agent to validate
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {registeredAgents.map((agent) => (
                      <button
                        key={agent.agent_id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(agent.agent_id);
                          setEventReceived(false);
                          setListening(false);
                          if (pollRef.current) clearInterval(pollRef.current);
                        }}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          currentAgent?.agent_id === agent.agent_id
                            ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                            : "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {eventReceived ? (
                <div className="flex flex-col items-center py-4">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10">
                    <PartyPopper className="h-8 w-8 text-[var(--accent)]" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Event Received!</h3>
                  <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                    {currentAgent?.name || "Your agent"} is connected and sending events to HiTechClaw AI.
                  </p>
                  <ConfettiEffect />
                </div>
              ) : listening ? (
                <div className="flex flex-col items-center py-6">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--accent)]/30">
                    <Zap className="h-8 w-8 animate-pulse text-[var(--accent)]" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Listening for your first event...
                  </h3>
                  <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
                    Send an event from {currentAgent?.name || "your agent"}, or use the test button below.
                  </p>
                  <div className="mt-4 flex h-1 w-48 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
                    <div className="animate-[shimmer_2s_ease-in-out_infinite] h-full w-1/3 rounded-full bg-[var(--accent)]/60" />
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    Let&apos;s verify the connection. Click &quot;Start Listening&quot; then send
                    an event from {currentAgent?.name || "your agent"} — or use the test button.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                {!listening && !eventReceived && (
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={!currentAgent}
                    className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                  >
                    <Zap className="h-4 w-4" />
                    Start Listening
                  </button>
                )}
                {(listening || !eventReceived) && !eventReceived && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!listening) startListening();
                      sendTestEvent();
                    }}
                    disabled={!currentAgent}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Send Test Event
                  </button>
                )}
              </div>

              {!listening && !eventReceived && (
                <p className="text-center text-xs text-[var(--text-tertiary)]">
                  Haven&apos;t received an event? Check your agent configuration and try again.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition active:scale-[0.98] ${
                    eventReceived
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-dim)]"
                      : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/[0.03]"
                  }`}
                >
                  {eventReceived ? "Continue" : "Skip for now"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: What's Next ────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Your governance platform is ready. Here&apos;s what to explore:
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <FeatureCard
                  icon={ShieldCheck}
                  title="ThreatGuard"
                  description="Detect threats in agent activity"
                  href="/security"
                />
                <FeatureCard
                  icon={Wallet}
                  title="Costs"
                  description="Track spending by agent & model"
                  href="/costs"
                />
                <FeatureCard
                  icon={Workflow}
                  title="Workflows"
                  description="Automate your agent operations"
                  href="/workflows"
                />
                <FeatureCard
                  icon={Network}
                  title="Infrastructure"
                  description="Monitor your servers"
                  href="/infrastructure"
                />
                <FeatureCard
                  icon={Bot}
                  title="Agent Profile"
                  description="View & configure your agent"
                  href={registeredAgents[0]?.agent_id ? `/agent/${registeredAgents[0].agent_id}` : "/agents"}
                />
                <FeatureCard
                  icon={BookOpen}
                  title="Documentation"
                  description="Learn more about HiTechClaw AI"
                  href="/tools/docs"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-dim)] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Go to Dashboard
                      <Rocket className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
          Powered by HiTechClaw AI
        </p>
      </div>
    </div>
  );
}

/* ── SDK Install Step (Step 3) ─────────────────────────────────────────────── */

function SdkStep({
  agents,
  retryDeployResults,
  onRetryDeployment,
  onBack,
  onNext,
}: {
  agents: RegisteredAgent[];
  retryDeployResults: Record<string, RetryDeployState>;
  onRetryDeployment: (agent: RegisteredAgent) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  type InstallTab = "script" | "node" | "python" | "curl" | "openclaw" | "nemoclaw";
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.agent_id ?? "");
  const [manualTab, setManualTab] = useState<InstallTab | null>(null);
  const effectiveSelectedAgentId =
    agents.some((agent) => agent.agent_id === selectedAgentId)
      ? selectedAgentId
      : (agents[0]?.agent_id ?? "");
  const selectedAgent = agents.find((agent) => agent.agent_id === effectiveSelectedAgentId) ?? agents[0];
  const framework = selectedAgent?.framework ?? "custom";
  const preferredTab: InstallTab =
    framework === "openclaw" || framework === "nemoclaw" ? framework : "script";
  const tab: InstallTab = manualTab ?? preferredTab;
  const [baseUrl, setBaseUrl] = useState("https://your-hitechclaw-ai-instance.com");
  const agentLabel = selectedAgent?.name?.trim() || selectedAgent?.agent_id || "your-agent";

  useEffect(() => {
    const baseUrlTimer = window.setTimeout(() => {
      setBaseUrl(window.location.origin);
    }, 0);

    return () => {
      window.clearTimeout(baseUrlTimer);
    };
  }, []);

  const snippets: Record<InstallTab, { label: string; code: string; description: string }> = {
    script: {
      label: "Provisioning script",
      description: "Generated setup script for this specific agent, including the unique token and config path.",
      code: selectedAgent?.install_snippet || "# No install snippet available",
    },
    curl: {
      label: "Shell / curl",
      description: "Raw HTTP ingestion for any custom agent or quick smoke testing.",
      code: `curl -X POST ${baseUrl}/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedAgent?.token || "YOUR_TOKEN"}" \
  -d '{
    "agent_id": "your-agent",
    "event_type": "message_sent",
    "content": "Hello from my agent!"
  }'`,
    },
    node: {
      label: "Node.js",
      description: "Example application-side integration for a JavaScript or TypeScript agent.",
      code: `// npm install @hitechclaw-ai/sdk
import { HiTechClawAI } from "@hitechclaw-ai/sdk";

const hitechclaw = new HiTechClawAI({
  baseUrl: "${baseUrl}",
  token: "${selectedAgent?.token || "YOUR_TOKEN"}",
});

await hitechclaw.track("message_sent", {
  content: "Hello from my agent!",
});`,
    },
    python: {
      label: "Python",
      description: "Example application-side integration for Python-based agents and workers.",
      code: `# pip install hitechclaw-ai-sdk
from hitechclaw_ai import HiTechClawAI

hitechclaw_ai = HiTechClawAI(
    base_url="${baseUrl}",
  token="${selectedAgent?.token || "YOUR_TOKEN"}",
)

hitechclaw_ai.track("message_sent",
    content="Hello from my agent!",
)`,
    },
    openclaw: {
      label: "OpenClaw",
      description: "Bootstrap an OpenClaw agent from first setup with the generated HiTechClaw AI token.",
      code: `# 1) On the machine that runs your OpenClaw agent
cd /path/to/your/openclaw-agent

# 2) Create or update the agent .env used by OpenClaw
#    Paste the generated token from this setup wizard.
cat >> .env <<'EOF'
MC_INGEST_URL=${baseUrl}/api/ingest
MC_AGENT_TOKEN=${selectedAgent?.token || "YOUR_TOKEN"}
EOF

# 3) Restart OpenClaw so it reloads telemetry settings
systemctl --user restart openclaw-gateway.service

# 4) Return to the setup wizard and click "Send Test Event"
#    Registered agent: ${agentLabel}

# OpenClaw will now forward telemetry to HiTechClaw AI.`,
    },
    nemoclaw: {
      label: "NemoClaw",
      description: "Configure NemoClaw telemetry during first-time onboarding with a ready-to-paste block.",
      code: `# 1) Open your NemoClaw runtime config (for example nemoclaw.yaml)

# 2) Add or merge the telemetry block below
telemetry:
  endpoint: ${baseUrl}/api/ingest
  token: ${selectedAgent?.token || "YOUR_TOKEN"}

# 3) Restart or reload your NemoClaw runtime

# 4) Return to the setup wizard and click "Send Test Event"
#    Registered agent: ${agentLabel}

# NemoClaw will automatically report to HiTechClaw AI.`,
    },
  };

  const frameworkGuide =
    framework === "openclaw"
      ? {
          title: "Recommended path for OpenClaw",
          summary: "Use the generated token to wire OpenClaw telemetry before leaving the setup wizard.",
          steps: [
            "Copy the OpenClaw block below into the agent host .env file.",
            "Restart the OpenClaw gateway or agent process so the new telemetry variables are loaded.",
            "Return to step 4 in the wizard and use Start Listening or Send Test Event.",
          ],
        }
      : framework === "nemoclaw"
        ? {
            title: "Recommended path for NemoClaw",
            summary: "Paste the telemetry block into your NemoClaw config and validate event flow immediately.",
            steps: [
              "Merge the telemetry snippet into your NemoClaw YAML or runtime configuration.",
              "Restart or reload NemoClaw so it begins sending telemetry to HiTechClaw AI.",
              "Return to step 4 in the wizard and confirm the first event arrives.",
            ],
          }
        : null;

  return (
    <div className="space-y-4">
      {agents.length > 1 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Agent package
          </label>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <button
                key={agent.agent_id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.agent_id);
                  setManualTab(null);
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  selectedAgent?.agent_id === agent.agent_id
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        Connect {selectedAgent?.name || "your agent"} to HiTechClaw AI. Choose your integration method:
      </p>

      {frameworkGuide && (
        <div className="relative card-hover rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
          <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[var(--accent)]">{frameworkGuide.title}</p>
          </div>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{frameworkGuide.summary}</p>
          <ol className="mt-3 space-y-1.5 pl-4 text-xs leading-5 text-[var(--text-secondary)] list-decimal">
            {frameworkGuide.steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Token display */}
      <div className="relative card-hover rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3">
        <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--accent)]">Your API Token</span>
          <CopyButton text={selectedAgent?.token || ""} />
        </div>
        <code className="block break-all text-xs text-[var(--text-secondary)]">{selectedAgent?.token}</code>
        <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">
          Save this token — you won&apos;t see it again after leaving this page.
        </p>
      </div>

      {selectedAgent && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-[var(--text-tertiary)]">Agent ID</span>
              <p className="mt-1 break-all font-medium text-white">{selectedAgent.agent_id}</p>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Install mode</span>
              <p className="mt-1 font-medium capitalize text-white">{selectedAgent.install_mode}</p>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Config path</span>
              <p className="mt-1 break-all font-medium text-white">{selectedAgent.config_path}</p>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Deployment</span>
              <p className={`mt-1 font-medium ${selectedAgent.deployment?.ok ? "text-[var(--accent)]" : "text-amber-300"}`}>
                {selectedAgent.deployment?.ok ? "Applied or ready" : selectedAgent.deployment?.error ? "Needs attention" : "Script ready"}
              </p>
            </div>
            {(selectedAgent.ssh_host || selectedAgent.ssh_port || selectedAgent.ssh_key_path) && (
              <>
                <div>
                  <span className="text-[var(--text-tertiary)]">SSH target</span>
                  <p className="mt-1 break-all font-medium text-white">
                    {selectedAgent.ssh_user ? `${selectedAgent.ssh_user}@` : ""}
                    {selectedAgent.ssh_host}
                    {selectedAgent.ssh_port ? `:${selectedAgent.ssh_port}` : ""}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">SSH key / runtime user</span>
                  <p className="mt-1 break-all font-medium text-white">
                    {selectedAgent.ssh_key_path || "Default SSH agent"}
                    {selectedAgent.runtime_user ? ` · ${selectedAgent.runtime_user}` : ""}
                  </p>
                </div>
              </>
            )}
          </div>
          {selectedAgent.deployment?.error && (
            <div className="mt-3 space-y-3">
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
                {selectedAgent.deployment.error}
              </p>
              {(selectedAgent.install_mode === "remote" || selectedAgent.install_mode === "both") && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => onRetryDeployment(selectedAgent)}
                    disabled={retryDeployResults[selectedAgent.agent_id]?.status === "loading"}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {retryDeployResults[selectedAgent.agent_id]?.status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Retry deployment
                  </button>
                  {retryDeployResults[selectedAgent.agent_id] && (
                    <p
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        retryDeployResults[selectedAgent.agent_id]?.status === "success"
                          ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--text-secondary)]"
                          : retryDeployResults[selectedAgent.agent_id]?.status === "error"
                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                            : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {retryDeployResults[selectedAgent.agent_id]?.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {!selectedAgent.deployment?.error && selectedAgent.deployment?.output && (
            <p className="mt-3 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2 text-[var(--text-secondary)]">
              {selectedAgent.deployment.output}
            </p>
          )}
        </div>
      )}

      {/* Tab selector */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(snippets) as Array<keyof typeof snippets>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setManualTab(key as InstallTab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === key
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {snippets[key].label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        {snippets[tab].description}
        {(tab === "openclaw" || tab === "nemoclaw") && framework === tab && " This matches the framework you selected in step 2."}
      </p>

      {/* Code block */}
      <div className="relative card-hover rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
        <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
        <div className="absolute right-2 top-2">
          <CopyButton text={snippets[tab].code} />
        </div>
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
          <code>{snippets[tab].code}</code>
        </pre>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.03]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-dim)] active:scale-[0.98]"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full text-center text-xs text-[var(--text-tertiary)] transition hover:text-[var(--text-secondary)]"
      >
        Skip this step — I&apos;ll set up later
      </button>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[var(--text-tertiary)] transition hover:bg-white/[0.05] hover:text-[var(--text-secondary)]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-[var(--accent)]" />
          <span className="text-[var(--accent)]">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="relative card-hover flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-primary)]"
    >
      <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
      <Icon className="h-5 w-5 text-[var(--accent)]" />
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-[11px] leading-4 text-[var(--text-tertiary)]">{description}</p>
      </div>
    </a>
  );
}

function ConfettiEffect() {
  const colors = ["#00D47E", "#00D47E", "#f59e0b", "#06b6d4", "#ef4444"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="absolute animate-[confetti_1.5s_ease-out_forwards]"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 17) % 40}%`,
            width: `${6 + ((i * 13) % 6)}px`,
            height: `${6 + ((i * 19) % 6)}px`,
            backgroundColor: colors[i % colors.length],
            borderRadius: i % 3 === 0 ? "50%" : "2px",
            animationDelay: `${((i * 7) % 5) / 10}s`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
