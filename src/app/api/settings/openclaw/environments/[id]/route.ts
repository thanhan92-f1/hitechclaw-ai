import { NextRequest, NextResponse } from "next/server";
import { forbidden, parseJsonRecord, unauthorized, validateRole, resolveUser } from "@/app/api/tools/_utils";
import { getClientIp, logAudit } from "@/lib/audit";
import {
  buildOpenClawEnvironmentSummary,
  deleteOpenClawEnvironment,
  getOpenClawEnvironmentById,
  updateOpenClawEnvironment,
  type OpenClawEnvironmentInput,
} from "@/lib/openclaw-environments";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const role = await validateRole(req, "admin");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Admin access required") : unauthorized();
  }

  const params = await context.params;
  const environment = await getOpenClawEnvironmentById(params.id);
  if (!environment) {
    return NextResponse.json({ error: "OpenClaw environment not found" }, { status: 404 });
  }

  return NextResponse.json({ environment: buildOpenClawEnvironmentSummary(environment) });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const params = await context.params;
  const existing = await getOpenClawEnvironmentById(params.id);
  if (!existing) {
    return NextResponse.json({ error: "OpenClaw environment not found" }, { status: 404 });
  }

  const body = parseJsonRecord(await req.json()) as Partial<OpenClawEnvironmentInput>;

  try {
    const updated = await updateOpenClawEnvironment(params.id, {
      name: typeof body.name === "string" ? body.name : existing.name,
      slug: typeof body.slug === "string" ? body.slug : existing.slug,
      description: typeof body.description === "string" ? body.description : existing.description,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : existing.baseUrl,
      gatewayUrl: typeof body.gatewayUrl === "string" ? body.gatewayUrl : existing.gatewayUrl,
      managementApiKey: typeof body.managementApiKey === "string" ? body.managementApiKey : undefined,
      gatewayToken: typeof body.gatewayToken === "string" ? body.gatewayToken : undefined,
      authToken: typeof body.authToken === "string" ? body.authToken : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : existing.isDefault,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder,
      config: body.config !== undefined ? parseJsonRecord(body.config) : existing.config,
    });

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user ? String(user.id) : undefined,
      action: "openclaw.environment.update",
      targetType: "openclaw_environment",
      targetId: updated.id,
      description: `Updated OpenClaw environment ${updated.name}`,
      oldValue: buildOpenClawEnvironmentSummary(existing) as unknown as Record<string, unknown>,
      newValue: buildOpenClawEnvironmentSummary(updated) as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req.headers),
      tenantId: user?.tenant_id ?? undefined,
    });

    return NextResponse.json({ environment: buildOpenClawEnvironmentSummary(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update OpenClaw environment" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const params = await context.params;
  const existing = await getOpenClawEnvironmentById(params.id);
  if (!existing) {
    return NextResponse.json({ error: "OpenClaw environment not found" }, { status: 404 });
  }

  try {
    await deleteOpenClawEnvironment(params.id);

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user ? String(user.id) : undefined,
      action: "openclaw.environment.delete",
      targetType: "openclaw_environment",
      targetId: existing.id,
      description: `Deleted OpenClaw environment ${existing.name}`,
      oldValue: buildOpenClawEnvironmentSummary(existing) as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req.headers),
      tenantId: user?.tenant_id ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete OpenClaw environment" },
      { status: 400 },
    );
  }
}
