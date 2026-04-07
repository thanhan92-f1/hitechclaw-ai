/**
 * Sliding-window rate limiter using in-memory counters.
 * For production with multiple instances, replace with Redis-backed implementation.
 */
export declare class LLMRateLimiter {
    /** Max requests per window */
    private readonly maxRequests;
    /** Window duration in ms (default: 60s) */
    private readonly windowMs;
    /** tenant -> { timestamps of recent requests } */
    private windows;
    constructor(
    /** Max requests per window */
    maxRequests?: number, 
    /** Window duration in ms (default: 60s) */
    windowMs?: number);
    /**
     * Check if a request is allowed for a given tenant.
     * Returns remaining requests or throws if exceeded.
     */
    check(tenantId: string): {
        allowed: boolean;
        remaining: number;
        resetMs: number;
    };
    /** Periodic cleanup of stale entries (call every ~5min) */
    cleanup(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map