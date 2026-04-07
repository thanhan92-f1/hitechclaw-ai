import { type NextRequest, NextResponse } from "next/server";
import { resolveRole } from "@/app/api/tools/_utils";

const REQUEST_HEADERS = ["content-type", "accept", "if-none-match"];
const RESPONSE_HEADERS = ["content-type", "cache-control", "content-disposition", "etag"];

function getAuthToken(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return req.cookies.get("mc_auth")?.value ?? null;
}

function getGatewayBaseUrl(req: NextRequest) {
  const configured =
    process.env.MC_GATEWAY_URL ?? process.env.GATEWAY_URL ?? process.env.HITECHCLAW_AI_BASE_URL ?? "";

  if (!configured) return "";

  const normalized = configured.replace(/\/+$/, "");
  if (normalized === req.nextUrl.origin.replace(/\/+$/, "")) {
    return "";
  }

  return normalized;
}

export async function proxyChatRequest(req: NextRequest, pathSegments: string[] = []) {
  const role = await resolveRole(req);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = getAuthToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gatewayBaseUrl = getGatewayBaseUrl(req);
  if (!gatewayBaseUrl) {
    return NextResponse.json(
      { error: "Chat gateway is not configured. Set MC_GATEWAY_URL, GATEWAY_URL, or HITECHCLAW_AI_BASE_URL." },
      { status: 503 }
    );
  }

  const upstreamPath = ["/api/chat", ...pathSegments].join("/").replace(/\/+/g, "/");
  const targetUrl = new URL(upstreamPath, `${gatewayBaseUrl}/`);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);

  for (const header of REQUEST_HEADERS) {
    const value = req.headers.get(header);
    if (value) headers.set(header, value);
  }

  const requestInit: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    requestInit.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, requestInit);
    const responseHeaders = new Headers();

    for (const header of RESPONSE_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat gateway request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}