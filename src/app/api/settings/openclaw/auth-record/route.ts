import { NextRequest, NextResponse } from "next/server";
import { forbidden, unauthorized, validateRole, resolveUser } from "@/app/api/tools/_utils";
import { getClientIp, logAudit } from "@/lib/audit";
import {
  deleteManagedAuthRecord,
  getManagedAuthRecord,
  resolveManagedOpenClawEnvironmentId,
  upsertManagedAuthRecord,
} from "@/lib/openclaw-management-state";

function getRequestedEnvironmentId(req: NextRequest) {
  return req.headers.get("x-openclaw-environment-id") ?? req.nextUrl.searchParams.get("environmentId");
}

export async function GET(req: NextRequest) {
  const role = await validateRole(req, "admin");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Admin access required") : unauthorized();
  }

  const environmentId = await resolveManagedOpenClawEnvironmentId(getRequestedEnvironmentId(req));
  const record = await getManagedAuthRecord(environmentId);
  return NextResponse.json({ environmentId, record });
}

export async function PUT(req: NextRequest) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const environmentId = await resolveManagedOpenClawEnvironmentId(getRequestedEnvironmentId(req));
  const body = (await req.json()) as { username?: unknown; password?: unknown };

  try {
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const previous = await getManagedAuthRecord(environmentId);
    const record = await upsertManagedAuthRecord(environmentId, username, password);

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user ? String(user.id) : undefined,
      action: "openclaw.auth_record.upsert",
      targetType: "openclaw_environment",
      targetId: environmentId,
      description: `Updated managed OpenClaw auth record for ${environmentId}`,
      oldValue: previous ? { username: previous.username, passwordConfigured: previous.passwordConfigured } : undefined,
      newValue: { username: record.username, passwordConfigured: record.passwordConfigured },
      ipAddress: getClientIp(req.headers),
      tenantId: user?.tenant_id ?? undefined,
    });

    return NextResponse.json({ environmentId, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update managed auth record" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const environmentId = await resolveManagedOpenClawEnvironmentId(getRequestedEnvironmentId(req));
  const previous = await getManagedAuthRecord(environmentId);
  await deleteManagedAuthRecord(environmentId);

  const user = await resolveUser(req);
  logAudit({
    actorType: user ? "user" : "system",
    actorId: user ? String(user.id) : undefined,
    action: "openclaw.auth_record.delete",
    targetType: "openclaw_environment",
    targetId: environmentId,
    description: `Deleted managed OpenClaw auth record for ${environmentId}`,
    oldValue: previous ? { username: previous.username, passwordConfigured: previous.passwordConfigured } : undefined,
    ipAddress: getClientIp(req.headers),
    tenantId: user?.tenant_id ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
