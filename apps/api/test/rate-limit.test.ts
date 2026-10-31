import { describe, expect, it } from "vitest";
import { clientKeyFromHeaders, MODEL_CALLS_PER_MINUTE, modelLimiter } from "../src/rate-limit";

describe("clientKeyFromHeaders", () => {
  it("trusts the proxy's Fly-Client-IP first", () => {
    expect(clientKeyFromHeaders("1.1.1.1", "10.0.0.2", "203.0.113.7")).toBe("203.0.113.7");
  });

  it("takes the address the proxy appended, not what the caller wrote", () => {
    // A caller can put anything first; rotating it must not dodge the limit.
    expect(clientKeyFromHeaders("6.6.6.6, 203.0.113.7", "10.0.0.2")).toBe("203.0.113.7");
    expect(clientKeyFromHeaders("7.7.7.7, 203.0.113.7", "10.0.0.2")).toBe("203.0.113.7");
  });

  it("falls back to the TCP peer, never blank", () => {
    expect(clientKeyFromHeaders(undefined, "10.0.0.2")).toBe("10.0.0.2");
    expect(clientKeyFromHeaders("  ", undefined)).toBe("unknown");
    expect(clientKeyFromHeaders(undefined, undefined)).toBe("unknown");
  });
});

describe("modelLimiter", () => {
  it("allows the per-minute budget per user, then refuses until the window resets", () => {
    let t = 1_000;
    const limiter = modelLimiter(() => t);
    for (let i = 0; i < MODEL_CALLS_PER_MINUTE; i++) expect(limiter.allow("u")).toBe(true);
    expect(limiter.allow("u")).toBe(false);
    expect(limiter.allow("other")).toBe(true);
    t += 60_000;
    expect(limiter.allow("u")).toBe(true);
  });
});
