# Tandrix MVP — Task list

See [plan.md](plan.md) for descriptions, acceptance criteria and verification.
Tracks: **D** design, **A** mobile & glasses, **B** API & AI, **C** desktop (macOS).

## Phase 0 — Prep (24–25 Oct)
- [x] T0.1 Meta API smoke script (B): all four models live 27 Oct; $0.004 a run; results in docs/engineering/spikes.md
- [ ] T0.2 Glasses toolkit sample running (A)
- [ ] T0.3 Demo fixtures: pump photos, manual, desktop app choice (all)
- [ ] T0.4 Monorepo skeleton + CI (B): local lint, format, typecheck, test and build pass; open until CI runs green on the first push
- [x] T0.5 Choose the design direction (D + you): Geist-style, see docs/design/decision.md
- [x] T0.6 Document the Tandrix design system (D): https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp, mirrored in docs/design/system
- [x] T0.7 `packages/ui`: tokens and core components (D + A + C): phone feature components land in their feature tasks; galleries in T7 and T18

## Phase 1 — Foundation and spikes (Mon 26 Oct)
- [x] T1 Contracts: core entities (B)
- [x] T2 Core rules: step status + safety gates (B)
- [ ] T3 Spike: SAM highlighting (B)
- [ ] T4 Spike: screen pointing (C)
- [ ] T5 Spike: nameplate → manual (B)
- [ ] T6 Jobs API with auth, deployed (B): built and tested locally; open until deployed (needs hosted Supabase + Fly.io/Railway)
- [x] T7 Mobile shell: sign in, create/list jobs (A): passes on the iOS simulator (Maestro e2e); physical-device check by you; Android deferred
- [ ] **Checkpoint 1:** CI green, API live, spikes decided, contracts frozen, ui gallery renders

## Phase 2 — Physical core (27–29 Oct)
- [x] T8 Capture photo as evidence (A): passes on the iOS simulator; camera shutter on a physical phone by you
- [x] T9 Identify asset from nameplate (B + A): live, reads makes and models from nameplates, labels and packaging (Raspberry Pi 5 box: 0.99); a physical-phone check by you
- [ ] T10 Find or attach manual (B + A): upload live (22-page kit); search live in two calls, finds the official page but prefers web pages to PDFs, so fetch can fail and the user uploads; open: steer search to PDFs
- [x] T11 Procedure from manual with citations (B + A): live, 18 steps from a 22-page manual, 15 with page citations, ~$0.12 and ~55 s
- [ ] **Checkpoint 2:** nameplate → cited procedure on phone
- [x] T12 Highlight parts on the step screen (B + A): live, boards and assemblies outlined (mask, 0.98) via plain-word concepts; small connectors are beyond SAM
- [x] T13 Safety gates on steps (A): gates, starting and finishing steps pass on the iOS simulator; refusal and skipping covered by API and integration tests; physical-device check by you
- [x] T14 Voice in and out on phone (B + A): transcription and answers live; answers name the step that covers a question; speaking on a physical phone by you
- [ ] **Checkpoint 3:** three steps by voice with highlights
- [x] T15 Step check by photo (B + A): live, fail then pass with specific reasons
- [x] T16 Parts check (B + A): live, each kind of part looked for by what it looks like; generic SAM words find nothing
- [ ] T17 Offline cache and upload queue (A): built; an offline start shows Pending and syncs on reconnect on the iOS simulator. Caching the manual PDF and reference images for offline use is not done yet
- [ ] **Checkpoint 4:** full phone path

## Phase 3 — Desktop (30 Oct)
- [x] T18 Electron shell with overlay and panel (C): verified on this Mac with one display; two displays and the built app's Screen Recording prompt are manual checks
- [ ] T19 Show me: ask → pointer + voice (C + B): live on a synthetic app, instructive replies, pointer inside the target 3 of 5 runs and 10 px below it twice; open until the T4 spike (18 of 20) in the demo app
- [ ] T20 Screen step verification (C): built and verified with fixtures; live check not yet run
- [ ] **Checkpoint 5:** teach-me-this-screen works

