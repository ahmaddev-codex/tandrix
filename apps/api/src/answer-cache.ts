// What the API has already worked out about a screenshot, for a little while: the same question
// on the same screenshot is answered at once, and a part already clicked isn't clicked again.
// In memory only, per user, and only a hash of the screenshot is kept (never the image).
import { createHash } from "node:crypto";

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

/** At most `max` entries, each for `ttlMs`; the oldest go first. */
export function ttlCache<T>(max = 300, ttlMs = 15 * 60_000, now = Date.now): TtlCache<T> {
  const items = new Map<string, { value: T; until: number }>();
  return {
    get(key) {
      const hit = items.get(key);
      if (!hit) return undefined;
      if (hit.until < now()) {
        items.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      items.delete(key);
      items.set(key, { value, until: now() + ttlMs });
      while (items.size > max) items.delete(items.keys().next().value!);
    },
  };
}

/** A key from a user and anything describing the ask (the screenshot is hashed, never kept). */
export function cacheKey(userId: string, ...parts: Array<string | Uint8Array>): string {
  const h = createHash("sha256");
  h.update(userId);
  for (const p of parts) {
    h.update("\u0000");
    h.update(p);
  }
  return h.digest("hex");
}
