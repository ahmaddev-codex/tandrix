import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { supabaseVerifier } from "./auth";
import { loadApiConfig } from "./config";
import { loadMetaConfig } from "@tandrix/ai";
import { metaNameplateReader, noModelReader } from "./nameplate";
import { supabaseAssetsRepo } from "./repos/assets";
import { supabaseEvidenceRepo, supabaseEvidenceStorage } from "./repos/evidence";
import { supabaseJobsRepo } from "./repos/jobs";
import { metaManualFinder, noModelFinder } from "./manual-finder";
import { supabaseManualsRepo } from "./repos/manuals";

const config = loadApiConfig();
const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (l: Record<string, unknown>) => console.log(JSON.stringify(l));
// Models are optional: without a key, identification reports "unavailable" and users type details.
const meta = process.env.META_API_KEY ? loadMetaConfig() : null;
const nameplateReader = meta ? metaNameplateReader(meta, log) : noModelReader;
const manualFinder = meta ? metaManualFinder(meta, log) : noModelFinder;
if (!process.env.META_API_KEY)
  log({ level: "warn", event: "models_disabled", reason: "META_API_KEY not set" });

const app = createApp({
  verifyToken: supabaseVerifier(admin),
  jobs: supabaseJobsRepo(admin),
  evidence: supabaseEvidenceRepo(admin),
  storage: supabaseEvidenceStorage(admin),
  assets: supabaseAssetsRepo(admin),
  nameplateReader,
  manuals: supabaseManualsRepo(admin),
  manualStorage: supabaseEvidenceStorage(admin, "manuals"),
  manualFinder,
  tokenSecret: config.tokenSigningSecret,
  corsOrigins: config.corsOrigins,
  log,
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Tandrix API (${config.env}) on http://localhost:${info.port}`);
});