## Phase 4a — Product surfaces (added 25 Oct)
- [x] P1 Positioning and copy: phone = physical projects, Mac = software, Clicky-style
- [x] P2 Goal-first projects: steps from a goal; equipment and manual optional
- [x] P3 Mac: Show me without a job; Clicky-first panel; first-run setup
- [x] P4 Phone: intro, permissions, home ("What are you building or fixing?"); all phone flows pass
- [ ] P5 Website: landing page done (Next.js, light and dark, phone width); report API and share links done; report page /r/[token] and the phone's Share report to do (T23)
- [ ] P6 Known gaps: offline manual/reference caching, deploy readiness, Mac icons and packaging, design system additions
- [ ] **Checkpoint 4a:** clear what each app does; project from a sentence; Mac teaches with no job

- [x] P7 Step visuals: each step shows the user's reference photo, the cited manual page (rendered once, zoomable) and the latest photo, on the phone and the Mac; the photo check compares against the reference. Open: crop to the cited figure; reference in the report (with T23)
- [ ] P8 Mixed demo material: more than one product (electronics build, a bike repair, a home-network install) plus synthetic app screens for Show me and the T4 spike

## Phase 4b — Real product, end to end (added 27 Oct)
- [ ] R1 No demo data: fixture model mode removed (API, config, scripts, docs); production refuses to start without META_API_KEY; local test jobs, procedures, manuals and assets deleted (Pi 5 live job kept). Open: e2e flows rewritten for real model answers (with I1)
- [ ] I1 Intake at project start: one screen asks for everything that saves a round trip (goal; photos of the label, the parts and where it stands; the manual as PDF, pages or search; notes), then sets up in one pass (identify, manual, steps, parts check) with visible progress
- [ ] L1 Point the camera: live camera on the phone; ask "what is this?" or "where does this go?" by voice or tap, and Tandrix answers and highlights on the live view (frames on demand, not streamed)
- [ ] L2 Learn software on the Mac: "teach me Photoshop" starts a software project with steps done on screen, each with Show me and a screen check
- [ ] D1 Deploy: API container on Fly.io, hosted Supabase (migrations, buckets, auth), website on Vercel, EAS profiles, signed Mac build, production env checklist; deploy itself after the user's go-ahead
- [ ] **Checkpoint 6b:** a new project from intake to report on real models, on the simulator and the Mac, against the deployed stack

## Phase 4 — Continuity (31 Oct)
- [x] T21 Desktop pairing by QR (C): the Mac's live code approved on the simulator signs the panel in; pair-mac e2e passes; scanning with a physical iPhone is a manual check
- [x] T22 Handoff between devices (A + C): phone → Mac and Mac → phone live on the simulator and this Mac; 5/5 handoffs under 0.6 s locally; handoff e2e passes; hosted latency at T32
- [ ] T23 Job report and share link (B)
- [ ] **Checkpoint 6:** full spine twice; human review

## Phase 5 — Glasses (1 Nov)
- [ ] T24 Glasses module: shared interface + iOS (A)
- [ ] T24b Glasses module: Android (A)
- [ ] T25 Glasses audio + voice capture trigger, both platforms (A)
- [ ] **Checkpoint 7:** one step fully through glasses on iOS and Android

## Phase 6 — Extend and harden (2 Nov)
- [x] T26 Action guard for Do it for me (C; can start after Phase 1)
- [ ] T27 Do it for me on desktop (C)
- [ ] T28 Record mode, 6 h time-box (B + A)
- [ ] T29 Multilingual (A)
- [ ] T30 Hardening pass + negative tests (all)
- [ ] **Checkpoint 8:** feature freeze, negatives signed off

## Phase 7 — Ship (3–4 Nov)
- [ ] T31 Demo reliability + 5 rehearsals (all)
- [ ] T32 Builds and README (all)
- [ ] T33 Demo video and submission (all)
- [ ] **Checkpoint 9:** submitted by 3 PM ET 4 Nov
