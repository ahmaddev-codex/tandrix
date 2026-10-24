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
- [ ] T7 Mobile shell: sign in, create/list jobs (A)
- [ ] **Checkpoint 1:** CI green, API live, spikes decided, contracts frozen, ui gallery renders

## Phase 2 — Physical core (27–29 Oct)
- [ ] T8 Capture photo as evidence (A)
- [ ] T9 Identify asset from nameplate (B + A)
- [ ] T10 Find or attach manual (B + A)
- [ ] T11 Procedure from manual with citations (B + A)
- [ ] **Checkpoint 2:** nameplate → cited procedure on phone
- [ ] T12 Highlight parts on the step screen (B + A)
- [ ] T13 Safety gates on steps (A)
- [ ] T14 Voice in and out on phone (B + A)
- [ ] **Checkpoint 3:** three steps by voice with highlights
- [ ] T15 Step check by photo (B + A)
- [ ] T16 Parts check (B + A)
- [ ] T17 Offline cache and upload queue (A)
- [ ] **Checkpoint 4:** full phone path

## Phase 3 — Desktop (30 Oct)
- [ ] T18 Electron shell with overlay and panel (C)
- [ ] T19 Show me: ask → pointer + voice (C + B)
- [ ] T20 Screen step verification (C + B)
- [ ] **Checkpoint 5:** teach-me-this-screen works

## Phase 4 — Continuity (31 Oct)
- [ ] T21 Desktop pairing by QR (C + A)
- [ ] T22 Handoff between devices (all)
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
