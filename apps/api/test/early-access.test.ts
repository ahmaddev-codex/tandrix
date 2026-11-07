import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { rateLimiter } from "../src/rate-limit";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEarlyAccess,
  memoryEvidence,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";

function setup() {
  const earlyAccess = memoryEarlyAccess();
  const app = createApp({
    verifyToken: async () => null,
    jobs: {} as JobsRepo,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    earlyAccess,
    corsOrigins: [],
    log: () => {},
  });
  const post = (body: unknown) =>
    app.request("/early-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { earlyAccess, post };
}

describe("POST /early-access", () => {
  it("adds an address once, and says so when it's signed up again", async () => {
    const { earlyAccess, post } = setup();
    const first = await post({ email: " Sam@Example.com ", platform: "mac" });
    // The same address, however it's typed.
    const again = await post({ email: "SAM@example.com " });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, already: false });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, already: true });
    expect([...earlyAccess.rows.keys()]).toEqual(["sam@example.com"]);
    expect(earlyAccess.rows.get("sam@example.com")?.platform).toBe("mac");
  });

  it("refuses something that isn't an email address", async () => {
    const { earlyAccess, post } = setup();
    const r = await post({ email: "not an email" });
    expect(r.status).toBe(400);
    expect(earlyAccess.rows.size).toBe(0);
  });

  it("needs no sign-in", async () => {
    const { post } = setup();
    expect((await post({ email: "a@b.co", platform: "iphone" })).status).toBe(200);
  });
});

describe("early-access rate limit", () => {
  it("allows a few sign-ups a minute per client", () => {
    const limiter = rateLimiter(5, 60_000);
    const results = Array.from({ length: 6 }, () => limiter.allow("1.2.3.4"));
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});
