// A small in-memory limiter for endpoints that can be guessed at or spammed. One API process per
// deployment for the MVP; a shared store replaces this if the API scales out.

export interface RateLimiter {
  /** Counts one attempt for the key; false once the key is over its limit for the window. */
  allow(key: string): boolean;
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
