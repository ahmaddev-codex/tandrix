import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { supabaseVerifier } from "./auth";
import { loadApiConfig } from "./config";
import { join } from "node:path";
import { loadMetaConfig, setSpendMeter } from "@tandrix/ai";
import { fileSpendMeter } from "./spend";
import { metaNameplateReader, noModelReader } from "./nameplate";
import { supabaseAssetsRepo } from "./repos/assets";
import { supabaseEvidenceRepo, supabaseEvidenceStorage } from "./repos/evidence";
import { supabaseJobsRepo } from "./repos/jobs";
import { metaManualFinder, noModelFinder } from "./manual-finder";
import { supabaseManualsRepo } from "./repos/manuals";
import { fixtureHighlighter } from "./fixtures/highlight";
import { fixtureVoice } from "./fixtures/voice";
import { fixtureChecker } from "./fixtures/check";
import { fixturePartsChecker } from "./fixtures/parts";
import { fixtureScreenGuide } from "./fixtures/screen";
import { metaScreenGuide, noModelScreenGuide } from "./screen-guide";
import { metaPartsChecker, noModelPartsChecker } from "./parts-checker";
import { supabasePartsChecksRepo } from "./repos/parts-checks";
import { metaStepChecker, noModelChecker } from "./step-checker";
import { metaVoice, noModelVoice } from "./voice";
import { fixtureProcedureGenerator } from "./fixtures/procedure";
import { metaHighlighter, noModelHighlighter } from "./highlighter";
import { metaProcedureGenerator, noModelGenerator } from "./procedure-generator";
import { supabaseProceduresRepo } from "./repos/procedures";
import { supabaseDetectionsRepo } from "./repos/detections";
import { supabaseStepStateRepo } from "./repos/step-state";
import { supabasePairingsRepo } from "./repos/pairings";
import { supabaseReportsRepo } from "./repos/reports";
import { supabaseSessionMinter } from "./session-minter";

const config = loadApiConfig();
const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (l: Record<string, unknown>) => console.log(JSON.stringify(l));
// Models are optional: without a key, identification reports "unavailable" and users type details.
const meta = process.env.META_API_KEY ? loadMetaConfig() : null;
// Every model call is metered against a local cap, so testing can't run through the credit.
if (meta && !config.fixtureModels) {
  const limit = Number(
    process.env.META_SPEND_LIMIT_USD ?? (config.env === "local" ? 10 : Infinity),
  );
  setSpendMeter(
    fileSpendMeter(
      process.env.META_SPEND_LEDGER ?? join(import.meta.dirname, "..", ".meta-spend.json"),
      limit,
      log,
    ),
  );
  log({ event: "spend_meter_on", limitUsd: limit });
}
const nameplateReader = meta ? metaNameplateReader(meta, log) : noModelReader;
const manualFinder = meta ? metaManualFinder(meta, log) : noModelFinder;
const procedureGenerator = config.fixtureModels
  ? fixtureProcedureGenerator
  : meta
    ? metaProcedureGenerator(meta, log)
    : noModelGenerator;
const highlighter = config.fixtureModels
  ? fixtureHighlighter
  : meta
    ? metaHighlighter(meta, log)
    : noModelHighlighter;
const checker = config.fixtureModels
  ? fixtureChecker
  : meta
    ? metaStepChecker(meta, log)
    : noModelChecker;
const partsChecker = config.fixtureModels
  ? fixturePartsChecker
  : meta
    ? metaPartsChecker(meta, log)
    : noModelPartsChecker;
const screenGuide = config.fixtureModels
  ? fixtureScreenGuide
  : meta
    ? metaScreenGuide(meta, log)
    : noModelScreenGuide;
const voice = config.fixtureModels ? fixtureVoice : meta ? metaVoice(meta, log) : noModelVoice;
if (config.fixtureModels) log({ level: "warn", event: "fixture_models_on" });
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
  procedures: supabaseProceduresRepo(admin),
  procedureGenerator,
  detections: supabaseDetectionsRepo(admin),
  highlighter,
  stepState: supabaseStepStateRepo(admin),
  transcriber: voice,
  answerer: voice,
  checker,
  partsChecks: supabasePartsChecksRepo(admin),
  partsChecker,
  screenGuide,
  pairings: supabasePairingsRepo(admin),
  reports: supabaseReportsRepo(admin),
  sessionMinter: supabaseSessionMinter(admin),
  clientKey: (c) => getConnInfo(c).remote.address ?? "unknown",
  tokenSecret: config.tokenSigningSecret,
  corsOrigins: config.corsOrigins,
  log,
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Tandrix API (${config.env}) on http://localhost:${info.port}`);
});
