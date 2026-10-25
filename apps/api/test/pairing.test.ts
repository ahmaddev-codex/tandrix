import { CreatePairingResponse, PAIRING_ALPHABET, PairingStatusResponse } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEvidence,
  memoryPairings,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

function setup(opts: { mint?: (userId: string) => Promise<string | null> } = {}) {
  let clock = Date.UTC(2026, 9, 26, 10);
  const pairings = memoryPairings();
  const minted: string[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs: {} as JobsRepo,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    pairings,
    sessionMinter: {
      async mint(userId) {
        minted.push(userId);
        return opts.mint ? opts.mint(userId) : `hash-for-${userId}`;
      },
    },
    now: () => clock,
    corsOrigins: [],
    log: () => {},
  });
  const call = (
    path: string,
    init: { method?: string; token?: string; body?: object; headers?: Record<string, string> } = {},
  ) =>
    app.request(path, {
      method: init.method ?? "POST",
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...init.headers,
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  const create = async () =>
    CreatePairingResponse.parse(
      await (await call("/pairing", { body: { deviceName: "Ahmad's MacBook Pro" } })).json(),
    );
  const poll = async (p: { pairingId: string; pollToken: string }) => {
    const res = await call(`/pairing/${p.pairingId}`, {
      method: "GET",
      headers: { "X-Pairing-Token": p.pollToken },
    });
    return { res, body: res.ok ? PairingStatusResponse.parse(await res.json()) : null };
  };
  const approve = (code: string, token = "a") =>
    call("/pairing/approve", { token, body: { code } });
  const lookup = (code: string, token = "a") => call("/pairing/lookup", { token, body: { code } });
  return {
    create,
    poll,
    approve,
    lookup,
    call,
    pairings,
    minted,
    advance: (ms: number) => (clock += ms),
  };
}

describe("pairing the Mac from the phone", () => {
  it("issues a code, lets the phone check and approve it, and signs the Mac in once", async () => {
    const s = setup();
    const p = await s.create();
    expect(p.code).toMatch(new RegExp(`^[${PAIRING_ALPHABET}]{8}$`));
    expect(p.expiresAt).toBe("2026-10-26T10:02:00.000Z");
    expect((await s.poll(p)).body).toEqual({ status: "pending", expiresAt: p.expiresAt });

    const found = await s.lookup(p.code);
    expect(await found.json()).toEqual({
      deviceName: "Ahmad's MacBook Pro",
      expiresAt: p.expiresAt,
    });
    // Typed the way people type it.
    const typed = `${p.code.slice(0, 4).toLowerCase()}-${p.code.slice(4).toLowerCase()}`;
    const ok = await s.approve(typed);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ deviceName: "Ahmad's MacBook Pro" });

    expect((await s.poll(p)).body).toEqual({ status: "approved", tokenHash: `hash-for-${A}` });
    expect(s.minted).toEqual([A]);
    // Used once.
    expect((await s.poll(p)).body).toEqual({ status: "expired" });
    expect(s.minted).toEqual([A]);
  });

  it("expires after two minutes", async () => {
    const s = setup();
    const p = await s.create();
    s.advance(2 * 60_000);
    expect((await s.poll(p)).body).toEqual({ status: "expired" });
    expect((await s.lookup(p.code)).status).toBe(404);
    expect((await s.approve(p.code)).status).toBe(404);
  });

  it("can't be approved twice or used after expiry", async () => {
    const s = setup();
    const p = await s.create();
    expect((await s.approve(p.code)).status).toBe(200);
    expect((await s.approve(p.code, "b")).status).toBe(404);
    s.advance(2 * 60_000);
    expect((await s.poll(p)).body).toEqual({ status: "expired" });
    expect(s.minted).toEqual([]);
  });

  it("needs a signed-in phone to look up or approve", async () => {
    const s = setup();
    const p = await s.create();
    expect((await s.call("/pairing/lookup", { body: { code: p.code } })).status).toBe(401);
    expect((await s.call("/pairing/approve", { body: { code: p.code } })).status).toBe(401);
    expect((await s.approve("abc")).status).toBe(400);
  });

  it("only answers the Mac that holds the poll token", async () => {
    const s = setup();
    const p = await s.create();
    await s.approve(p.code);
    expect((await s.poll({ ...p, pollToken: "x".repeat(43) })).res.status).toBe(404);
    expect((await s.call(`/pairing/${p.pairingId}`, { method: "GET" })).status).toBe(404);
    expect(s.minted).toEqual([]);
  });

  it("stores codes and poll tokens only as hashes", async () => {
    const s = setup();
    const p = await s.create();
    const stored = JSON.stringify([...s.pairings.rows.values()]);
    expect(stored).not.toContain(p.code);
    expect(stored).not.toContain(p.pollToken);
  });

  it("says so plainly when the Mac can't be signed in", async () => {
    const s = setup({ mint: async () => null });
    const p = await s.create();
    await s.approve(p.code);
    const r = await s.poll(p);
    expect(r.res.status).toBe(500);
  });

  it("limits how fast codes can be made and guessed", async () => {
    const s = setup();
    for (let i = 0; i < 10; i++) await s.create();
    expect((await s.call("/pairing", { body: { deviceName: "Mac" } })).status).toBe(429);
    for (let i = 0; i < 10; i++) expect((await s.approve("AAAA-AAAA")).status).toBe(404);
    expect((await s.approve("AAAA-AAAA")).status).toBe(429);
  });
});
