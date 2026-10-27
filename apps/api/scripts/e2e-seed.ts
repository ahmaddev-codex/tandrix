/**
 * Test tooling for the phone's end-to-end flows: creates a project for the local test user with a
 * known procedure, so each flow starts from the same steps without paying a model to write them.
 * Model features the flows exercise (identify, highlight, check, parts, voice, screen check) still
 * run on the real models. Local database only.
 *   pnpm --filter @tandrix/api e2e:seed <scenario> [title]
 * Scenarios:
 *   empty   a project with nothing on it
 *   asset   a project for a "Cooler kit CK-5" (the e2e kit sheet's product), with no manual or steps
 *   pi      a Raspberry Pi 5 project with five steps: power off (safety gate), fit the Active
 *           Cooler (photo check, two parts), tighten the standoffs (torque), connect the network
 *           cable (needs a part the parts photo doesn't show) and write the OS (on the Mac)
 * Prints the job id, a tab, and the title.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ProcedureDraft } from "@tandrix/contracts";
import { normalizeDraft } from "@tandrix/core";
import { supabaseAssetsRepo } from "../src/repos/assets";
import { supabaseJobsRepo } from "../src/repos/jobs";
import { assetModelKey } from "../src/repos/manuals";
import { supabaseProceduresRepo } from "../src/repos/procedures";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const url = env("SUPABASE_URL");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("Local database only.");
const db = createClient(url, env("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [scenario = "pi", titleArg] = process.argv.slice(2);
if (!["empty", "asset", "pi"].includes(scenario)) throw new Error(`Unknown scenario ${scenario}`);

const email = env("DEV_USER_EMAIL");
const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const owner = users.users.find((u) => u.email === email);
if (!owner) throw new Error(`No local user ${email}; run pnpm db:reset or sign in once.`);

const title = titleArg ?? `Pi 5 e2e ${Date.now() % 1_000_000}`;
const jobs = supabaseJobsRepo(db);
const job = await jobs.create({ ownerId: owner.id, title, language: "en", surface: "phone" });

if (scenario !== "empty") {
  await supabaseAssetsRepo(db).saveForJob({
    ownerId: owner.id,
    jobId: job.id,
    category: "equipment",
    ...(scenario === "asset"
      ? { make: "Cooler kit", model: "CK-5" }
      : { make: "Raspberry Pi", model: "5" }),
    source: "manual",
  });
}

if (scenario === "pi") {
  const draft: ProcedureDraft = {
    title: "Fit the Active Cooler and set up the Raspberry Pi 5",
    parts: [
      { ref: "P1", name: "Raspberry Pi 5", qty: 1 },
      { ref: "P2", name: "Active Cooler", qty: 1 },
      { ref: "P3", name: "Ethernet cable", qty: 1 },
    ],
    steps: [
      {
        order: 1,
        surface: "physical",
        title: "Power off and unplug the Pi",
        instruction: "Shut the Pi down, then unplug the USB-C power cable.",
        partRefs: ["P1"],
        hazardTags: ["electrical_isolation"],
        verification: "user_confirm",
        expectedState: "The power cable is unplugged.",
        citation: { kind: "generic" },
      },
      {
        order: 2,
        surface: "physical",
        title: "Fit the Active Cooler",
        instruction:
          "Peel the backing off the thermal pads, line the push pins up with the two holes beside the processor, and press both pins down until they click.",
        partRefs: ["P1", "P2"],
        hazardTags: [],
        verification: "photo",
        expectedState:
          // What a photo from above can show (the pins' clips are underneath).
          "The Active Cooler is fitted on the board, sitting flat with its fan over the processor.",
        citation: { kind: "generic" },
      },
      {
        order: 3,
        surface: "physical",
        title: "Tighten the standoff screws",
        instruction: "Tighten the four M2.5 standoff screws with a torque screwdriver.",
        partRefs: [],
        hazardTags: [],
        verification: "measurement",
        measurement: { quantity: "torque", unit: "Nm", target: 0.4, tolerance: 0.1 },
        expectedState: "All four screws at 0.4 Nm.",
        citation: { kind: "generic" },
      },
      {
        order: 4,
        surface: "physical",
        title: "Connect the network cable",
        instruction: "Plug the Ethernet cable into the Pi's network port until it clicks.",
        partRefs: ["P3"],
        hazardTags: [],
        verification: "photo",
        expectedState: "The Ethernet cable is plugged into the network port.",
        citation: { kind: "generic" },
      },
      {
        order: 5,
        surface: "desktop",
        title: "Write Raspberry Pi OS to the card",
        instruction: "In OS Writer, choose the device, the OS and the card, then write it.",
        partRefs: [],
        hazardTags: [],
        verification: "screen",
        expectedState: "OS Writer says the write finished successfully.",
        citation: { kind: "generic" },
      },
    ],
  };
  const { draft: normal } = normalizeDraft(draft, { manualPages: null });
  const procedureId = randomUUID();
  const procedures = supabaseProceduresRepo(db);
  await procedures.save({
    ownerId: owner.id,
    jobId: job.id,
    procedureId,
    assetModelKey: assetModelKey("Raspberry Pi", "5"),
    manualId: null,
    draft: normal,
    partIds: new Map(normal.parts.map((p) => [p.ref, randomUUID()])),
    stepIds: normal.steps.map(() => randomUUID()),
    surface: "phone",
    event: { steps: normal.steps.length, cited_steps: 0, seeded_for: "e2e" },
  });
}

console.log(`${job.id}\t${title}`);
