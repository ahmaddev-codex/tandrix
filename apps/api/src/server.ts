import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { supabaseVerifier } from "./auth";
import { loadApiConfig } from "./config";
import { join } from "node:path";
import { clientKeyFromHeaders } from "./rate-limit";
import { loadMetaConfig, setSpendMeter } from "@tandrix/ai";
import { fileSpendMeter } from "./spend";
import { metaNameplateReader, noModelReader } from "./nameplate";
import { supabaseAssetsRepo } from "./repos/assets";
import { supabaseEvidenceRepo, supabaseEvidenceStorage } from "./repos/evidence";
import { supabaseJobsRepo } from "./repos/jobs";
import { metaManualFinder, noModelFinder } from "./manual-finder";
import { supabaseManualsRepo } from "./repos/manuals";
import { metaScreenGuide, noModelScreenGuide } from "./screen-guide";
import { metaLooker, noModelLooker } from "./looker";
import { metaPartsChecker, noModelPartsChecker } from "./parts-checker";
import { supabasePartsChecksRepo } from "./repos/parts-checks";
import { metaStepChecker, noModelChecker } from "./step-checker";
import { metaVoice, noModelVoice } from "./voice";
import { metaHighlighter, noModelHighlighter } from "./highlighter";
import { metaProcedureGenerator, withRecording, noModelGenerator } from "./procedure-generator";
import { supabaseProceduresRepo } from "./repos/procedures";
import { supabaseDetectionsRepo } from "./repos/detections";
import { supabaseStepStateRepo } from "./repos/step-state";
import { supabasePairingsRepo } from "./repos/pairings";
import { supabaseEarlyAccessRepo } from "./repos/early-access";
import { supabaseProfilesRepo } from "./repos/profiles";
import { supabaseReportsRepo } from "./repos/reports";
import { supabaseSessionMinter } from "./session-minter";
import { supabaseManualPagesRepo } from "./repos/manual-pages";
import { workerPageRenderer } from "./pdf-render";
import { kokoroSpeaker } from "./speech";
import { metaScreenDoer, noModelScreenDoer } from "./screen-doer";

const config = loadApiConfig();
const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (l: Record<string, unknown>) => console.log(JSON.stringify(l));
// Models are optional: without a key, identification reports "unavailable" and users type details.
const meta = process.env.META_API_KEY ? loadMetaConfig() : null;
// Every model call is metered against a local cap, so testing can't run through the credit.
if (meta) {
  const limit = Number(
    process.env.META_SPEND_LIMIT_USD ?? (config.env === "local" ? 10 : Infinity),
  );
  const meter = fileSpendMeter(
    process.env.META_SPEND_LEDGER ?? join(import.meta.dirname, "..", ".meta-spend.json"),
    limit,
    log,
  );
  setSpendMeter(meter);
  // Ledger writes are async: let the last one land before the process goes.
  for (const sig of ["SIGTERM", "SIGINT"] as const)
    process.once(sig, () => void meter.flush().finally(() => process.exit(0)));
  log({ event: "spend_meter_on", limitUsd: limit });
}
const nameplateReader = meta ? metaNameplateReader(meta, log) : noModelReader;
const manualFinder = meta ? metaManualFinder(meta, log) : noModelFinder;
const procedureGenerator = meta
  ? withRecording(meta, log, metaProcedureGenerator(meta, log))
  : noModelGenerator;
const highlighter = meta ? metaHighlighter(meta, log) : noModelHighlighter;
const checker = meta ? metaStepChecker(meta, log) : noModelChecker;
const partsChecker = meta ? metaPartsChecker(meta, log) : noModelPartsChecker;
const screenGuide = meta ? metaScreenGuide(meta, log) : noModelScreenGuide;
const voice = meta ? metaVoice(meta, log) : noModelVoice;
if (!process.env.META_API_KEY)
  log({ level: "warn", event: "models_disabled", reason: "META_API_KEY not set" });

// Loads the voice model in the background so the first reply isn't slow.
const speaker = kokoroSpeaker(log);
speaker.warm();

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
  profiles: supabaseProfilesRepo(admin),
  earlyAccess: supabaseEarlyAccessRepo(admin),
  reports: supabaseReportsRepo(admin),
  sessionMinter: supabaseSessionMinter(admin),
  manualPages: supabaseManualPagesRepo(admin),
  pageRenderer: workerPageRenderer(),
  speaker,
  screenDoer: meta ? metaScreenDoer(meta, log) : noModelScreenDoer,
  looker: meta ? metaLooker(meta, log) : noModelLooker,
  clientKey: (c) =>
    clientKeyFromHeaders(
      c.req.header("x-forwarded-for"),
      getConnInfo(c).remote.address,
      c.req.header("fly-client-ip"),
    ),
  tokenSecret: config.tokenSigningSecret,
  corsOrigins: config.corsOrigins,
  log,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Tandrix API (${config.env}) on http://localhost:${info.port}`);
});
// Keep idle connections longer than clients and load balancers do (Node's default is 5 s), so a
// client never sends a request down a connection the server has just closed.
if ("keepAliveTimeout" in server) {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}
