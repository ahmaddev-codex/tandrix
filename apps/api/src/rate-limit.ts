// A small in-memory limiter for endpoints that can be guessed at or spammed. One API process per
// deployment for the MVP; a shared store replaces this if the API scales out.

export interface RateLimiter {
  /** Counts one attempt for the key; false once the key is over its limit for the window. */
  allow(key: string): boolean;
}

/** Model-backed routes share one per-user budget shape: thirty calls a minute. */
export const MODEL_CALLS_PER_MINUTE = 30;
export function modelLimiter(now = Date.now): RateLimiter {
  return rateLimiter(MODEL_CALLS_PER_MINUTE, 60_000, now);
}

/**
 * Who's calling, for signed-out limits behind a proxy. The host's client-IP header (CLIENT_IP_HEADER)
 * is set by the proxy, so it's the one to trust; X-Forwarded-For is client-supplied except for the
 * entry the proxy appends last, so only the last entry counts (the first is whatever the caller
 * wrote, and rotating it would dodge every limit). Else the TCP peer. Never blank.
 */
export function clientKeyFromHeaders(
  forwardedFor: string | undefined,
  remoteAddress: string | undefined,
  proxyClientIp?: string,
): string {
  const proxied = proxyClientIp?.trim();
  if (proxied) return proxied;
  const last = forwardedFor
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1);
  if (last) return last;
  return remoteAddress?.trim() || "unknown";
}

export function rateLimiter(limit: number, windowMs: number, now = Date.now): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    allow(key) {
      const t = now();
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      const h = hits.get(key);
      if (!h || h.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return true;
      }
      h.count++;
      return h.count <= limit;
    },
  };
}
