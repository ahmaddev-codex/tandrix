// Pairing (T21) against the local stack: the phone approves the Mac's code, and the one-time
// sign-in the Mac collects really signs it in as that user, once.
import { CreatePairingResponse, PairingStatusResponse } from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, api, app, config, userFactory, type TestUser } from "./helpers";

const users = userFactory();
let alice: TestUser;

beforeAll(async () => {
  alice = await users.make("alice");
});
afterAll(() => users.cleanup());

const poll = async (p: CreatePairingResponse) =>
  PairingStatusResponse.parse(
    await (
      await app.request(`/pairing/${p.pairingId}`, { headers: { "X-Pairing-Token": p.pollToken } })
    ).json(),
  );

describe("pairing", () => {
  it("signs the Mac in as the user who approved, once", async () => {
    const p = CreatePairingResponse.parse(
      await (
        await api("/pairing", null, {
          method: "POST",
          body: JSON.stringify({ deviceName: "Integration Mac" }),
        })
      ).json(),
    );
    expect((await poll(p)).status).toBe("pending");

    const approved = await api("/pairing/approve", alice, {
      method: "POST",
      body: JSON.stringify({ code: p.code }),
    });
    expect(approved.status).toBe(200);

    const r = await poll(p);
    if (r.status !== "approved") throw new Error(`expected approved, got ${r.status}`);

    // What the Mac does with it.
    const mac = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await mac.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
    expect(signed.error).toBeNull();
    expect(signed.data.user?.id).toBe(alice.id);

    // The token works once, and the pairing is used up.
    const again = await mac.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
    expect(again.error).not.toBeNull();
    expect((await poll(p)).status).toBe("expired");

    const { data } = await admin
      .from("pairings")
      .select("user_id, consumed_at")
      .eq("id", p.pairingId)
      .single();
    expect(data?.user_id).toBe(alice.id);
    expect(data?.consumed_at).not.toBeNull();
  });

  it("is invisible to signed-in clients", async () => {
    const { data, error } = await alice.db.from("pairings").select("id");
    expect(error ?? data).toBeTruthy();
    expect(data ?? []).toEqual([]);
  });
});
