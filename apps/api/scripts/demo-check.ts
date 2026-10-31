/**
 * The product on mixed demo material, not just the Raspberry Pi: pointing the camera at a bike and a
 * network switch, record mode from a photo series of changing an inner tube, and steps written from
 * a goal alone. Prints what came back, to read. Real models through the local API (start it with
 * `pnpm --filter @tandrix/api dev`); about 15 cents a run. Its projects are deleted at the end.
 *   pnpm --filter @tandrix/api demo-check
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readLedger } from "../src/spend";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const root = join(import.meta.dirname, "../../..");
const ledger = join(import.meta.dirname, "..", ".meta-spend.json");
const spentBefore = readLedger(ledger).totalUsd;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<any> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json().catch(() => ({ status: res.status }));
}

/** A photo's pixel size, from macOS's sips. */
function size(file: string) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]).toString();
  return {
    width: Number(/pixelWidth: (\d+)/.exec(out)![1]),
    height: Number(/pixelHeight: (\d+)/.exec(out)![1]),
  };
}

async function look(file: string, question: string) {
  const path = join(root, "fixtures", file);
  const started = Date.now();
  const r = await call("/look", {
    photo: { mimeType: "image/jpeg", data: readFileSync(path).toString("base64") },
    ...size(path),
    question,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${file}: ${question} (${seconds} s)\n  ${r.reply ?? r.message ?? r.status}`);
  if (r.highlight)
    console.log(`  outlined: ${r.highlight.label}${r.highlight.mask ? " (shape)" : " (box)"}`);
}

async function upload(jobId: string, file: string) {
  const path = join(root, "fixtures", file);
  const bytes = readFileSync(path);
  const created = await call(`/jobs/${jobId}/evidence`, {
    kind: "photo",
    surface: "phone",
    mimeType: "image/jpeg",
    byteSize: bytes.length,
    ...size(path),
    capturedAt: new Date().toISOString(),
  });
  const { bucket, path: key, token } = created.upload;
  const up = await fetch(
    `${env("SUPABASE_URL")}/storage/v1/object/upload/sign/${bucket}/${key}?token=${token}`,
    { method: "PUT", headers: { "content-type": "image/jpeg" }, body: bytes },
  );
  if (!up.ok) throw new Error(`Upload failed: ${up.status}`);
  await call(`/jobs/${jobId}/evidence/${created.evidence.id}/complete`, {});
  return created.evidence.id as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const printSteps = (steps: any[]) => {
  for (const s of steps)
    console.log(
      `  ${s.order}. ${s.title} [${s.citation.kind === "expert_recording" ? `at ${s.citation.timestampSec}s` : s.citation.kind}]${s.hazardTags.length ? ` ${s.hazardTags.join(",")}` : ""}`,
    );
};

// Pointing the camera, at things that aren't the Pi.
await look("demo-bike/photos/material.jpg", "What is the red thing for?");
await look("demo-bike/photos/removing-tube.jpg", "What is he pulling out of the tyre?");
await look("demo-network/photos/switch.jpg", "What is this, and where does the yellow cable go?");
await look("demo-network/photos/ethernet-plugged.jpg", "Is this plugged in properly?");

// Record mode: someone changing an inner tube, saying what they do.
const bike = (await call("/jobs", { title: "Change a bike inner tube e2e 1", surface: "phone" }))
  .job;
const moments = [
  ["deflating.jpg", "Let what's left of the air out at the valve so the tyre goes soft.", 8],
  ["removing-tube.jpg", "Push one side of the tyre off the rim, then pull the old tube out.", 41],
  ["inflating-new-tube.jpg", "Give the new tube a couple of pumps so it holds its shape.", 95],
  [
    "inserting-new-tube.jpg",
    "Tuck it in all the way round, starting at the valve, and don't pinch it.",
    140,
  ],
] as const;
const ids: string[] = [];
for (const [file] of moments) ids.push(await upload(bike.id, `demo-bike/photos/${file}`));
let started = Date.now();
const recorded = await call(`/jobs/${bike.id}/procedure/recorded`, {
  moments: moments.map(([, said, atSec], i) => ({ evidenceId: ids[i], said, atSec })),
});
console.log(
  `\nRecord mode, bike: ${recorded.status} in ${Math.round((Date.now() - started) / 1000)} s`,
);
printSteps(recorded.detail?.steps ?? []);

// Steps from a goal alone.
const net = (
  await call("/jobs", {
    title: "Set up a home network with a router and a switch e2e 1",
    surface: "phone",
  })
).job;
started = Date.now();
await call(`/jobs/${net.id}/procedure/start`, { allowGeneric: true });
let run = await call(`/jobs/${net.id}/procedure/run`);
while (run.status === "writing") {
  await new Promise((r) => setTimeout(r, 2000));
  run = await call(`/jobs/${net.id}/procedure/run`);
}
console.log(
  `\nFrom a goal, network: ${run.status} in ${Math.round((Date.now() - started) / 1000)} s`,
);
printSteps(run.detail?.steps ?? []);

await call(`/jobs/${bike.id}`, undefined, "DELETE");
await call(`/jobs/${net.id}`, undefined, "DELETE");
console.log(`\nSpent $${(readLedger(ledger).totalUsd - spentBefore).toFixed(3)}.`);
