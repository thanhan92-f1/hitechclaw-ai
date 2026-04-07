import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { unauthorized, validateAdmin, forbidden, validateRole } from "../_utils";
import * as net from "net";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

/* ─── TCP Health Check ───────────────────────────────────── */
function tcpCheck(host: string, port: number, timeoutMs = 5000): Promise<"online" | "offline"> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: "online" | "offline") => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finish("online"));
    socket.on("error", () => finish("offline"));
    socket.on("timeout", () => finish("offline"));
    socket.connect(port, host);
  });
}

/* ─── GET — list all MCP servers ────────────────────────── */
export async function GET(req: NextRequest) {
  if (!validateAdmin(req)) return unauthorized();

  // Optional: run live health check
  const check = req.nextUrl.searchParams.get("check") === "1";

  const result = await query(
    `SELECT id, name, url, host, port, server_type, approved, status, last_checked, notes, created_at
     FROM mcp_servers ORDER BY approved DESC, name ASC`
  );

  if (!check) {
    return NextResponse.json({ servers: result.rows, count: result.rowCount });
  }

  // Run TCP checks in parallel
  const servers = await Promise.all(
    result.rows.map(async (s: Record<string, unknown>) => {
      if (!s.host || !s.port) return { ...s, status: "unknown" };
      const status = await tcpCheck(s.host as string, s.port as number);
      await query(
        `UPDATE mcp_servers SET status = $1, last_checked = NOW() WHERE id = $2`,
        [status, s.id]
      );
      return { ...s, status };
    })
  );

  return NextResponse.json({ servers, count: servers.length });
}

/* ─── POST — add MCP server ─────────────────────────────── */
export async function POST(req: NextRequest) {
  if (!validateAdmin(req)) return unauthorized();

  const body = await req.json() as {
    name?: string; url?: string; host?: string; port?: number;
    server_type?: string; approved?: boolean; notes?: string;
  };

  const trimmedName = body.name?.trim() ?? "";
  if (!trimmedName) return NextResponse.json({ error: "name required" }, { status: 400 });

  const existing = await query(
    `SELECT id
       FROM mcp_servers
      WHERE COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default') = 'default'
        AND LOWER(BTRIM(name)) = LOWER(BTRIM($1))
      LIMIT 1`,
    [trimmedName]
  );
  if ((existing.rowCount ?? 0) > 0) {
    return NextResponse.json({ error: "An MCP server with this name already exists" }, { status: 409 });
  }

  // Parse host/port from url if not provided directly
  let host = body.host ?? null;
  let port = body.port ?? null;
  if (body.url && !host) {
    try {
      const u = new URL(body.url);
      host = u.hostname;
      port = parseInt(u.port || (u.protocol === "https:" ? "443" : "80"), 10);
    } catch { /* ignore */ }
  }

  try {
    const result = await query(
      `INSERT INTO mcp_servers (name, url, host, port, server_type, approved, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [trimmedName, body.url ?? null, host, port, body.server_type ?? "mcp", body.approved ?? false, body.notes ?? null]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "An MCP server with this name already exists" }, { status: 409 });
    }
    throw error;
  }
}

/* ─── PATCH — update MCP server ─────────────────────────── */
export async function PATCH(req: NextRequest) {
  if (!validateAdmin(req)) return unauthorized();

  const { searchParams } = req.nextUrl;
  const id = parseInt(searchParams.get("id") ?? "0", 10);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["name", "url", "host", "port", "server_type", "approved", "notes"];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      values.push(key === "name" && typeof body[key] === "string" ? body[key].trim() : body[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (!updates.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const requestedName = typeof body.name === "string" ? body.name.trim() : null;
  if (requestedName !== null) {
    if (!requestedName) return NextResponse.json({ error: "name required" }, { status: 400 });

    const duplicate = await query(
      `SELECT id
         FROM mcp_servers
        WHERE id <> $1
          AND COALESCE(NULLIF(BTRIM(tenant_id), ''), 'default') = 'default'
          AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
        LIMIT 1`,
      [id, requestedName]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: "An MCP server with this name already exists" }, { status: 409 });
    }
  }

  values.push(id);
  try {
    await query(`UPDATE mcp_servers SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "An MCP server with this name already exists" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}

/* ─── DELETE — remove MCP server ────────────────────────── */
export async function DELETE(req: NextRequest) {
  const role = await validateRole(req, "owner");
  if (!role) return unauthorized();
  if (role !== "owner" && role !== "admin") return forbidden("Admin+ only");

  const { searchParams } = req.nextUrl;
  const id = parseInt(searchParams.get("id") ?? "0", 10);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await query("DELETE FROM mcp_servers WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
