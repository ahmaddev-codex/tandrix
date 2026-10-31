// POST /early-access: the website's sign-up while the apps aren't public yet. No account needed,
// so it's rate-limited per client, and it answers the same for new and known addresses (it never
// tells anyone whether an address is already on the list).
import { EarlyAccessRequest, EarlyAccessResponse } from "@tandrix/contracts";
import { Hono, type Context } from "hono";
import { invalid, tooMany } from "../errors";
import { rateLimiter, type RateLimiter } from "../rate-limit";
import type { EarlyAccessRepo } from "../repos/early-access";

export function earlyAccessRoutes(d: {
  earlyAccess: EarlyAccessRepo;
  now?: () => number;
  limiter?: RateLimiter;
  clientKey?: (c: Context) => string;
}) {
  const now = d.now ?? Date.now;
  const limiter = d.limiter ?? rateLimiter(5, 60_000);
  const clientKey = d.clientKey ?? (() => "unknown");
  return new Hono().post("/", async (c) => {
    if (!limiter.allow(clientKey(c))) throw tooMany();
    const parsed = EarlyAccessRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) throw invalid(["email: Enter an email address, like you@example.com."]);
    await d.earlyAccess.add(
      parsed.data.email,
      parsed.data.platform ?? null,
      new Date(now()).toISOString(),
    );
    return c.json(EarlyAccessResponse.parse({ ok: true }));
  });
}
