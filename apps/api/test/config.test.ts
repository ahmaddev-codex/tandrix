import { describe, expect, it } from "vitest";
import { loadApiConfig } from "../src/config";

const base = {
  SUPABASE_SECRET_KEY: "s",
  SUPABASE_PUBLISHABLE_KEY: "p",
  TOKEN_SIGNING_SECRET: "x".repeat(32),
};
const local = { ...base, TANDRIX_ENV: "local", SUPABASE_URL: "http://127.0.0.1:54321" };
const prod = {
  ...base,
  TANDRIX_ENV: "production",
  SUPABASE_URL: "https://abc.supabase.co",
  META_API_KEY: "k",
};

describe("loadApiConfig", () => {
  it("keeps local runs on this machine and production off it", () => {
    expect(() => loadApiConfig({ ...local, SUPABASE_URL: "https://abc.supabase.co" })).toThrow(
      /SUPABASE_URL/,
    );
    expect(() => loadApiConfig({ ...prod, SUPABASE_URL: "http://localhost:54321" })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("needs the models in production, not locally", () => {
    expect(() => loadApiConfig({ ...prod, META_API_KEY: undefined })).toThrow(/META_API_KEY/);
    expect(loadApiConfig(prod).env).toBe("production");
    expect(loadApiConfig(local).env).toBe("local");
  });

  it("requires a long token signing secret", () => {
    expect(() => loadApiConfig({ ...local, TOKEN_SIGNING_SECRET: "short" })).toThrow(
      /TOKEN_SIGNING_SECRET/,
    );
  });
});
