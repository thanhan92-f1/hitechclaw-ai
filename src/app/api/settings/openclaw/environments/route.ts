import { NextRequest, NextResponse } from "next/server";
import { forbidden, parseJsonRecord, unauthorized, validateRole, resolveUser } from "@/app/api/tools/_utils";
import { getClientIp, logAudit } from "@/lib/audit";
import {
  buildOpenClawEnvironmentSummary,
  createOpenClawEnvironment,
  getDefaultOpenClawEnvironment,
  listOpenClawEnvironments,
  type OpenClawEnvironmentInput,
} from "@/lib/openclaw-environments";

export async function GET(req: NextRequest) {
  const role = await validateRole(req, "admin");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Admin access required") : unauthorized();
  }

  const environments = await listOpenClawEnvironments();
  const defaultEnvironment = await getDefaultOpenClawEnvironment();

  return NextResponse.json({
    environments,
    defaultEnvironmentId: defaultEnvironment.id,
  });
}

export async function POST(req: NextRequest) {
  const role = await validateRole(req, "owner");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Owner access required") : unauthorized();
  }

  const body = parseJsonRecord(await req.json()) as Partial<OpenClawEnvironmentInput>;

  try {
    const created = await createOpenClawEnvironment({
      name: body.name ?? "",
      slug: body.slug ?? body.name ?? "",
      description: typeof body.description === "string" ? body.description : "",
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : "",
      gatewayUrl: typeof body.gatewayUrl === "string" ? body.gatewayUrl : "",
      managementApiKey: typeof body.managementApiKey === "string" ? body.managementApiKey : "",
      gatewayToken: typeof body.gatewayToken === "string" ? body.gatewayToken : "",
      authToken: typeof body.authToken === "string" ? body.authToken : "",
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : false,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      config: parseJsonRecord(body.config),
    });

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user ? String(user.id) : undefined,
      action: "openclaw.environment.create",
      targetType: "openclaw_environment",
      targetId: created.id,
      description: `Created OpenClaw environment ${created.name}`,
      newValue: buildOpenClawEnvironmentSummary(created) as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req.headers),
      tenantId: user?.tenant_id ?? undefined,
    });

    return NextResponse.json({ environment: buildOpenClawEnvironmentSummary(created) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create OpenClaw environment" },
      { status: 400 },
    );
  }
}
