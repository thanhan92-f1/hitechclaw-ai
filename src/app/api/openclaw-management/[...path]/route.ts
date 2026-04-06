import { NextRequest, NextResponse } from "next/server";
import { validateRole, unauthorized, forbidden } from "@/app/api/tools/_utils";
import { resolveOpenClawEnvironment } from "@/lib/openclaw-environments";

const ALLOWED_ROUTE_PATTERNS: Record<string, RegExp[]> = {
  GET: [
    /^\/api\/(info|status|system|openclaw\/status|logs|sessions|version)$/,
    /^\/api\/config(?:\/(get|validate|schema(?:\/lookup)?|file))?$/,
    /^\/api\/providers$/,
    /^\/api\/models(?:\/.*)?$/,
    /^\/api\/channels(?:\/(status|upstream|capabilities|logs|[^/]+))?$/,
    /^\/api\/skills(?:\/(status|search|check|bins|[^/]+))?$/,
    /^\/api\/(secrets|security)\/audit$/,
    /^\/api\/domain(?:\/(preflight(?:\/live)?|issuer))?$/,
    /^\/api\/(directory|hooks|plugins|nodes)(?:\/.*)?$/,
  ],
  POST: [
    /^\/api\/(restart|stop|start|rebuild|upgrade)$/,
    /^\/api\/sessions\/cleanup$/,
    /^\/api\/config\/(test-key|apply)$/,
    /^\/api\/backup\/(create|verify)$/,
    /^\/api\/channels\/resolve$/,
    /^\/api\/hooks\/[^/]+\/(enable|disable)$/,
    /^\/api\/models\/(aliases|fallbacks|image-fallbacks)$/,
    /^\/api\/skills\/update$/,
    /^\/api\/secrets\/reload$/,
  ],
  PUT: [
    /^\/api\/config\/(provider|api-key|raw|custom-provider)$/,
    /^\/api\/domain$/,
    /^\/api\/channels\/[^/]+$/,
    /^\/api\/models\/(default|image-default|auth-order)$/,
    /^\/api\/(hooks|plugins)\/[^/]+$/,
  ],
  PATCH: [
    /^\/api\/config$/,
  ],
  DELETE: [
    /^\/api\/config\/(api-key|unset|custom-provider)$/,
    /^\/api\/channels\/[^/]+$/,
    /^\/api\/models\/(auth-order|fallbacks|image-fallbacks)$/,
    /^\/api\/models\/aliases\/[^/]+$/,
    /^\/api\/models\/(fallbacks|image-fallbacks)\/[^/]+$/,
    /^\/api\/(hooks|plugins)\/[^/]+$/,
  ],
};

const HIGH_RISK_PATTERNS: RegExp[] = [
  /^\/api\/(restart|stop|start|rebuild|upgrade)$/,
  /^\/api\/sessions\/cleanup$/,
  /^\/api\/config\/(apply|provider|api-key|raw|custom-provider|unset)$/,
  /^\/api\/config$/,
  /^\/api\/backup\/create$/,
  /^\/api\/domain$/,
  /^\/api\/channels\/[^/]+$/,
  /^\/api\/hooks\/[^/]+\/(enable|disable)$/,
  /^\/api\/models\/(default|image-default|auth-order|aliases|fallbacks|image-fallbacks)(?:\/[^/]+)?$/,
  /^\/api\/skills\/update$/,
  /^\/api\/(hooks|plugins)\/[^/]+$/,
];

function isAllowed(method: string, path: string) {
  return (ALLOWED_ROUTE_PATTERNS[method] ?? []).some((pattern) => pattern.test(path));
}

function normalizeCustomManagementPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withApiPrefix = trimmed.startsWith("/api/")
    ? trimmed
    : trimmed.startsWith("/")
      ? `/api${trimmed}`
      : `/api/${trimmed}`;

  return withApiPrefix.replace(/\/+$/g, "").replace(/\/+/g, "/");
}

function isAllowedByEnvironment(method: string, path: string, customAllowedPaths: unknown) {
  if (isAllowed(method, path)) {
    return true;
  }

  if (!Array.isArray(customAllowedPaths)) {
    return false;
  }

  return customAllowedPaths
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeCustomManagementPath(entry))
    .filter(Boolean)
    .some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function isHighRisk(path: string) {
  return HIGH_RISK_PATTERNS.some((pattern) => pattern.test(path));
}

async function forward(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const role = await validateRole(req, "admin");
  if (!role) {
    const authenticated = await validateRole(req, "viewer");
    return authenticated ? forbidden("Admin access required") : unauthorized();
  }

  const params = await context.params;
  const requestedPath = `/${(params.path ?? []).join("/")}`;
  const normalizedPath = `/api${requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`}`.replace(/\/+/g, "/");
  const method = req.method.toUpperCase();

  const requestedEnvironmentId =
    req.headers.get("x-openclaw-environment-id") ?? req.nextUrl.searchParams.get("environmentId");
  const environment = await resolveOpenClawEnvironment(requestedEnvironmentId);
  if (requestedEnvironmentId && environment.id !== requestedEnvironmentId) {
    return NextResponse.json({ error: "OpenClaw environment not found" }, { status: 404 });
  }

  if (!isAllowedByEnvironment(method, normalizedPath, environment.config.allowedManagementPaths)) {
    return forbidden("Management path not allowed");
  }

  const allowDestructiveActions = environment.config.allowDestructiveActions;
  if (allowDestructiveActions === false && isHighRisk(normalizedPath)) {
    return forbidden("High-risk OpenClaw actions are disabled for this environment");
  }

  const baseUrl = environment.baseUrl;
  const apiKey = environment.managementApiKey || environment.authToken || environment.gatewayToken;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "OpenClaw management API is not configured for the selected environment" },
      { status: 503 },
    );
  }

  const targetUrl = new URL(`${baseUrl}${normalizedPath}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key === "environmentId") return;
    targetUrl.searchParams.set(key, value);
  });

  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(
      typeof environment.config.requestTimeoutMs === "number" ? environment.config.requestTimeoutMs : 15000,
    ),
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

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set("x-openclaw-environment-id", environment.id);
    nextResponse.headers.set("x-openclaw-environment-name", environment.name);
    return nextResponse;
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

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context);
}