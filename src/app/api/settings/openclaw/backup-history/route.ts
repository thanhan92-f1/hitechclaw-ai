import { NextRequest, NextResponse } from "next/server";
import { forbidden, parseInteger, unauthorized, validateRole, resolveUser } from "@/app/api/tools/_utils";
import { getClientIp, logAudit } from "@/lib/audit";
import {
  createBackupHistoryRecord,
  listBackupHistory,
  resolveManagedOpenClawEnvironmentId,
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
  const limit = parseInteger(req.nextUrl.searchParams.get("limit"), 20);
  const items = await listBackupHistory(environmentId, limit);
  return NextResponse.json({ environmentId, items });
}

export async function POST(req: NextRequest) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const environmentId = await resolveManagedOpenClawEnvironmentId(getRequestedEnvironmentId(req));
  const body = (await req.json()) as {
    action?: unknown;
    archivePath?: unknown;
    verified?: unknown;
    status?: unknown;
    message?: unknown;
    payload?: unknown;
  };

  try {
    const record = await createBackupHistoryRecord({
      environmentId,
      action: typeof body.action === "string" ? body.action : "backup",
      archivePath: typeof body.archivePath === "string" ? body.archivePath : "",
      verified: typeof body.verified === "boolean" ? body.verified : null,
      status: typeof body.status === "string" ? body.status : "recorded",
      message: typeof body.message === "string" ? body.message : "",
      payload: body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {},
    });

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user ? String(user.id) : undefined,
      action: "openclaw.backup_history.create",
      targetType: "openclaw_environment",
      targetId: environmentId,
      description: `Recorded OpenClaw backup ${record.action} event for ${environmentId}`,
      newValue: {
        id: record.id,
        action: record.action,
        archivePath: record.archivePath,
        status: record.status,
        verified: record.verified,
      },
      ipAddress: getClientIp(req.headers),
      tenantId: user?.tenant_id ?? undefined,
    });

    return NextResponse.json({ environmentId, item: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record backup history" },
      { status: 400 },
    );
  }
}
