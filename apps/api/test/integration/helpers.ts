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
import type { ManualFinder } from "../../src/manual-finder";
import { supabaseManualsRepo } from "../../src/repos/manuals";
import type { ProcedureGenerator } from "../../src/procedure-generator";
import { supabaseProceduresRepo } from "../../src/repos/procedures";
import type { Highlighter } from "../../src/highlighter";
import { supabaseDetectionsRepo } from "../../src/repos/detections";
import { supabaseStepStateRepo } from "../../src/repos/step-state";
import { noModelVoice } from "../../src/voice";
import type { StepChecker } from "../../src/step-checker";
import type { PartsChecker } from "../../src/parts-checker";
import { noModelScreenGuide } from "../../src/screen-guide";
import { supabasePairingsRepo } from "../../src/repos/pairings";
import { supabaseReportsRepo } from "../../src/repos/reports";
import { supabaseSessionMinter } from "../../src/session-minter";
import { supabasePartsChecksRepo } from "../../src/repos/parts-checks";
import type { Transport } from "../../src/safe-fetch";

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

/** Tests set `finder.impl` to script the manual search. */
export const finder: ManualFinder & { impl: ManualFinder["find"] } = {
  impl: async () => ({ status: "unavailable", message: "Search off in tests." }),
  find(asset) {
    return finder.impl(asset);
  },
};

/** Manual downloads: public DNS answers and a scripted transport; nothing leaves the machine. */
export const web: {
  resolve: (h: string) => Promise<Array<{ address: string; family: number }>>;
  transport: Transport & { impl: Transport["get"] };
} = {
  resolve: async () => [{ address: "93.184.215.14", family: 4 }],
  transport: {
    impl: async () => ({ status: 404 }),
    get(url, address, opts) {
      return web.transport.impl(url, address, opts);
    },
  },
};

/** Tests set `generator.impl` to script the drafted procedure. */
export const generator: ProcedureGenerator & { impl: ProcedureGenerator["generate"] } = {
  impl: async () => ({ status: "unavailable", message: "Model off in tests." }),
  generate(input) {
    return generator.impl(input);
  },
};

/** Tests set `highlighter.impl` to script what's found in the photo. */
export const highlighter: Highlighter & { impl: Highlighter["find"] } = {
  impl: async () => ({ status: "unavailable", message: "Model off in tests." }),
  find(input) {
    return highlighter.impl(input);
  },
};

/** Tests set `stepChecker.impl` to script the verdict on a check photo. */
export const stepChecker: StepChecker & { impl: StepChecker["check"] } = {
  impl: async () => ({ status: "unavailable", message: "Model off in tests." }),
  check(input) {
    return stepChecker.impl(input);
  },
};

/** Tests set `partsChecker.impl` to script what's found on the parts photo. */
export const partsChecker: PartsChecker & { impl: PartsChecker["check"] } = {
  impl: async () => ({ status: "unavailable", message: "Model off in tests." }),
  check(input) {
    return partsChecker.impl(input);
  },
};

export const app = createApp({
  verifyToken: supabaseVerifier(admin),
  jobs: supabaseJobsRepo(admin),
  evidence: supabaseEvidenceRepo(admin),
  storage: supabaseEvidenceStorage(admin),
  assets: supabaseAssetsRepo(admin),
  nameplateReader: reader,
  manuals: supabaseManualsRepo(admin),
  manualStorage: supabaseEvidenceStorage(admin, "manuals"),
  manualFinder: finder,
  procedures: supabaseProceduresRepo(admin),
  procedureGenerator: generator,
  detections: supabaseDetectionsRepo(admin),
  highlighter,
  stepState: supabaseStepStateRepo(admin),
  transcriber: noModelVoice,
  answerer: noModelVoice,
  checker: stepChecker,
  partsChecks: supabasePartsChecksRepo(admin),
  partsChecker,
  screenGuide: noModelScreenGuide,
  pairings: supabasePairingsRepo(admin),
  reports: supabaseReportsRepo(admin),
  sessionMinter: supabaseSessionMinter(admin),
  tokenSecret: config.tokenSigningSecret,
  manualFetch: { resolve: (h) => web.resolve(h), transport: web.transport },
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
