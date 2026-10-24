# Spikes

Results of the checks that decide fallbacks (Hackathon plan §4). Record raw numbers, the date, and the decision. Empty sections are not done.

## T0.1 Meta API smoke test

Run: `pnpm smoke:meta` (uses `.env.local`).

Run 1, 24 Oct 2026: **blocked on Meta billing.** The key authenticates, but every model returns HTTP 402 `billing_not_configured` ("your team needs to resolve a billing issue first", https://dev.meta.ai/billing/). Rerun after billing is set up.

| Check | Result | Latency | Notes |
|---|---|---|---|
| Spark text | 402 billing | ~1.7 s | Rate-limit headers: not reached |
| Spark image + structured output (`text.format` json_schema) | 402 billing | ~1.8 s | Structured-output shape still unconfirmed. |
| SAM 3.1 "red square" | 402 billing | ~1.6 s | Expected box ≈ x 100, y 60, w 120, h 120. Run 1 also showed SAM errors were hidden behind the parser's wrapper; fixed, the API error now surfaces. |
| Voice Transcribe (file, 1 s silence) | 402 billing | ~2.2 s | |

Rate limits per model (from the response headers or the pricing page):

Decision:

## T0.2 Wearables Device Access Toolkit

- Developer Center access:
- SDK versions (iOS, Android):
- Sample app on iPhone: photo / stream:
- Sample app on Android: photo / stream:
- App registration values needed in `apps/mobile` config:

Decision:

## T3 SAM highlighting on pump parts

10 fixture photos from `fixtures/demo-pump`. Pass: correct part highlighted in ≥ 8/10.

| Photo | Part | Concept prompt | Correct? | Confidence | Needed Spark pick? |
|---|---|---|---|---|---|

Decision (fallback if failed: point prompts, box-only, or numbered callouts):

## T4 Screen pointing

20 targets in the chosen desktop app. Pass: ≥ 18/20 inside the target control.

| # | Target | Hit? | Distance from centre (px) |
|---|---|---|---|

Decision (fallback if failed: accessibility lookup by name, or SAM snapping):

## T5 Nameplate → manual

- Make/model read:
- Manual found (URL):
- Correct manual?

Decision (fallback: manual upload as the demo path):
