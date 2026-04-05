import nodemailer, { type Transporter } from "nodemailer";
import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/notification-secrets";

interface EmailDispatchParams {
  tenantId: string;
  config: Record<string, unknown>;
  subject: string;
  text: string;
  html?: string;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function getString(config: Record<string, unknown>, key: string, fallbackEnv?: string): string {
  const configured = config[key];
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  return fallbackEnv ? (process.env[fallbackEnv]?.trim() ?? "") : "";
}

function getSecretString(config: Record<string, unknown>, key: string, fallbackEnv?: string): string {
  const configured = getString(config, key, fallbackEnv);
  return configured ? decryptSecret(configured) : "";
}

function getPort(config: Record<string, unknown>): number {
  const configured = config.smtp_port;
  if (typeof configured === "number" && Number.isFinite(configured)) return configured;
  if (typeof configured === "string" && configured.trim()) {
    const parsed = Number.parseInt(configured.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
}

function getSecure(config: Record<string, unknown>, port: number): boolean {
  const configured = config.smtp_secure;
  if (typeof configured === "boolean") return configured;
  if (typeof configured === "string" && configured.trim()) return parseBoolean(configured);
  return process.env.SMTP_SECURE ? parseBoolean(process.env.SMTP_SECURE) : port === 465;
}

export function isSmtpConfigured(config: Record<string, unknown>): boolean {
  return Boolean(
    getString(config, "smtp_host", "SMTP_HOST")
    && getPort(config)
    && getString(config, "smtp_from", "SMTP_FROM"),
  );
}

function getTransporter(config: Record<string, unknown>): Transporter {
  const port = getPort(config);
  const secure = getSecure(config, port);
  const host = getString(config, "smtp_host", "SMTP_HOST");
  const user = getString(config, "smtp_user", "SMTP_USER");
  const pass = getSecretString(config, "smtp_pass", "SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass
      ? {
          user,
          pass,
        }
      : undefined,
  });
}

export async function resolveNotificationEmail(
  tenantId: string,
  config: Record<string, unknown>,
): Promise<string | null> {
  const configuredEmail = typeof config.email === "string" ? config.email.trim() : "";
  if (configuredEmail) return configuredEmail;

  const result = await query(`SELECT admin_email FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
  const adminEmail = result.rows[0]?.admin_email;
  return typeof adminEmail === "string" && adminEmail.trim() ? adminEmail.trim() : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlEmail(subject: string, text: string): string {
  const lines = text.split("\n").filter(Boolean).map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`).join("");
  return `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b1020;padding:24px;color:#e5eefb;">
      <div style="max-width:640px;margin:0 auto;background:#11182b;border:1px solid #1f2a44;border-radius:16px;padding:24px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;margin-bottom:12px;">HiTechClaw AI</div>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f8fafc;">${escapeHtml(subject)}</h1>
        <div style="font-size:14px;line-height:1.6;color:#cbd5e1;">${lines}</div>
      </div>
    </div>
  `;
}

export async function sendNotificationEmail({
  tenantId,
  config,
  subject,
  text,
  html,
}: EmailDispatchParams): Promise<{ recipient: string }> {
  if (!isSmtpConfigured(config)) {
    throw new Error("SMTP is not configured. Provide SMTP host, port, and from address in the Email channel settings.");
  }

  const recipient = await resolveNotificationEmail(tenantId, config);
  if (!recipient) {
    throw new Error("No recipient email configured for this tenant.");
  }

  const mailer = getTransporter(config);
  const from = getString(config, "smtp_from", "SMTP_FROM");
  const replyTo = getString(config, "smtp_reply_to", "SMTP_REPLY_TO");
  await mailer.sendMail({
    from,
    to: recipient,
    replyTo: replyTo || undefined,
    subject,
    text,
    html: html ?? buildHtmlEmail(subject, text),
  });

  return { recipient };
}
