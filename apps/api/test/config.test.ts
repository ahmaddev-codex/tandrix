import { describe, expect, it } from "vitest";
import { loadApiConfig } from "../src/config";

const base = {
  SUPABASE_SECRET_KEY: "s",
  SUPABASE_PUBLISHABLE_KEY: "p",
  TOKEN_SIGNING_SECRET: "x".repeat(32),
};
const local = { ...base, TANDRIX_ENV: "local", SUPABASE_URL: "http://127.0.0.1:54321" };
const prod = { ...base, TANDRIX_ENV: "production", SUPABASE_URL: "https://abc.supabase.co" };

describe("loadApiConfig", () => {
  it("keeps local runs on this machine and production off it", () => {
    expect(() => loadApiConfig({ ...local, SUPABASE_URL: "https://abc.supabase.co" })).toThrow(
      /SUPABASE_URL/,
    );
    expect(() => loadApiConfig({ ...prod, SUPABASE_URL: "http://localhost:54321" })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("allows the fixture procedure locally and refuses it in production", () => {
    expect(loadApiConfig({ ...local, TANDRIX_FIXTURE_PROCEDURE: "1" }).fixtureProcedure).toBe(true);
    expect(loadApiConfig(local).fixtureProcedure).toBe(false);
    expect(() => loadApiConfig({ ...prod, TANDRIX_FIXTURE_PROCEDURE: "1" })).toThrow(
      /TANDRIX_FIXTURE_PROCEDURE/,
    );
  });

  it("requires a long token signing secret", () => {
    expect(() => loadApiConfig({ ...local, TOKEN_SIGNING_SECRET: "short" })).toThrow(
      /TOKEN_SIGNING_SECRET/,
    );
  });
});
