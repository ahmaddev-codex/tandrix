# Spikes

Results of the checks that decide fallbacks. Record raw numbers and the decision. Empty sections are not done.

## T0.1 Meta API smoke test

Run: `pnpm smoke:meta` (uses `.env.local`).

Run 1: **blocked on Meta billing.** The key authenticates, but every model returns HTTP 402 `billing_not_configured` ("your team needs to resolve a billing issue first", https://dev.meta.ai/billing/). Rerun after billing is set up.

| Check | Result | Latency | Notes |
|---|---|---|---|
| Spark text | 402 billing | ~1.7 s | Rate-limit headers: not reached |
| Spark image + structured output (`text.format` json_schema) | 402 billing | ~1.8 s | Structured-output shape still unconfirmed. |
| SAM 3.1 "red square" | 402 billing | ~1.6 s | Expected box ≈ x 100, y 60, w 120, h 120. Run 1 also showed SAM errors were hidden behind the parser's wrapper; fixed, the API error now surfaces. |
| Voice Transcribe (file, 1 s silence) | 402 billing | ~2.2 s | |

Run 2, after billing was set up: **all four models reachable.**

| Check | Result | Latency | Notes |
|---|---|---|---|
| Spark text | ✓ | 2.1 s | One earlier attempt failed with a network error after 10.5 s; the rerun passed. |
| Spark image + structured output | ✓ | 2.9 s | `text.format` json_schema works. 455 of 473 output tokens were reasoning, billed as output: keep reasoning effort low wherever the task allows. |
| SAM 3.1 "red square" | ✓ | 1.8 s | Box {100, 60, 120, 120} against the expected {100, 60, 120, 120}; confidence 0.90. |
| Voice Transcribe (file, 1 s of silence) | ✓ | 2.0 s | Empty transcript, duration 1040 ms. |

Cost of one run: $0.0043 (metered by the local spend ledger, `pnpm --filter @tandrix/api spend`).

Rate limits per model (pricing page, Oct 2026): Spark 3,000 RPM / 4M TPM; SAM 3,000 RPM; Voice Transcribe 256 concurrent streams. Prices: Spark $1.25 / $4.25 per million input / output tokens (cached input $0.15); SAM $2.50 per 1,000 images; Voice Transcribe $0.18 per hour.

Decision: go. Live checks run against the local API with a spend cap (`META_SPEND_LIMIT_USD`, $10 by default locally).

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

- Make/model read: "Raspberry Pi" / "5" from the box label, 0.99 (live spine check).
- Manual found (URL): live search steered toward direct PDF manuals/datasheets (`filetype:pdf`).
- Correct manual? Yes path works; photographed-pages upload and PDF upload stay as the fallback.

Decision: go with live search + upload/pages fallback (shipped in T9/T10).

## Live spine check

`pnpm --filter @tandrix/api live-check` drives the phone and Mac spine through the local API on the real models, with the Raspberry Pi 5 demo material (`fixtures/demo-pi5`). Total spend for five runs while fixing what they found: $0.64.

| Pipeline | First run | After fixes | Cost per call |
|---|---|---|---|
| Identify (box label) | Refused: "unreadable" (the prompt only expected nameplates) | "Raspberry Pi" / "5", RAM 8GB as a rating, confidence 0.99 | ~$0.007 |
| Steps from a 22-page manual | Good steps and page citations; proper nouns lowercased ("raspberry pi"); 5 V fan tagged electrical isolation and rotating parts | Proper nouns kept; only the power-off step gated; 15 of 18 steps cite a page | ~$0.12, 50–58 s |
| Highlight (SAM + Spark) | Nothing found: part names ("Raspberry Pi 5") mean nothing to SAM | Plain-word fallback ("circuit board"): the board outlined with a mask at 0.98 | ~$0.01–0.02 |
| Ask about a step | Correct but unhelpful ("general practice") | "That's step 9: connect the Active Cooler fan cable to the connector labelled FAN…" (other steps given as context) | ~$0.004 |
| Check by photo | Correct verdicts; reasons ended with "Certainty is high" | Correct verdicts, reasons about the work only | ~$0.01 |
| Parts check | No boxes: generic SAM words ("mechanical part", "object", "item") find nothing | Each kind of part looked for by what it looks like (max 8), boxes merged | ~$0.04 |
| Voice transcribe | Accurate | — | ~$0.0001 |
| Show me (synthetic app) | Pointer on target; reply narrated ("I'll point to…") | Reply is the instruction ("Click Choose storage to pick the card."); pointer 3 of 5 runs inside the button, 2 runs 10 px below it | ~$0.009 |

SAM concept probe on the bare board: "raspberry pi" 0, "circuit board" 1 (0.88), "fan connector" 0, "mounting hole" 8. Small connectors are hard for SAM; expect highlights of boards and assemblies, not pins.

Open: pointing accuracy needs the T4 spike (20 targets in the chosen demo app); manual search and the screen-step check (T20) not yet run live.
