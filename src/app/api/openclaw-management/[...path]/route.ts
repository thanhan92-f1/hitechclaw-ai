import { NextRequest, NextResponse } from "next/server";
import { validateRole, unauthorized, forbidden } from "@/app/api/tools/_utils";
import {
  buildOpenClawCacheKey,
  getOpenClawCachedResponse,
  getOpenClawCacheMetadata,
  invalidateOpenClawCache,
  isOpenClawRefreshRequested,
  setOpenClawCachedResponse,
  shouldCacheOpenClawRequest,
} from "@/lib/openclaw-cache";
import { resolveOpenClawEnvironment } from "@/lib/openclaw-environments";

const DEFAULT_OPENCLAW_TIMEOUT_MS = 60000;

function isOpenClawTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    message.includes("aborted due to timeout") ||
    message.includes("operation was aborted") ||
    message.includes("timeout")
  );
}

function createOpenClawResponse(
  data: unknown,
  status: number,
  headers: Record<string, string | undefined>,
) {
  const response = NextResponse.json(data, { status });
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });
  return response;
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

  const cacheableRequest = shouldCacheOpenClawRequest(method);
  const forceRefresh = cacheableRequest && isOpenClawRefreshRequested(req.nextUrl.searchParams);
  const cacheKey = cacheableRequest ? buildOpenClawCacheKey(environment.id, method, targetUrl.toString()) : null;
  const cachedEntry = cacheKey ? await getOpenClawCachedResponse(cacheKey) : null;

  if (cacheableRequest && cachedEntry && !forceRefresh) {
    const metadata = getOpenClawCacheMetadata(cachedEntry);
    return createOpenClawResponse(cachedEntry.data, cachedEntry.status, {
      "x-openclaw-environment-id": environment.id,
      "x-openclaw-environment-name": environment.name,
      "x-openclaw-cache": metadata.isFresh ? "hit" : "stale",
      "x-openclaw-fetched-at": metadata.fetchedAt,
      "x-openclaw-cache-age-ms": metadata.ageMs === null ? undefined : String(metadata.ageMs),
      "x-openclaw-target-url": cachedEntry.targetUrl,
    });
  }

  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(
      typeof environment.config.requestTimeoutMs === "number"
        ? environment.config.requestTimeoutMs
        : DEFAULT_OPENCLAW_TIMEOUT_MS,
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

    if (cacheableRequest && cacheKey && response.ok) {
      await setOpenClawCachedResponse(cacheKey, {
        status: response.status,
        data,
        contentType: response.headers.get("content-type") ?? "application/json",
        fetchedAt: new Date().toISOString(),
        targetUrl: targetUrl.toString(),
      });
    }

    if (!cacheableRequest && response.ok) {
      await invalidateOpenClawCache(environment.id);
    }

    return createOpenClawResponse(data, response.status, {
      "x-openclaw-environment-id": environment.id,
      "x-openclaw-environment-name": environment.name,
      "x-openclaw-cache": cacheableRequest ? "miss" : "bypass",
      "x-openclaw-fetched-at": new Date().toISOString(),
      "x-openclaw-target-url": targetUrl.toString(),
    });
  } catch (error) {
    if (cacheableRequest && cachedEntry) {
      const metadata = getOpenClawCacheMetadata(cachedEntry);
      return createOpenClawResponse(cachedEntry.data, cachedEntry.status, {
        "x-openclaw-environment-id": environment.id,
        "x-openclaw-environment-name": environment.name,
        "x-openclaw-cache": "stale-if-error",
        "x-openclaw-fetched-at": metadata.fetchedAt,
        "x-openclaw-cache-age-ms": metadata.ageMs === null ? undefined : String(metadata.ageMs),
        "x-openclaw-target-url": cachedEntry.targetUrl,
      });
    }

    if (isOpenClawTimeoutError(error)) {
      return NextResponse.json(
        {
          error: "OpenClaw request timed out. Use Refresh to load the latest data again.",
        },
        { status: 504 },
      );
    }

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