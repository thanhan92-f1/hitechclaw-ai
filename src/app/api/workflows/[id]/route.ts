// src/app/api/workflows/[id]/route.ts — Get, Update, Delete single workflow
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateAdmin, unauthorized, resolveUser } from "@/app/api/tools/_utils";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdmin(req)) return unauthorized();

  try {
    const { id } = await params;
    const tenantId = req.nextUrl.searchParams.get("tenant_id");
    const sql = tenantId && tenantId !== "all"
      ? `SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2`
      : `SELECT * FROM workflows WHERE id = $1`;
    const queryParams = tenantId && tenantId !== "all" ? [id, tenantId] : [id];
    const result = await query(sql, queryParams);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({
      workflow: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[workflows/id] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdmin(req)) return unauthorized();

  try {
    const { id } = await params;
    const tenantId = req.nextUrl.searchParams.get("tenant_id");

    // Fetch old values for audit diff
    const oldSql = tenantId && tenantId !== "all"
      ? "SELECT name, status, trigger_type, tenant_id FROM workflows WHERE id = $1 AND tenant_id = $2"
      : "SELECT name, status, trigger_type, tenant_id FROM workflows WHERE id = $1";
    const oldParams = tenantId && tenantId !== "all" ? [id, tenantId] : [id];
    const oldResult = await query(oldSql, oldParams);
    const oldValues = oldResult.rows[0] as Record<string, unknown> | undefined;

    if (!oldValues) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string;
      definition?: Record<string, unknown>;
      status?: string;
      trigger_type?: string;
      trigger_config?: Record<string, unknown>;
    };

    // Build dynamic SET clause
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.name !== undefined) { sets.push(`name = $${idx++}`); values.push(body.name); }
    if (body.description !== undefined) { sets.push(`description = $${idx++}`); values.push(body.description); }
    if (body.definition !== undefined) { sets.push(`definition = $${idx++}`); values.push(JSON.stringify(body.definition)); }
    if (body.status !== undefined) { sets.push(`status = $${idx++}`); values.push(body.status); }
    if (body.trigger_type !== undefined) { sets.push(`trigger_type = $${idx++}`); values.push(body.trigger_type); }
    if (body.trigger_config !== undefined) { sets.push(`trigger_config = $${idx++}`); values.push(JSON.stringify(body.trigger_config)); }

    if (sets.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    let sql = `UPDATE workflows SET ${sets.join(", ")} WHERE id = $${idx}`;
    if (tenantId && tenantId !== "all") {
      values.push(tenantId);
      sql += ` AND tenant_id = $${values.length}`;
    }
    sql += ` RETURNING *`;

    const result = await query(
      sql,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user?.email ?? "owner",
      action: "workflow.updated",
      targetType: "workflow",
      targetId: id,
      description: `Updated workflow ${id}`,
      oldValue: oldValues ?? undefined,
      newValue: body as Record<string, unknown>,
      ipAddress: getClientIp(req.headers),
      tenantId: typeof result.rows[0]?.tenant_id === "string" ? result.rows[0].tenant_id as string : undefined,
    });

    return NextResponse.json({ workflow: result.rows[0], ok: true });
  } catch (err) {
    console.error("[workflows/id] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdmin(req)) return unauthorized();

  try {
    const { id } = await params;
    const tenantId = req.nextUrl.searchParams.get("tenant_id");
    const sql = tenantId && tenantId !== "all"
      ? `DELETE FROM workflows WHERE id = $1 AND tenant_id = $2 RETURNING id, name, tenant_id`
      : `DELETE FROM workflows WHERE id = $1 RETURNING id, name, tenant_id`;
    const queryParams = tenantId && tenantId !== "all" ? [id, tenantId] : [id];
    const result = await query(
      sql,
      queryParams
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const deleted = result.rows[0] as { id: number; name: string; tenant_id: string | null };
    const user = await resolveUser(req);
    logAudit({
      actorType: user ? "user" : "system",
      actorId: user?.email ?? "owner",
      action: "workflow.deleted",
      targetType: "workflow",
      targetId: id,
      description: `Deleted workflow "${deleted.name}"`,
      oldValue: { name: deleted.name, tenant_id: deleted.tenant_id },
      ipAddress: getClientIp(req.headers),
      tenantId: deleted.tenant_id ?? undefined,
    });

    return NextResponse.json({ deleted: result.rows[0], ok: true });
  } catch (err) {
    console.error("[workflows/id] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
