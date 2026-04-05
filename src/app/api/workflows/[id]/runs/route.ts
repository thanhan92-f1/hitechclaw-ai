// src/app/api/workflows/[id]/runs/route.ts — List runs for a workflow
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateAdmin, unauthorized } from "@/app/api/tools/_utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdmin(req)) return unauthorized();

  try {
    const { id } = await params;
    const limit = req.nextUrl.searchParams.get("limit") ?? "20";
    const status = req.nextUrl.searchParams.get("status");
    const tenantId = req.nextUrl.searchParams.get("tenant_id");

    let sql = `
      SELECT id, workflow_id, status, created_at as started_at, completed_at,
             step_results, error, triggered_by
      FROM workflow_runs
      WHERE workflow_id = $1
    `;
    const queryParams: unknown[] = [id];

    if (status) {
      queryParams.push(status);
      sql += ` AND status = $${queryParams.length}`;
    }

    if (tenantId && tenantId !== "all") {
      queryParams.push(tenantId);
      sql += ` AND EXISTS (
        SELECT 1 FROM workflows w
        WHERE w.id = workflow_runs.workflow_id AND w.tenant_id = $${queryParams.length}
      )`;
    }

    queryParams.push(Number(limit));
    sql += ` ORDER BY created_at DESC LIMIT $${queryParams.length}`;

    const result = await query(sql, queryParams);

    return NextResponse.json({
      runs: result.rows,
      count: result.rowCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[workflows/runs] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
