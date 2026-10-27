import { readFileSync } from "node:fs";

// Plays the Mac for the handoff flow, through the API as the local test user: waits for the
// phone's handoff, starts the desktop step and checks it on the real model with a screenshot of
// the synthetic OS Writer showing a finished write (rendered by run.sh).
//   node mac.mjs <jobId> <screenshot.png>   → exits 0 once the step is verified
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const sb = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const auth = await (
  await fetch(`${sb}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.DEV_USER_EMAIL,
      password: process.env.DEV_USER_PASSWORD,
    }),
  })
).json();
const headers = {
  authorization: `Bearer ${auth.access_token}`,
  "content-type": "application/json",
  "X-Tandrix-Surface": "desktop",
};
const call = async (method, path, body) => {
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [jobId, shotPath] = process.argv.slice(2);
if (!jobId || !shotPath) throw new Error("Usage: node mac.mjs <jobId> <screenshot.png>");

// Wait for the phone to hand the job over, as the Mac's panel would.
let detail;
for (let i = 0; i < 60; i++) {
  detail = await call("GET", `/jobs/${jobId}`);
  if (detail.job.activeSurface === "desktop") break;
  await sleep(1000);
}
if (detail.job.activeSurface !== "desktop") throw new Error("The job never came to the Mac.");
const step = detail.procedure.steps.find((s) => s.surface === "desktop");
const jobStep = detail.steps.find((s) => s.procedureStepId === step.id);
if (detail.job.currentStepId !== jobStep.id) throw new Error("Handed off at the wrong step.");

await call("POST", `/jobs/${jobId}/steps/${jobStep.id}/actions`, { action: "start" });
const png = readFileSync(shotPath);
// One check: the screenshot shows the finished write, so the real model should pass it.
{
  const created = await call("POST", `/jobs/${jobId}/evidence`, {
    kind: "screenshot",
    mimeType: "image/png",
    byteSize: png.length,
    surface: "desktop",
    width: 1280,
    height: 800,
    jobStepId: jobStep.id,
  });
  const up = await fetch(created.upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: png,
  });
  if (!up.ok) throw new Error(`upload: ${up.status}`);
  await call("POST", `/jobs/${jobId}/evidence/${created.evidence.id}/complete`);
  const r = await call("POST", `/jobs/${jobId}/steps/${jobStep.id}/check`, {
    evidenceId: created.evidence.id,
  });
  if (r.status === "checked" && r.step.status === "verified") {
    console.log("The Mac verified the step.");
    process.exit(0);
  }
  throw new Error(`The step wasn't verified: ${JSON.stringify(r).slice(0, 300)}`);
}
