import { ProfileResponse } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEvidence,
  memoryProfiles,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

function setup() {
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs: {} as JobsRepo,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    profiles: memoryProfiles(),
    now: () => Date.UTC(2026, 9, 29, 10),
    corsOrigins: [],
    log: () => {},
  });
  const call = (
    path: string,
    init: { method?: string; token?: string; body?: object } = {},
  ) =>
    app.request(path, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  return { call };
}

describe("GET /profile", () => {
  it("is null until the user says what to call them", async () => {
    const { call } = setup();
    const res = await call("/profile", { token: "a" });
    expect(res.status).toBe(200);
    expect(ProfileResponse.parse(await res.json())).toEqual({ displayName: null });
  });

  it("needs a signed-in user", async () => {
    const { call } = setup();
    expect((await call("/profile")).status).toBe(401);
  });
});

describe("PUT /profile", () => {
  it("saves the name and reads it back", async () => {
    const { call } = setup();
    const put = await call("/profile", {
      method: "PUT",
      token: "a",
      body: { displayName: "  Ari  " },
    });
    expect(put.status).toBe(200);
    expect(ProfileResponse.parse(await put.json())).toEqual({ displayName: "Ari" });
    const get = await call("/profile", { token: "a" });
    expect(ProfileResponse.parse(await get.json())).toEqual({ displayName: "Ari" });
  });

  it("keeps each user's name to themselves", async () => {
    const { call } = setup();
    await call("/profile", { method: "PUT", token: "a", body: { displayName: "Ari" } });
    const get = await call("/profile", { token: "b" });
    expect(ProfileResponse.parse(await get.json())).toEqual({ displayName: null });
  });

  it("clears the name on null", async () => {
    const { call } = setup();
    await call("/profile", { method: "PUT", token: "a", body: { displayName: "Ari" } });
    const put = await call("/profile", {
      method: "PUT",
      token: "a",
      body: { displayName: null },
    });
    expect(put.status).toBe(200);
    expect(ProfileResponse.parse(await put.json())).toEqual({ displayName: null });
  });

  it("rejects an empty or overlong name", async () => {
    const { call } = setup();
    expect(
      (await call("/profile", { method: "PUT", token: "a", body: { displayName: "" } })).status,
    ).toBe(400);
    expect(
      (
        await call("/profile", {
          method: "PUT",
          token: "a",
          body: { displayName: "x".repeat(41) },
        })
      ).status,
    ).toBe(400);
  });
});
