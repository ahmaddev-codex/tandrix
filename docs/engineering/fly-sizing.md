# Fly sizing vs TTS/render split (H16)

Current `apps/api/fly.toml`: one `shared-cpu-1x` with 512 MB in `iad`, `min_machines_running = 1`.

## What shares the VM today

- API (Hono): light; request-scoped, no big residents.
- Kokoro TTS (`speech.ts`): 82M-param ONNX model resident after `warm()`, q8 CPU; syntheses
  run one at a time; 200-entry LRU phrase cache plus pre-cached wake/completion phrases.
- PDF render pool (`pdf-render.ts`): 2 warm workers, 20 s timeout with replacement, hashed
  dedupe key, FIFO queue. Manuals cap at 5000 pages (`pdf.ts`); renders are per cited page,
  on demand.

## Analysis

- Memory is the binding constraint, not CPU. 512 MB holds Node + one Kokoro resident + two
  render workers for the demo path (one user, sequential renders). Two concurrent manual
  intakes plus TTS can OOM a 512 MB guest: each render worker holds a PDF document and a
  page bitmap alongside the resident speech model.
- CPU contention is second: Kokoro synth and a page render on the same shared vCPU roughly
  double each other's latency (low single-digit seconds each, acceptable for the demo, poor
  under any concurrency).
- No page-count cap exists per render job beyond the 5000-page manual cap; a pathological
  manual cannot be rendered whole (renders are per page), so the exposure is queue depth,
  not one giant job.

## Decision

1. Demo/release: bump the VM to `shared-cpu-2x` / 1 GB. One-line change in `fly.toml`;
   keeps a single deployable and removes the OOM risk. No code change.
2. If TTS latency matters (spoken replies feel slow): split Kokoro into its own Fly app
   (`tandrix-voice`) with 1 GB, called over private networking; the API keeps its cache
   semantics and falls back to device voices when the voice app is unreachable. Do this
   only with measured p95 synth latency above ~2 s on the bigger VM.
3. Do not add a render page-count cap: per-page on-demand rendering already bounds work.
   If the render queue grows (FIFO wait above ~10 s), raise `RENDER_POOL_SIZE` to match
   vCPUs instead.

## Verification

After the bump: `fly status --watch` during intake + TTS + render shows memory under 80%;
`fly logs` shows no worker timeout replacements on the demo path.
