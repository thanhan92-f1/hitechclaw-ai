import { type NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { query } from "@/lib/db";

const execAsync = promisify(exec);

type SetupFramework = "openclaw" | "nemoclaw" | "crewai" | "autogen" | "custom";
type InstallMode = "remote" | "script" | "both";

type SetupAgentInput = {
  name?: string;
  description?: string;
  framework?: string;
  install_mode?: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_port?: number | string;
  ssh_key_path?: string;
  node_name?: string;
  config_path?: string;
  service_name?: string;
  runtime_user?: string;
};

type SetupSshTestInput = {
  ssh_host?: string;
  ssh_user?: string;
  ssh_port?: number | string;
  ssh_key_path?: string;
};

type SshOptions = {
  user: string;
  host: string;
  port?: number;
  keyPath?: string;
};

type SetupRetryDeployInput = {
  agent_id?: string;
  framework?: string;
  token?: string;
  install_mode?: string;
  config_path?: string;
  service_name?: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_port?: number | string;
  ssh_key_path?: string;
};

type DeploymentResult = {
  ok: boolean;
  mode: InstallMode;
  output?: string;
  error?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `agent-${randomBytes(4).toString("hex")}`;
}

async function executeDeployment(args: {
  installMode: InstallMode;
  installSnippet: string;
  sshHost?: string;
  sshUser?: string;
  sshPort?: number;
  sshKeyPath?: string;
}): Promise<DeploymentResult> {
  const { installMode, installSnippet, sshHost, sshUser, sshPort, sshKeyPath } = args;

  if ((installMode === "remote" || installMode === "both") && sshHost && sshUser) {
    try {
      const connection = await testRemoteConnection({
        host: sshHost,
        user: sshUser,
        port: sshPort,
        keyPath: sshKeyPath,
      });
      const remote = await runRemoteInstall(
        {
          host: sshHost,
          user: sshUser,
          port: sshPort,
          keyPath: sshKeyPath,
        },
        installSnippet
      );
      return {
        ok: true,
        mode: installMode,
        output:
          [connection.stdout, remote.stdout, remote.stderr].filter(Boolean).join("\n") ||
          "Configuration applied",
      };
    } catch (error) {
      return {
        ok: false,
        mode: installMode,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (installMode !== "script") {
    return {
      ok: false,
      mode: installMode,
      error: "SSH host and SSH user are required for remote deployment",
    };
  }

  return {
    ok: true,
    mode: installMode,
  };
}

function normalizeFramework(value: string | undefined): SetupFramework {
  const framework = (value ?? "custom").toLowerCase();
  if (framework === "openclaw" || framework === "nemoclaw" || framework === "crewai" || framework === "autogen") {
    return framework;
  }
  return "custom";
}

function normalizeInstallMode(value: string | undefined): InstallMode {
  return value === "remote" || value === "both" ? value : "script";
}

function defaultConfigPath(framework: SetupFramework, agentId: string) {
  if (framework === "openclaw") return `~/.openclaw/${agentId}.env`;
  if (framework === "nemoclaw") return `~/.nemoclaw/${agentId}.yaml`;
  return `~/.hitechclaw/${agentId}.env`;
}

function buildInstallSnippet(args: {
  framework: SetupFramework;
  baseUrl: string;
  agentId: string;
  token: string;
  configPath: string;
  serviceName?: string;
}) {
  const { framework, baseUrl, agentId, token, configPath, serviceName } = args;
  if (framework === "openclaw") {
    return `mkdir -p "$(dirname '${configPath}')"
cat > "${configPath}" <<'EOF'
MC_INGEST_URL=${baseUrl}/api/ingest
MC_AGENT_TOKEN=${token}
EOF
${serviceName ? `systemctl --user restart ${serviceName}` : `# Restart your OpenClaw runtime after writing ${configPath}`}
# Agent: ${agentId}`;
  }
  if (framework === "nemoclaw") {
    return `mkdir -p "$(dirname '${configPath}')"
cat > "${configPath}" <<'EOF'
telemetry:
  endpoint: ${baseUrl}/api/ingest
  token: ${token}
EOF
${serviceName ? `systemctl --user restart ${serviceName}` : `# Reload your NemoClaw runtime after writing ${configPath}`}
# Agent: ${agentId}`;
  }
  return `curl -X POST ${baseUrl}/api/ingest \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event_type":"message_sent","content":"Hello from ${agentId}"}'`;
}

async function runRemoteCommand(host: string, user: string, command: string) {
  const sshCommand = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${user}@${host} ${JSON.stringify(command)}`;
  const { stdout, stderr } = await execAsync(sshCommand, { timeout: 30000 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function normalizeSshPort(value: number | string | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function buildSshCommand({ user, host, port, keyPath }: SshOptions, command: string) {
  const parts = ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no"];
  if (port) {
    parts.push("-p", String(port));
  }
  if (keyPath) {
    parts.push("-i", JSON.stringify(keyPath));
  }
  parts.push(`${user}@${host}`, JSON.stringify(command));
  return parts.join(" ");
}

async function testRemoteConnection(options: SshOptions) {
  const sshCommand = buildSshCommand(options, "echo hitechclaw-setup-ok");
  const { stdout, stderr } = await execAsync(sshCommand, { timeout: 15000 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

async function runRemoteInstall(options: SshOptions, command: string) {
  const sshCommand = buildSshCommand(options, command);
  const { stdout, stderr } = await execAsync(sshCommand, { timeout: 30000 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

async function upsertInfraNode(args: {
  nodeName: string;
  host: string;
  sshUser?: string;
  sshPort?: number;
  sshKeyPath?: string;
  framework: SetupFramework;
  runtimeUser?: string;
}) {
  const nodeId = slugify(args.nodeName || args.host);
  await query(
    `INSERT INTO infra_nodes (id, name, ip, ssh_user, role, tenant_id, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'workstation', 'default', $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       ip = EXCLUDED.ip,
       ssh_user = EXCLUDED.ssh_user,
       metadata = infra_nodes.metadata || EXCLUDED.metadata,
       updated_at = NOW()`,
    [
      nodeId,
      args.nodeName,
      args.host,
      args.sshUser ?? null,
      JSON.stringify({
        frameworks: [args.framework],
        provisioned_by: "setup-wizard",
        ssh_port: args.sshPort ?? null,
        ssh_key_path: args.sshKeyPath ?? null,
        openclaw_user: args.runtimeUser ?? null,
      }),
    ]
  );
  return nodeId;
}

/**
 * POST /api/setup/complete — public endpoint (only works if setup not yet done)
 * Handles setup wizard completion:
 *   - Step 1: Create org (update tenant name + admin email)
 *   - Step 2: Register first agent, return token
 *   - Step 5: Mark setup as complete
 */
export async function POST(req: NextRequest) {
  // Guard: only allow if setup is not yet complete
  const check = await query(
    "SELECT setup_completed FROM tenants WHERE id = 'default' LIMIT 1"
  );
  const rows = check.rows as Array<{ setup_completed: boolean }>;
  if (rows.length > 0 && rows[0].setup_completed) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { step } = body;
  const baseUrl = process.env.HITECHCLAW_AI_BASE_URL || req.nextUrl.origin;

  switch (step) {
    case "account": {
      const { org_name, admin_email } = body;
      if (!org_name || !admin_email) {
        return NextResponse.json(
          { error: "org_name and admin_email are required" },
          { status: 400 }
        );
      }
      await query(
        "UPDATE tenants SET name = $1, admin_email = $2, updated_at = NOW() WHERE id = 'default'",
        [org_name.trim(), admin_email.trim()]
      );
      return NextResponse.json({ ok: true });
    }

    case "test-ssh": {
      const sshBody = body as SetupSshTestInput;
      const sshHost = sshBody.ssh_host?.trim();
      const sshUser = sshBody.ssh_user?.trim();
      const sshPort = normalizeSshPort(sshBody.ssh_port);
      const sshKeyPath = sshBody.ssh_key_path?.trim() || undefined;

      if (!sshHost || !sshUser) {
        return NextResponse.json(
          { error: "ssh_host and ssh_user are required" },
          { status: 400 }
        );
      }

      try {
        const result = await testRemoteConnection({
          host: sshHost,
          user: sshUser,
          port: sshPort,
          keyPath: sshKeyPath,
        });

        return NextResponse.json({
          ok: true,
          ssh_host: sshHost,
          ssh_user: sshUser,
          ssh_port: sshPort ?? null,
          ssh_key_path: sshKeyPath ?? null,
          output: result.stdout || result.stderr || "SSH connection successful",
        });
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            ssh_host: sshHost,
            ssh_user: sshUser,
            ssh_port: sshPort ?? null,
            ssh_key_path: sshKeyPath ?? null,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 400 }
        );
      }
    }

    case "agent": {
      const rawAgents: SetupAgentInput[] = Array.isArray(body.agents)
        ? body.agents as SetupAgentInput[]
        : [{
            name: body.agent_name,
            description: body.agent_description,
            framework: body.framework,
            install_mode: body.install_mode,
            ssh_host: body.ssh_host,
            ssh_user: body.ssh_user,
            ssh_port: body.ssh_port,
            ssh_key_path: body.ssh_key_path,
            node_name: body.node_name,
            config_path: body.config_path,
            service_name: body.service_name,
            runtime_user: body.runtime_user,
          } satisfies SetupAgentInput];

      const agents = rawAgents.filter((agent): agent is SetupAgentInput => typeof agent?.name === "string" && agent.name.trim().length > 0);
      if (agents.length === 0) {
        return NextResponse.json(
          { error: "At least one agent is required" },
          { status: 400 }
        );
      }

      const results = [];
      for (let index = 0; index < agents.length; index += 1) {
        const item = agents[index];
        const normalizedName = item.name!.trim();
        const framework = normalizeFramework(item.framework);
        const installMode = normalizeInstallMode(item.install_mode);
        const baseId = slugify(normalizedName);
        const agentId = index === 0 ? baseId : `${baseId}-${index + 1}`;
        const token = `ark_${randomBytes(24).toString("hex")}`;
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const description = (item.description || "").trim();
        const configPath = item.config_path?.trim() || defaultConfigPath(framework, agentId);
        const serviceName = item.service_name?.trim() || undefined;
        const sshHost = item.ssh_host?.trim() || undefined;
        const sshUser = item.ssh_user?.trim() || undefined;
        const sshPort = normalizeSshPort(item.ssh_port);
        const sshKeyPath = item.ssh_key_path?.trim() || undefined;
        const nodeName = item.node_name?.trim() || normalizedName;
        const runtimeUser = item.runtime_user?.trim() || undefined;

        const existing = await query("SELECT id FROM agents WHERE id = $1 LIMIT 1", [agentId]);
        if ((existing.rows as Array<{ id: string }>).length > 0) {
          await query(
            `UPDATE agents
             SET token_hash = $1,
                 name = $2,
                 description = $3,
                 framework = $4,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                 updated_at = NOW()
             WHERE id = $6`,
            [
              tokenHash,
              normalizedName,
              description,
              framework,
              JSON.stringify({
                install_mode: installMode,
                ssh_host: sshHost,
                ssh_user: sshUser,
                ssh_port: sshPort,
                ssh_key_path: sshKeyPath,
                config_path: configPath,
                service_name: serviceName,
                runtime_user: runtimeUser,
              }),
              agentId,
            ]
          );
        } else {
          await query(
            `INSERT INTO agents (id, name, description, framework, token_hash, tenant_id, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'default', $6, NOW(), NOW())`,
            [
              agentId,
              normalizedName,
              description,
              framework,
              tokenHash,
              JSON.stringify({
                install_mode: installMode,
                ssh_host: sshHost,
                ssh_user: sshUser,
                ssh_port: sshPort,
                ssh_key_path: sshKeyPath,
                config_path: configPath,
                service_name: serviceName,
                runtime_user: runtimeUser,
              }),
            ]
          );
        }

        let nodeId: string | null = null;
        if (sshHost) {
          nodeId = await upsertInfraNode({
            nodeName,
            host: sshHost,
            sshUser,
            sshPort,
            sshKeyPath,
            framework,
            runtimeUser,
          });
        }

        const installSnippet = buildInstallSnippet({
          framework,
          baseUrl,
          agentId,
          token,
          configPath,
          serviceName,
        });

        let deployment: { ok: boolean; mode: InstallMode; output?: string; error?: string } = {
          ok: installMode === "script",
          mode: installMode,
        };

        if ((installMode === "remote" || installMode === "both") && sshHost && sshUser) {
          try {
            const connection = await testRemoteConnection({
              host: sshHost,
              user: sshUser,
              port: sshPort,
              keyPath: sshKeyPath,
            });
            const remote = await runRemoteInstall({
              host: sshHost,
              user: sshUser,
              port: sshPort,
              keyPath: sshKeyPath,
            }, installSnippet);
            deployment = {
              ok: true,
              mode: installMode,
              output: [connection.stdout, remote.stdout, remote.stderr].filter(Boolean).join("\n") || "Configuration applied",
            };
          } catch (error) {
            deployment = {
              ok: false,
              mode: installMode,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        } else if (installMode !== "script") {
          deployment = {
            ok: false,
            mode: installMode,
            error: "SSH host and SSH user are required for remote deployment",
          };
        }

        results.push({
          name: normalizedName,
          agent_id: agentId,
          token,
          framework,
          install_mode: installMode,
          config_path: configPath,
          service_name: serviceName ?? null,
          ssh_host: sshHost ?? null,
          ssh_user: sshUser ?? null,
          ssh_port: sshPort ?? null,
          ssh_key_path: sshKeyPath ?? null,
          runtime_user: runtimeUser ?? null,
          node_id: nodeId,
          install_snippet: installSnippet,
          deployment,
        });
      }

      return NextResponse.json({ ok: true, agents: results, agent_id: results[0]?.agent_id, token: results[0]?.token });
    }

    case "complete": {
      await query(
        "UPDATE tenants SET setup_completed = TRUE, updated_at = NOW() WHERE id = 'default'"
      );
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }
}
