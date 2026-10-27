/**
 * One live run of the phone and Mac spine against the REAL models, through the local API (start
 * it with `pnpm --filter @tandrix/api dev`, not dev:fixtures). Uses the Raspberry Pi 5 demo
 * material (sh fixtures/demo-pi5/fetch.sh first) and prints what each call returned and cost.
 *   pnpm --filter @tandrix/api live-check
 * It spends real credit (well under $1 a run); the API's spend cap still applies.
 * LIVE_JOB=<job id> reuses a job that already has its steps, skipping the dearest calls
 * (identify and writing the steps from the manual, about $0.12).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLedger } from "../src/spend";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const root = join(import.meta.dirname, "../../..");
const demo = join(root, "fixtures/demo-pi5");
const ledger = join(import.meta.dirname, "..", ".meta-spend.json");
let spent = readLedger(ledger).totalUsd;
const tmp = mkdtempSync(join(tmpdir(), "tandrix-live-"));

const auth = (await (
  await fetch(`${env("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ email: env("DEV_USER_EMAIL"), password: env("DEV_USER_PASSWORD") }),
  })
).json()) as { access_token: string };
const headers = {
  authorization: `Bearer ${auth.access_token}`,
  "content-type": "application/json",
};

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function report(label: string, detail: unknown) {
  const now = readLedger(ledger).totalUsd;
  console.log(`\n## ${label}  ($${(now - spent).toFixed(4)})`);
  console.log(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  spent = now;
}

async function upload(
  jobId: string,
  file: string,
  kind: "photo" | "screenshot",
  jobStepId?: string,
) {
  const bytes = readFileSync(file);
  const mimeType = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const size = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
    encoding: "utf8",
  });
  const [w, h] = [...size.matchAll(/: (\d+)/g)].map((m) => Number(m[1]));
  const created = await call<{ evidence: { id: string }; upload: { signedUrl: string } }>(
    "POST",
    `/jobs/${jobId}/evidence`,
    {
      kind,
      mimeType,
      byteSize: bytes.length,
      surface: kind === "photo" ? "phone" : "desktop",
      width: w,
      height: h,
      ...(jobStepId ? { jobStepId } : {}),
    },
  );
  const put = await fetch(created.upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": mimeType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`upload ${file}: ${put.status}`);
  await call("POST", `/jobs/${jobId}/evidence/${created.evidence.id}/complete`);
  return created.evidence.id;
}

const reuse = process.env.LIVE_JOB;
const job = reuse ? { id: reuse } : await createJobWithSteps();

async function createJobWithSteps() {
  // 1. A project with equipment: the Pi 5, identified from its box.
  const { job } = await call<{ job: { id: string } }>("POST", "/jobs", {
    title: "Build a Raspberry Pi 5 home server",
    surface: "phone",
  });
  const boxId = await upload(job.id, join(demo, "photos/box-label.jpg"), "photo");
  const identified = await call<{ status: string; reading?: Record<string, unknown> }>(
    "POST",
    `/jobs/${job.id}/asset/identify`,
    { evidenceId: boxId },
  );
  report("Identify from the box", identified);
  const reading = identified.reading as
    { make?: string; model?: string; confidence?: number } | undefined;
  await call("PUT", `/jobs/${job.id}/asset`, {
    make: reading?.make || "Raspberry Pi",
    model: reading?.model || "5",
    nameplateEvidenceId: boxId,
    source: reading?.make ? "model" : "manual",
    ...(reading?.confidence !== undefined ? { confidence: reading.confidence } : {}),
  });

  // 2. The build kit's manual, then steps written from it.
  const kit = join(demo, "manuals/pi5-build-kit.pdf");
  const up = await call<{ uploadId: string; upload: { signedUrl: string } }>(
    "POST",
    `/jobs/${job.id}/manual/upload`,
    { byteSize: statSync(kit).size, title: "Raspberry Pi 5 build kit (product briefs)" },
  );
  await fetch(up.upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: readFileSync(kit),
  });
  await call("POST", `/jobs/${job.id}/manual/upload/${up.uploadId}/complete`);
  const started = Date.now();
  const proc = await call<{
    status: string;
    detail?: { steps: Array<Record<string, unknown>>; parts: unknown[] };
  }>("POST", `/jobs/${job.id}/procedure`, {
    task: "Fit the Active Cooler to the Raspberry Pi 5, mount it in its case and add M.2 storage",
  });
  report(
    `Steps from the manual (${((Date.now() - started) / 1000).toFixed(1)} s)`,
    proc.status !== "created"
      ? proc
      : proc.detail!.steps.map((s) => ({
          order: s.order,
          title: s.title,
          citation: s.citation,
          verification: s.verification,
          hazards: s.hazardTags,
        })),
  );
  if (proc.status !== "created") process.exit(1);

  return job;
}

// 3. Work the cooler step: start, highlight its parts, ask, check twice.
const detail = await call<{
  steps: Array<{ id: string; procedureStepId: string }>;
  procedure: { steps: Array<{ id: string; title: string; order: number }> };
}>("GET", `/jobs/${job.id}`);
// The step that fits the cooler to the board (not unpacking it), so the photos fit the step.
const coolerStep =
  detail.procedure.steps.find((s) =>
    /^(position|fit|attach|mount|install|clip|press)\b.*(cooler|push pins)/i.test(s.title),
  ) ??
  detail.procedure.steps.find((s) => /cooler/i.test(s.title)) ??
  detail.procedure.steps[0]!;
const js = detail.steps.find((s) => s.procedureStepId === coolerStep.id)!;
let action = await call<{ status: string; gates?: string[] }>(
  "POST",
  `/jobs/${job.id}/steps/${js.id}/actions`,
  { action: "start" },
);
for (const gate of action.gates ?? [])
  await call("POST", `/jobs/${job.id}/steps/${js.id}/actions`, { action: "confirm_safety", gate });
if (action.gates?.length)
  action = await call("POST", `/jobs/${job.id}/steps/${js.id}/actions`, { action: "start" });
report(`Start step ${coolerStep.order}: ${coolerStep.title}`, action.status);

const bare = await upload(job.id, join(demo, "photos/board-top.jpg"), "photo", js.id);
report(
  "Highlight the step's parts on the bare board",
  await call("POST", `/jobs/${job.id}/steps/${js.id}/highlight`, { evidenceId: bare }),
);
report(
  "Ask about the step",
  await call("POST", `/jobs/${job.id}/steps/${js.id}/ask`, {
    text: "Which connector does the fan cable go into?",
  }),
);
report(
  "Check: board without the cooler (expect needs attention)",
  await call("POST", `/jobs/${job.id}/steps/${js.id}/check`, { evidenceId: bare }),
);
const fitted = await upload(job.id, join(demo, "photos/board-with-cooler.jpg"), "photo", js.id);
report(
  "Check: board with the cooler fitted (expect verified)",
  await call("POST", `/jobs/${job.id}/steps/${js.id}/check`, { evidenceId: fitted }),
);

// 5. Voice: a spoken question, made with macOS's own voice.
const aiff = join(tmp, "q.aiff");
const wav = join(tmp, "q.wav");
execFileSync("say", ["-o", aiff, "Which connector does the fan cable go into?"]);
execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiff, wav]);
const form = new FormData();
form.append("audio", new Blob([readFileSync(wav)], { type: "audio/wav" }), "q.wav");
const heard = await (
  await fetch(`${api}/voice/transcribe`, {
    method: "POST",
    headers: { authorization: headers.authorization },
    body: form,
  })
).json();
report("Transcribe a spoken question", heard);

// 6. The Mac: a question about a synthetic app window, outside any job. (Never a real screen
// capture here: it could hold anything open on this Mac.) Expected target: Choose storage,
// at x 757–947, y 403–445 in the 1280×800 screenshot.
const shot = join(tmp, "screen.png");
execFileSync(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${join(tmp, "chrome")}`,
    "--window-size=1280,800",
    `--screenshot=${shot}`,
    `file://${join(demo, "screens/os-writer.html")}`,
  ],
  { stdio: "ignore" },
);
const answer = await call<{
  status: string;
  target?: { geometry: { point?: { x: number; y: number } } } | null;
}>("POST", "/screen/ask", {
  screenshot: { mimeType: "image/png", data: readFileSync(shot).toString("base64") },
  transcript: "How do I pick the SD card to write to?",
  geometry: {
    displayId: "1",
    imageWidth: 1280,
    imageHeight: 800,
    originX: 0,
    originY: 0,
    displayWidth: 1280,
    displayHeight: 800,
  },
  mode: "show",
});
const p = answer.target?.geometry.point;
// Choose storage, as rendered.
const onTarget = !!p && p.x >= 757 && p.x <= 947 && p.y >= 403 && p.y <= 445;
report(
  `Show me: pick the card (pointer ${p ? `${p.x},${p.y}` : "none"}, ${onTarget ? "ON" : "OFF"} target)`,
  answer,
);

// 7. Last, because a part it can't see blocks the steps that need it.
// Parts check on the cooler as it comes out of the box.
const parts = await upload(job.id, join(demo, "photos/cooler-front.jpg"), "photo");
report("Parts check", await call("POST", `/jobs/${job.id}/parts-check`, { evidenceId: parts }));

console.log(`\nTotal for this run: see pnpm --filter @tandrix/api spend. Job ${job.id}.`);
