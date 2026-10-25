# Tandrix MVP — Task list

See [plan.md](plan.md) for descriptions, acceptance criteria and verification.
Tracks: **D** design, **A** mobile & glasses, **B** API & AI, **C** desktop (macOS).

## Phase 0 — Prep (24–25 Oct)
- [ ] T0.1 Meta API smoke script (B)
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
- [ ] T9 Identify asset from nameplate (B + A): built, fallback verified on the simulator; open until Meta billing works and the demo nameplate reads correctly
- [ ] T10 Find or attach manual (B + A): built; upload and photographed pages pass on the iOS simulator, search fallback verified through a real 402; open until search finds the demo pump manual live (billing). Offline upload queue moves to T17
- [ ] T11 Procedure from manual with citations (B + A): built; rules, transaction and race tested; steps and Generic path pass on the iOS simulator with the local fixture; open until Spark drafts the demo pump procedure live (billing)
- [ ] **Checkpoint 2:** nameplate → cited procedure on phone
- [ ] T12 Highlight parts on the step screen (B + A): built; highlight, corrections and fallback pass on the iOS simulator with the local fixture; open until spike-level accuracy on the real pump photos (billing + T0.3 photos)
- [x] T13 Safety gates on steps (A): gates, starting and finishing steps pass on the iOS simulator; refusal and skipping covered by API and integration tests; physical-device check by you
- [ ] T14 Voice in and out on phone (B + A): built; hold-to-talk, transcript and spoken answer pass on the iOS simulator with the fixture; open until three real steps are done by voice on a device with the live model (billing)
- [ ] **Checkpoint 3:** three steps by voice with highlights
- [ ] T15 Step check by photo (B + A): built; needs attention then verified passes on the iOS simulator with the fixture; open until Spark judges the real pump stages (billing)
- [ ] T16 Parts check (B + A): built; missing part blocks its step and a correction releases it on the iOS simulator with the fixture; open until the demo layout is checked live (billing + T0.3 photos)
- [ ] T17 Offline cache and upload queue (A): built; an offline start shows Pending and syncs on reconnect on the iOS simulator. Caching the manual PDF and reference images for offline use is not done yet
- [ ] **Checkpoint 4:** full phone path

## Phase 3 — Desktop (30 Oct)
- [x] T18 Electron shell with overlay and panel (C): verified on this Mac with one display; two displays and the built app's Screen Recording prompt are manual checks
- [ ] T19 Show me: ask → pointer + voice (C + B): built; typed question → screenshot → pointer verified on this Mac with fixtures; open until the live model hits ≥ 9/10 in the demo app (billing, T4); speaking a question is a manual check
- [ ] T20 Screen step verification (C): built; start → check → needs attention → verified on this Mac with fixtures, recorded as desktop; open until a live check (billing); phone Maestro flows not rerun
- [ ] **Checkpoint 5:** teach-me-this-screen works

## Phase 4a — Product surfaces (added 25 Oct)
- [ ] P1 Positioning and copy: phone = physical projects, Mac = software, Clicky-style
- [ ] P2 Goal-first projects: steps from a goal; equipment and manual optional
- [ ] P3 Mac: Show me without a job; Clicky-first panel; first-run setup
- [ ] P4 Phone: intro, permissions, home ("What are you building or fixing?")
- [ ] P5 Website: landing page + job report and share link (T23)
- [ ] P6 Known gaps: offline manual/reference caching, deploy readiness, Mac icons and packaging, design system additions
- [ ] **Checkpoint 4a:** clear what each app does; project from a sentence; Mac teaches with no job

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
