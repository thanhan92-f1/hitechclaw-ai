import { NextRequest, NextResponse } from "next/server";
import { validateRole, unauthorized, forbidden } from "@/app/api/tools/_utils";

const ALLOWED_ROUTES: Record<string, string[]> = {
  GET: [
    "/api/info",
    "/api/status",
    "/api/system",
    "/api/openclaw/status",
    "/api/logs",
    "/api/sessions",
    "/api/config",
    "/api/version",
  ],
  POST: [
    "/api/restart",
    "/api/stop",
    "/api/start",
    "/api/rebuild",
    "/api/upgrade",
    "/api/sessions/cleanup",
    "/api/config/test-key",
  ],
  PUT: [
    "/api/config/provider",
    "/api/config/api-key",
  ],
};

function normalizeManagementBaseUrl() {
  const configured =
    process.env.OPENCLAW_MGMT_BASE_URL ??
    process.env.OPENCLAW_MGMT_URL ??
    process.env.OPENCLAW_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_GATEWAY_URL ??
    "http://localhost:9998";

  let normalized = configured.trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");

  try {
    const url = new URL(normalized);
    if (url.port === "18789") {
      url.port = "9998";
    }
    if (!url.port && !process.env.OPENCLAW_MGMT_BASE_URL && !process.env.OPENCLAW_MGMT_URL) {
      url.port = "9998";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return normalized.replace(/\/$/, "");
  }
}

function isAllowed(method: string, path: string) {
  return (ALLOWED_ROUTES[method] ?? []).some((allowedPath) => path === allowedPath);
}

async function forward(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const role = await validateRole(req, "admin");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Admin access required") : unauthorized();
  }

  const baseUrl = normalizeManagementBaseUrl();
  const apiKey = process.env.OPENCLAW_MGMT_API_KEY ?? process.env.GATEWAY_HOOK_TOKEN ?? "";

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "OpenClaw management API is not configured" },
      { status: 503 },
    );
  }

  const params = await context.params;
  const requestedPath = `/${(params.path ?? []).join("/")}`;
  const normalizedPath = `/api${requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`}`.replace(/\/+/g, "/");
  const method = req.method.toUpperCase();

  if (!isAllowed(method, normalizedPath)) {
    return forbidden("Management path not allowed");
  }

  const targetUrl = new URL(`${baseUrl}${normalizedPath}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  };

  if (method !== "GET" && method !== "HEAD") {
    const contentType = req.headers.get("content-type");
    if (contentType) {
      init.headers = { ...init.headers, "Content-Type": contentType };
    }
    const rawBody = await req.text();
    if (rawBody) {
      init.body = rawBody;
    }
  }

  try {
    const response = await fetch(targetUrl.toString(), init);
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "OpenClaw management request failed",
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context);
}