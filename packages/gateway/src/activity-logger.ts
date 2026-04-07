// ============================================================
// Activity Logger Middleware — Per-user request logging to MongoDB
// ============================================================

import type { MiddlewareHandler } from 'hono';
import { activityLogsCollection } from '@hitechclaw/db';
import type { MongoActivityLog } from '@hitechclaw/db';
import crypto from 'node:crypto';

// Paths to skip logging (health checks, static, etc.)
const SKIP_PATHS = new Set(['/', '/health', '/favicon.ico']);

// Sensitive fields to strip from request body before logging
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'secret', 'llmApiKey', 'credentials',
]);

function sanitizeBody(body: unknown): Record<string, any> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = '***';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function activityLoggerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;

    // Skip non-interesting paths
    if (SKIP_PATHS.has(path) || c.req.method === 'OPTIONS') {
      return next();
    }

    const start = Date.now();

    await next();

    // Log after response — fire-and-forget (don't block the response)
    const duration = Date.now() - start;
    const userId = c.get('userId' as never) as string | undefined;
    const tenantId = c.get('tenantId' as never) as string | undefined;

    // Only log authenticated requests (we have userId)
    if (!userId) return;

    // Parse body for POST/PUT only
    let requestBody: Record<string, any> | undefined;
    if (c.req.method === 'POST' || c.req.method === 'PUT') {
      try {
        // Clone body from raw — we can't re-read it, so we log what we can
        // For POST/PUT the body was already consumed by the route handler
        // We store the path + method as the primary activity signal
      } catch { /* skip */ }
    }

    const entry: MongoActivityLog = {
      _id: crypto.randomUUID(),
      tenantId: tenantId || 'unknown',
      userId,
      method: c.req.method,
      path,
      statusCode: c.res.status,
      duration,
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
      requestBody,
      responseSize: parseInt(c.res.headers.get('content-length') || '0') || undefined,
      createdAt: new Date(),
    };

    // Fire-and-forget — don't await
    activityLogsCollection().insertOne(entry as any).catch(() => { /* silent */ });
  };
}
