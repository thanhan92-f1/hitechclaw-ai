import { createHash } from "crypto";
import { withRedis } from "@/lib/redis";

const OPENCLAW_CACHE_PREFIX = "openclaw:management";
const OPENCLAW_CACHE_TTL_SECONDS = 300;
const OPENCLAW_CACHE_TTL_STALE_SECONDS = 900;

export interface OpenClawCacheEntry {
  status: number;
  data: unknown;
  contentType: string;
  fetchedAt: string;
  targetUrl: string;
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildOpenClawCacheKey(environmentId: string, method: string, url: string) {
  return `${OPENCLAW_CACHE_PREFIX}:${environmentId}:${method}:${hashKey(url)}`;
}

export function shouldCacheOpenClawRequest(method: string) {
  return method.toUpperCase() === "GET";
}

export function isOpenClawRefreshRequested(searchParams: URLSearchParams) {
  const value = (searchParams.get("refresh") ?? searchParams.get("forceRefresh") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function getOpenClawCachedResponse(cacheKey: string) {
  const raw = await withRedis((client) => client.get(cacheKey));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as OpenClawCacheEntry;
  } catch (error) {
    console.error("[openclaw-cache] failed to parse cached payload", error);
    return null;
  }
}

export async function setOpenClawCachedResponse(cacheKey: string, entry: OpenClawCacheEntry) {
  await withRedis((client) => client.set(cacheKey, JSON.stringify(entry), { EX: OPENCLAW_CACHE_TTL_STALE_SECONDS }));
}

export async function invalidateOpenClawCache(environmentId: string) {
  await withRedis(async (client) => {
    const pattern = `${OPENCLAW_CACHE_PREFIX}:${environmentId}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  });
}

export function getOpenClawCacheMetadata(entry: OpenClawCacheEntry) {
  const fetchedAt = new Date(entry.fetchedAt);
  const ageMs = Date.now() - fetchedAt.getTime();

  return {
    fetchedAt: entry.fetchedAt,
    isFresh: Number.isFinite(ageMs) && ageMs <= OPENCLAW_CACHE_TTL_SECONDS * 1000,
    ageMs: Number.isFinite(ageMs) ? Math.max(ageMs, 0) : null,
  };
}
