// Signing the Mac in from the phone (see @tandrix/contracts pairing). The Mac creates a pairing
// signed out and polls it with a token only it holds; the signed-in phone looks the code up and
// approves it; the Mac's next poll uses the pairing once and gets a one-time sign-in.
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  CreatePairingRequest,
  Id,
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_TTL_MS,
  PairingCodeRequest,
  type CreatePairingResponse,
  type PairingStatusResponse,
} from "@tandrix/contracts";
import { Hono, type Context } from "hono";
import type { z } from "zod";
import { requireUser, type AuthEnv, type VerifyToken } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import { rateLimiter, type RateLimiter } from "../rate-limit";
import type { PairingsRepo } from "../repos/pairings";
import type { SessionMinter } from "../session-minter";

export const PAIRING_TOKEN_HEADER = "X-Pairing-Token";

export interface PairingDeps {
  pairings: PairingsRepo;
  minter: SessionMinter;
  verifyToken: VerifyToken;
  now?: () => number;
  /** Who's asking, for rate limits on signed-out calls. */
  clientKey?: (c: Context) => string;
  limits?: { create: RateLimiter; code: RateLimiter; poll: RateLimiter };
}

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** 40 random bits from the unambiguous alphabet. */
export function newPairingCode(): string {
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++)
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  return code;
}

export function pairingRoutes(d: PairingDeps) {
  const now = d.now ?? Date.now;
  const limits = d.limits ?? {
    create: rateLimiter(10, 60_000),
    code: rateLimiter(10, 60_000),
    poll: rateLimiter(120, 60_000),
  };
  const clientKey = d.clientKey ?? (() => "unknown");
  const signedIn = requireUser(d.verifyToken);
  const codeFrom = async (c: Context) => {
    const parsed = PairingCodeRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) throw invalid(issues(parsed.error));
    return hash(parsed.data.code);
  };

  return (
    new Hono<AuthEnv>()
      // The Mac, signed out: a new code to show.
      .post("/", async (c) => {
        if (!limits.create.allow(clientKey(c))) throw tooMany();
        const parsed = CreatePairingRequest.safeParse(await c.req.json().catch(() => undefined));
        if (!parsed.success) throw invalid(issues(parsed.error));
        const expiresAt = new Date(now() + PAIRING_TTL_MS).toISOString();
        const pollToken = randomBytes(32).toString("base64url");
        // A clash with a live code is unlikely (2^40 codes); try a few before giving up.
        for (let attempt = 0; attempt < 3; attempt++) {
          const code = newPairingCode();
          const created = await d.pairings.create({
            codeHash: hash(code),
            pollHash: hash(pollToken),
            deviceName: parsed.data.deviceName,
            expiresAt,
          });
          if (created)
            return c.json({
              pairingId: created.id,
              code,
              pollToken,
              expiresAt,
            } satisfies CreatePairingResponse);
        }
        throw new Error("Couldn't issue a unique pairing code");
      })
      // The phone, signed in: what the code would sign in, so the user can check it's their Mac.
      .post("/lookup", signedIn, async (c) => {
        if (!limits.code.allow(c.get("user").id)) throw tooMany();
        const found = await d.pairings.findOpen(await codeFrom(c), new Date(now()).toISOString());
        if (!found) throw notFound("Pairing code");
        return c.json({ deviceName: found.deviceName, expiresAt: found.expiresAt });
      })
      .post("/approve", signedIn, async (c) => {
        const user = c.get("user");
        if (!limits.code.allow(user.id)) throw tooMany();
        const approved = await d.pairings.approve(
          await codeFrom(c),
          user.id,
          new Date(now()).toISOString(),
        );
        if (!approved) throw notFound("Pairing code");
        return c.json({ deviceName: approved.deviceName });
      })
      // The Mac: waiting for approval, then a one-time sign-in.
      .get("/:id", async (c) => {
        const id = Id.safeParse(c.req.param("id"));
        const token = c.req.header(PAIRING_TOKEN_HEADER);
        if (!id.success || !token) throw notFound("Pairing");
        if (!limits.poll.allow(id.data)) throw tooMany();
        const pollHash = hash(token);
        const p = await d.pairings.get(id.data, pollHash);
        if (!p) throw notFound("Pairing");
        const at = new Date(now()).toISOString();
        const reply = (r: PairingStatusResponse) => c.json(r);
        if (p.consumed || p.expiresAt <= at) return reply({ status: "expired" });
        if (!p.approved) return reply({ status: "pending", expiresAt: p.expiresAt });
        const userId = await d.pairings.consume(id.data, pollHash, at);
        if (!userId) return reply({ status: "expired" });
        const tokenHash = await d.minter.mint(userId);
        if (!tokenHash)
          throw new HttpError(
            500,
            "internal",
            "Couldn't sign this Mac in. Show a new code and try again.",
          );
        return reply({ status: "approved", tokenHash });
      })
  );
}
