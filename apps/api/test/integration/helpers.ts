// Shared setup for integration tests against the local Supabase stack.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app";
import { supabaseVerifier } from "../../src/auth";
import { loadApiConfig } from "../../src/config";
import type { NameplateReader } from "../../src/nameplate";
import { supabaseAssetsRepo } from "../../src/repos/assets";
import { supabaseEvidenceRepo, supabaseEvidenceStorage } from "../../src/repos/evidence";
import { supabaseJobsRepo } from "../../src/repos/jobs";

export const config = loadApiConfig();
if (config.env !== "local") throw new Error("Integration tests only run against the local stack.");

export const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Tests set `reader.impl` to script the model; real model calls never run in tests. */
export const reader: NameplateReader & { impl: NameplateReader["read"] } = {
  impl: async () => ({
    status: "unavailable",
    reason: "model_unavailable",
    message: "Model off in tests.",
  }),
  read(image) {
    return reader.impl(image);
  },
};

export const app = createApp({
  verifyToken: supabaseVerifier(admin),
  jobs: supabaseJobsRepo(admin),
  evidence: supabaseEvidenceRepo(admin),
  storage: supabaseEvidenceStorage(admin),
  assets: supabaseAssetsRepo(admin),
  nameplateReader: reader,
  corsOrigins: [],
  log: () => {},
});

export interface TestUser {
  id: string;
  token: string;
  /** Talks to Supabase directly as this user, the way a client app could. */
  db: SupabaseClient;
}

/** Creates throwaway users; call `cleanup` in afterAll. */
export function userFactory() {
  const run = randomUUID().slice(0, 8);
  const made: TestUser[] = [];
  return {
    run,
    async make(name: string): Promise<TestUser> {
      const email = `it-${run}-${name}@tandrix.local`;
      const password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      const u = { id: created.data.user.id, token: signed.data.session.access_token, db: client };
      made.push(u);
      return u;
    },
    async cleanup() {
      for (const u of made) await admin.auth.admin.deleteUser(u.id);
    },
  };
}

export const api = (path: string, user: TestUser | null, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(user ? { authorization: `Bearer ${user.token}` } : {}),
    },
  });
