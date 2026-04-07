// ============================================================
// LLM Rate Limiter — Per-tenant rate limiting for LLM API calls
// Addresses OWASP LLM10:2025 (Unbounded Consumption)
// ============================================================

/**
 * Sliding-window rate limiter using in-memory counters.
 * For production with multiple instances, replace with Redis-backed implementation.
 */
export class LLMRateLimiter {
  /** tenant -> { timestamps of recent requests } */
  private windows = new Map<string, number[]>();

  constructor(
    /** Max requests per window */
    private readonly maxRequests: number = 60,
    /** Window duration in ms (default: 60s) */
    private readonly windowMs: number = 60_000,
  ) {}

  /**
   * Check if a request is allowed for a given tenant.
   * Returns remaining requests or throws if exceeded.
   */
  check(tenantId: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create window
    let timestamps = this.windows.get(tenantId);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(tenantId, timestamps);
    }

    // Remove expired entries
    const active = timestamps.filter(t => t > windowStart);
    this.windows.set(tenantId, active);

    const remaining = Math.max(0, this.maxRequests - active.length);
    const resetMs = active.length > 0 ? (active[0] + this.windowMs) - now : 0;

    if (active.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetMs };
    }

    // Record this request
    active.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs };
  }

  /** Periodic cleanup of stale entries (call every ~5min) */
  cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [tenant, timestamps] of this.windows) {
      const active = timestamps.filter(t => t > cutoff);
      if (active.length === 0) {
        this.windows.delete(tenant);
      } else {
        this.windows.set(tenant, active);
      }
    }
  }
}
