// Plays the Mac for the handoff flow, through the API as the local test user: creates a job with
// the fixture steps, or (with a job id) waits for the phone's handoff, starts step 5 and checks
// it on a screenshot until it's verified (the fixture checker fails the first check).
//   node mac.mjs create            → prints the job id and title
//   node mac.mjs work <jobId>      → exits 0 once step 5 is verified
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

const [mode, jobId] = process.argv.slice(2);
if (mode === "create") {
  const title = `Handoff e2e ${Date.now() % 1_000_000}`;
  const { job } = await call("POST", "/jobs", { title, surface: "phone" });
  await call("PUT", `/jobs/${job.id}/asset`, {
    make: "FlowSet",
    model: "VFD-200",
    source: "manual",
  });
  await call("POST", `/jobs/${job.id}/procedure`, { allowGeneric: true });
  console.log(`${job.id}\t${title}`);
  process.exit(0);
}

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
// A 1×1 PNG stands in for the screenshot.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
for (let attempt = 0; attempt < 2; attempt++) {
  const created = await call("POST", `/jobs/${jobId}/evidence`, {
    kind: "screenshot",
    mimeType: "image/png",
    byteSize: png.length,
    surface: "desktop",
    width: 1,
    height: 1,
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
}
throw new Error("The step wasn't verified.");
