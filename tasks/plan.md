# Implementation Plan: Tandrix Hackathon MVP

**Build window:** Mon 26 Oct – Wed 4 Nov 2026 (submit by 3 PM ET on 4 Nov; hard deadline 9 PM ET)
**Spec:** [PRD](../docs/product/PRD.md) · [User flows](../docs/product/User_Flows.md) · [Architecture](../docs/engineering/Architecture.md) · [Hackathon plan](../docs/engineering/Hackathon_Plan.md)

## Overview

Tandrix is one job session shared across three surfaces: a phone app (Expo) that identifies equipment, checks parts and guides assembly by highlighting real parts; Ray-Ban Meta glasses as a hands-free camera/mic/speaker for the phone app; and a desktop app (Electron) that teaches any screen by pointing (**Show me**) or, when the user opts in, by acting (**Do it for me**). A Hono API orchestrates Meta models (`muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`) and persists everything in Supabase. The demo is a real pump job: nameplate → manual → parts check → guided steps (phone + glasses) → handoff to desktop → report.

## Architecture decisions

| Decision | Rationale |
|---|---|
| pnpm monorepo: `apps/{mobile,desktop,api}`, `packages/{contracts,core,ai}` | Three clients share one contract and one set of status/safety rules. |
| `packages/contracts` (Zod) is the single source of truth for every payload and model output | Lets the three tracks work in parallel once the contract is fixed. |
| Status, safety-gate and desktop action-guard rules live in `packages/core` as pure, deterministic functions | Model output can't bypass them; trivially unit-testable. |
| One `PointerTarget` type for camera highlights and screen pointer | Same rendering contract on both surfaces; same audit trail. |
| Supabase Realtime for cross-device sync | Handoff without building our own pub/sub. |
| Voice: server WS proxy to Muse Voice Transcribe; TTS on device | Keeps the key server-side; Meta has no TTS. |
| Expo dev client from day 2 | Glasses need a native module; avoid late native rebuild churn. |
| Desktop "Do it for me" executes only through `core.actionGuard` + interrupt watcher | Opt-in control without giving the model unchecked input. |
| Design system first: chosen (T0.5), documented (T0.6) and shipped as `packages/ui` tokens + core components (T0.7) before any UI task | Every surface builds on one system; no ad-hoc styling. |
| Desktop targets macOS only for the MVP | Single permission model (Screen Recording, Accessibility), one signed/notarised build. |
| Glasses on both iOS and Android | Wearables toolkit supports both; one Expo native module with Swift and Kotlin sides. |
| Recorded model responses as test fixtures | Deterministic CI for AI pipelines; live calls only in spikes and rehearsals. |

## Dependency graph

```
design direction ──► design system docs ──► ui (tokens + components) ──► every UI task
contracts (Zod) ──► core (status, safety, action guard)
     │                    │
     ├──► Supabase schema + RLS ──► API (auth, jobs, evidence upload)
     │                                  │
     │       ai (Meta client, prompts) ─┤
     │                                  ├──► identify / manual / procedure ──► mobile step list
     │                                  ├──► highlight (SAM) ──► mobile step screen ──► glasses capture
     │                                  ├──► check / parts-check ──► mobile statuses
     │                                  ├──► voice WS proxy ──► mobile PTT ──► glasses audio
     │                                  ├──► screen/ask ──► desktop Show me ──► desktop Do it for me
     │                                  └──► realtime + report ──► handoff, share link
     └──► fixtures/demo-pump (photos, manual, recorded responses) ──► tests + demo cache
```

## Parallel tracks (virtual team)

Once Phase 1 is done (contracts + schema + API skeleton + `packages/ui`), three tracks run in parallel, with design reviewing every UI task:

- **Track D — Design:** T0.5–T0.7, then design review on every UI task and extensions to the system as gaps appear
- **Track A — Mobile & glasses:** T7, T11–T14 UI parts, T15–T17 UI, T25–T26
- **Track B — API & AI pipelines:** T8–T10, T11 pipeline, T15–T16 pipelines, T23–T24, T27
- **Track C — Desktop:** T18–T21

Contract changes go through `packages/contracts` first and are reviewed by all tracks.

## Phases and tasks

Sizes: XS 1 file · S 1–2 · M 3–5 · L 5–8 (split if larger). Commands assume the root scripts from T0.4: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter <pkg> <script>`.

---

### Phase 0 — Prep (Sat 24 – Sun 25 Oct)

#### T0.1 Meta API smoke script
**Description:** A script that makes one real call each to `muse-spark-1.3` (text + image), `sam-3.1` (image + noun phrase) and `muse-voice-transcribe-1.0` (short audio file), and prints latency, token usage and rate-limit headers.
**Acceptance:** all three calls succeed with our key; limits recorded in `docs/engineering/spikes.md`.
**Verification:** `pnpm smoke:meta` (reads `.env.local`) prints four passing checks: Spark text, Spark image + structured output, SAM, Voice Transcribe.
**Dependencies:** None. **Files:** `scripts/smoke-meta.ts`, `docs/engineering/spikes.md`. **Size:** S

#### T0.2 Glasses toolkit sample
**Description:** Get Wearables Developer Center access, pair glasses, run Meta's sample app on the target phone.
**Acceptance:** sample app receives a photo and a camera stream from the glasses.
**Verification:** manual; notes + SDK version in `spikes.md`.
**Dependencies:** None. **Files:** `docs/engineering/spikes.md`. **Size:** XS

#### T0.3 Demo fixtures
**Description:** Photograph the demo pump: nameplate, all parts laid out (with one O-ring removed for the "missing" case), each assembly stage from 2–3 angles. Add manual PDF. Choose the desktop software for the handoff step.
**Acceptance:** `fixtures/demo-pump/` contains labelled photos, manual, and `README.md` describing each file; desktop app choice recorded.
**Verification:** manual review.
**Dependencies:** None. **Files:** `fixtures/demo-pump/**`. **Size:** S

#### T0.4 Monorepo skeleton + CI
**Description:** pnpm workspace, shared tsconfig, ESLint, Prettier, Vitest; empty packages and apps that build; GitHub Actions running lint, typecheck, test.
**Acceptance:** `pnpm install && pnpm typecheck && pnpm test` passes on a clean clone; CI green.
**Verification:** CI run on first push.
**Dependencies:** None. **Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.github/workflows/ci.yml`, package stubs. **Size:** M

#### T0.5 Choose the design direction
**Description:** Review the three candidate design systems (Callout, Signal, Viewfinder) applied to real Tandrix screens and pick one or a defined mix. Artifact: https://claude.ai/artifact/A1XC5MQ8tY7sRGhg4ojgXd
**Acceptance:** a written decision naming the direction and any borrowed elements.
**Verification:** decision recorded in `docs/design/decision.md`.
**Dependencies:** None. **Files:** `docs/design/decision.md`. **Size:** XS

#### T0.6 Document the Tandrix design system
**Description:** Full reference for the chosen direction: colour tokens (light, dark, sunlight/high-contrast, glasses lens), type scale and fonts, spacing, radius, elevation, motion, iconography, highlight and pointer specs, status and safety semantics, voice and copy rules, and component guidelines with states.
**Acceptance:** every component the product needs has a spec with states; every status in Architecture §4 has a visual; token names are final.
**Verification:** design review sign-off; published as the Tandrix design system reference.
**Dependencies:** T0.5. **Files:** `docs/design/*`. **Size:** M

#### T0.7 `packages/ui`: tokens and core components
**Description:** Tokens as a single source (JSON) compiled to a React Native theme (mobile) and CSS variables (desktop renderer, web report); core components: Button, StatusChip, SourceChip, StepCard, SafetyGate, PartHighlight, PointerBuddy, ConfirmDialog, ControlIndicator.
**Acceptance:** mobile and desktop render the same components from the same tokens; no hard-coded colours or sizes outside `packages/ui` (lint rule).
**Verification:** `pnpm --filter @tandrix/ui test`; component gallery screen on phone and in Electron.
**Dependencies:** T0.6, T0.4. **Files:** `packages/ui/{tokens,native,web}/*`, `eslint` rule. **Size:** M
**Status (24 Oct):** Done, with one deliberate scope change. Shipped: the token compiler (TS for native, CSS for web, output identical to the design system's `tokens.css`); all 14 web components the Mac app and report need; the native foundation (ThemeProvider with Sunlight switching, Text, Icon, Button, StatusChip, SourceChip); the raw-colour lint rule (colours only: hard-coded sizes are not lint-enforced yet and are caught in design review); 22 tests covering contrast in every theme, generated-file freshness, token drift against the docs mirror, and component behaviour. The phone-only feature components are built natively inside T8, T12, T13, T15 and T16, and the gallery screens move to T7 (phone) and T18 (Mac), because those apps don't exist yet.

---

### Phase 1 — Foundation and spikes (Mon 26 Oct)

#### T1 Contracts: core entities
**Description:** Zod schemas + types for Asset, Manual, Procedure, ProcedureStep, PartSpec, Job, JobStep, Evidence, Detection, PointerTarget, Check, PartsCheck, SafetyConfirmation, Event, DesktopAction, ControlMode.
**Acceptance:** schemas match Architecture §4; strict (unknown keys rejected, string length caps); exported types used by all packages.
**Verification:** `pnpm --filter @tandrix/contracts test` (valid/invalid samples per schema).
**Dependencies:** T0.4. **Files:** `packages/contracts/src/{entities,api,model-outputs}.ts`, tests. **Size:** M

#### T2 Core rules: step status + safety gates
**Description:** Pure functions: `transitionStep(step, event)`, `canStart(step, confirmations)`, `applyPartsCheck(steps, result)`.
**Acceptance:** only a `pass` Check on evidence captured after step start yields `verified`; hazard-tagged steps can't start without matching confirmations; missing parts block dependent steps; model output can add but never remove hazard tags.
**Verification:** `pnpm --filter @tandrix/core test` (table-driven tests covering every transition).
**Dependencies:** T1. **Files:** `packages/core/src/{status,safety}.ts`, tests. **Size:** M

#### T3 Spike: SAM highlighting
**Description:** Run SAM 3.1 + Spark "pick the right box" on 10 fixture photos for the step parts.
**Acceptance:** accuracy recorded; go/no-go on fallback (point prompts, box-only, numbered callouts).
**Verification:** results table in `spikes.md` with annotated output images in `fixtures/demo-pump/spike-out/`.
**Dependencies:** T0.1, T0.3. **Files:** `scripts/spike-sam.ts`, `spikes.md`. **Size:** S

#### T4 Spike: screen pointing
**Description:** 20 targets in the chosen desktop app; Spark computer-use `move` coordinates vs ground truth.
**Acceptance:** hit rate recorded; ≥ 18/20 → go; else choose fallback (accessibility lookup or SAM snapping) and note it.
**Verification:** results table + overlay images in `spikes.md`.
**Dependencies:** T0.1, T0.3. **Files:** `scripts/spike-pointing.ts`, `spikes.md`. **Size:** S

#### T5 Spike: nameplate → manual
**Description:** Spark reads the nameplate; search grounding finds the manual.
**Acceptance:** correct model and manual URL for the demo pump, or decision that upload is the demo path.
**Verification:** result in `spikes.md`.
**Dependencies:** T0.1, T0.3. **Files:** `scripts/spike-nameplate.ts`, `spikes.md`. **Size:** XS

#### T6 Jobs API with auth, deployed
**Description:** Supabase migrations for all tables in Architecture §4 with RLS by owner; Hono app with Supabase JWT middleware, `/health`, `POST/GET /jobs`, `GET /jobs/:id`; deploy to Fly.io/Railway.
**Acceptance:** authenticated user can create and list only their own jobs; second user can't read them; `/health` live.
**Verification:** `pnpm --filter @tandrix/api test` (integration tests against local Supabase), `curl` against deployed URL.
**Dependencies:** T1. **Files:** `supabase/migrations/0001_init.sql`, `apps/api/src/{index,auth,routes/jobs}.ts`, tests, `fly.toml`. **Size:** M
**Status (24 Oct):** Built and verified locally; not done until deployed. Done: migration for all Architecture §4 tables (incl. share_links) with read-only RLS for clients and explicit grants; transactional `create_job`; Hono API (`/health`, `POST/GET /jobs`, `GET /jobs/:id`) verifying Supabase tokens via JWKS; 27 unit + schema-drift tests (CI) and 11 integration tests against the local stack, including direct-database attacks (each security test was confirmed to fail when the protection is removed); bundled build, Dockerfile (81 MB image, runs as the unprivileged node user; verified against the local stack, and both environment guards verified to reject wrong targets) and `apps/api/fly.toml`. Open: hosted Supabase project + `supabase db push` + the sign-in code email template (`supabase/templates/sign-in-code.html` into Auth > Email Templates > Magic Link), Fly.io/Railway account + deploy, then `curl` `/health` on the public URL. Actual paths: `supabase/migrations/20261024083431_init.sql`, `apps/api/src/{server,app,auth,config,errors}.ts`, `routes/jobs.ts`, `repos/jobs.ts`; integration tests run with `pnpm test:integration`.

#### T7 Mobile shell: sign in, create and list jobs
**Description:** Expo app with expo-router and dev client; Supabase auth (email magic link or OTP); Home screen listing jobs; New job.
**Acceptance:** on a physical phone, sign in, create a job, see it after app restart.
**Verification:** manual on device; `pnpm --filter @tandrix/mobile typecheck`.
**Dependencies:** T6, T0.7. **Files:** `apps/mobile/app/{_layout,index,new-job}.tsx`, `apps/mobile/src/{api,auth}.ts`. **Size:** M
**Status (24 Oct):** Done on the iOS simulator, which is the verification bar for phone tasks; physical-device checks are done by hand by the product owner. Expo SDK 58 app (dev client) with Expo Router, Geist fonts and `@tandrix/ui` themes; email-code sign-in (custom code email; codes are single-use) plus a local-only password sign-in; Keychain session storage; jobs list, new job, local-only design gallery in all three themes (the T0.7 phone gallery). Maestro e2e (`pnpm --filter @tandrix/mobile e2e`): sign in → create a uniquely named job → restart → still signed in and job listed; gallery screenshots reviewed. Fixed on the way: duplicate React Native between the app and `@tandrix/ui` (Metro singletons; bundle checked: one copy, no secret key); email had no code; keyboard hid the local sign-in option (no autofocus on the email screen); wrong subtitle on the password screen. Manual (product owner): physical iPhone (LAN IP in `apps/mobile/.env.local`). Deferred: Android (needs JDK 17; this Mac has 25). Actual paths: `apps/mobile/src/app/{_layout,sign-in}.tsx`, `src/app/(app)/{_layout,index,new-job,gallery}.tsx`, `src/lib/{env,supabase,secure-storage,api,auth}.ts(x)`, `e2e/*.yaml`.

### Checkpoint 1 — end of Mon 26 Oct
- [ ] CI green; API deployed; phone app creates/lists jobs.
- [ ] Spike results in `spikes.md`; fallback decisions made for SAM, pointing, manual.
- [ ] Contracts reviewed by all tracks and frozen for Phase 2 (changes by PR only).
- [ ] Design system documented; `packages/ui` gallery renders on phone and Mac.

---

### Phase 2 — Physical core (Tue 27 – Thu 29 Oct)

#### T8 Capture photo as evidence
**Description:** Capture screen (camera, retake, preview); signed upload URL from API; Evidence row; downscale on device.
**Acceptance:** photo captured on the phone appears in Supabase Storage (private) linked to the job; permission denied falls back to photo picker.
**Verification:** API test for upload handshake; manual on device.
**Dependencies:** T7. **Files:** `apps/mobile/app/capture.tsx`, `apps/mobile/src/capture/*.ts`, `apps/api/src/routes/evidence.ts`. **Size:** M
**Status (24 Oct):** Done on the iOS simulator. Flow: create (row + signed upload URL, type/size checked) → direct upload to the private `evidence` bucket → confirm (stored size/type checked, bad files deleted) → photo grid with signed read URLs. Clients can't see unconfirmed evidence or touch the bucket. Photos are resized on the phone (long edge 2048, JPEG 0.8). Native `CaptureView` added to `@tandrix/ui`. Verified: 9 API unit + 6 storage integration tests (security tests confirmed to fail when the protection is removed); Maestro photo flow with camera access revoked (fallback message, picker, upload, grid) and the stored object checked against its row. Manual (product owner): taking a photo with the camera shutter on a physical iPhone. Actual paths: `supabase/migrations/20261024103651_evidence_uploads.sql`, `apps/api/src/{repos,routes}/evidence.ts`, `apps/mobile/src/app/(app)/job/[id]/{index,capture}.tsx`, `apps/mobile/src/lib/evidence.ts`, `apps/mobile/e2e/photo-evidence.yaml`.

#### T9 Identify asset from nameplate
**Description:** `/assets/identify` pipeline (Spark structured output) + Asset screen with editable make/model/serial and confidence.
**Acceptance:** demo nameplate → correct make/model; low confidence shows "Possible match"; user edits persist.
**Verification:** `pnpm --filter @tandrix/ai test` with recorded response; manual on device.
**Dependencies:** T8, T5. **Files:** `packages/ai/src/identify.ts`, `apps/api/src/routes/assets.ts`, `apps/mobile/app/asset.tsx`. **Size:** M
**Status (24 Oct):** Built and verified on the iOS simulator; open until the live model reads the demo nameplate. Flow: photograph the nameplate (camera or picker) → `POST /jobs/:id/asset/identify` (Spark via `@tandrix/ai`) → editable make/model/serial with "Possible match" below `NAMEPLATE_CONFIDENT` (0.8) → `PUT /jobs/:id/asset` saves, links the job and records the source. Any model failure becomes a plain-language fallback to typing. Verified: 11 API unit tests (reader: reading, unreadable, 402/429/503, invalid output, no image or key in logs), 5 integration tests (exact bytes to the reader, save + event, ownership, client can't call the save function); Maestro flow through the real fallback (Spark answered 402 billing) and screenshots reviewed. Open: Meta billing (T0.1) and the demo nameplate photo (T0.3) to verify a real reading, the "Possible match" banner on device, and T5. Found and fixed on the way: database errors bypassed the API error handler (empty 500, no log); stale sessions after a database reset now sign out on 401.

#### T10 Find or attach manual
**Description:** `/jobs/:id/manual`: search grounding → candidate URLs (signed per user, URL and model) → SSRF-safe PDF fetch → shared store; upload fallback (PDF, or photographed pages combined into a PDF) from the phone, private to the user.
**Acceptance:** source shown; manual cached by model key; only URLs the search returned can be fetched; uploaded manuals stay private. Queuing an upload while offline is part of T17.
**Verification:** API unit tests (SSRF refusals, tokens, non-PDF and broken PDF rejected) and integration tests against local Supabase; Maestro `manual-from-pages.yaml`; live search once billing works.
**Dependencies:** T9. **Files:** `packages/ai/src/manual.ts`, `apps/api/src/{safe-fetch,signed-token,pdf,manual-finder}.ts`, `apps/api/src/routes/manual.ts`, `apps/mobile/src/app/(app)/job/[id]/{manual,pages}.tsx`. **Size:** M

#### T11 Procedure from manual with citations
**Description:** `/procedures/generate` (Spark + PDF) → PartSpecs + ProcedureSteps with citation and hazard tags; job steps instantiated; step list on phone with source chips. Generic path when no manual.
**Acceptance:** each step has a citation or is labelled Generic; schema-invalid output repaired once then rejected; progress shown while generating (time-based for now; async + Realtime in T30).
**Verification:** `pnpm --filter @tandrix/ai test` (recorded responses incl. malformed); manual.
**Dependencies:** T10, T2. **Files:** `packages/core/src/procedure.ts`, `packages/ai/src/pipelines.ts`, `apps/api/src/{procedure-generator,routes/procedure,repos/procedures}.ts`, `supabase/migrations/*_save_procedure.sql`, `apps/mobile/src/app/(app)/job/[id]/{index,procedure}.tsx`. **Size:** M

### Checkpoint 2 — end of Tue 27 Oct
- [ ] Nameplate photo → procedure with cited steps on the phone, end to end on device.

#### T12 Highlight parts on the step screen
**Description:** `/jobs/:id/steps/:stepId/highlight` (SAM per part phrase, Spark disambiguation) → PointerTargets; step screen renders mask/box with label and confidence (react-native-svg; SAM masks traced to SVG paths, so no Skia); tap to correct; numbered-text fallback.
**Acceptance:** spike-level accuracy on fixtures; correction stored on Detection; no-detection shows angle hint.
**Verification:** `pnpm --filter @tandrix/ai test`; manual on the real pump.
**Dependencies:** T11, T3. **Files:** `packages/ai/src/{sam,pipelines}.ts`, `apps/api/src/{highlighter,routes/steps,repos/detections}.ts`, `packages/ui/src/native/{highlight,step,label-layout}.tsx`, `apps/mobile/src/app/(app)/job/[id]/step/[stepId].tsx`. **Size:** M

#### T13 Safety gates on steps
**Description:** SafetyGate UI on hazard-tagged steps using `core.transitionStep` (gates before start, refusal for live electrical work); confirmations persisted; `core.refusalForRequest` for free-text requests (used by the assistant in T14).
**Acceptance:** hazardous step can't start until confirmed; wiring/live-work requests refused with "qualified person" message.
**Verification:** core tests; API test for refusal prompt; manual.
**Dependencies:** T12, T2. **Files:** `packages/ui/src/native/feedback.tsx` (SafetyGate), `apps/mobile/src/components/step-work.tsx`, `apps/api/src/{routes/steps,repos/step-state}.ts`, `supabase/migrations/*_step_actions.sql`, `packages/core/src/safety.ts`. **Size:** S

#### T14 Voice in and out on phone
**Description:** push-to-talk on phone (16 kHz mono WAV per turn) → `/voice/transcribe` (Muse Voice Transcribe, push-to-talk mode; replaces the planned WS stream, see Architecture); voice commands (next, back, repeat, show me again, I'm stuck, start, done, skip, stop) mapped to step actions; free questions answered in step context; wiring/live work refused before any model call; TTS via `expo-speech`.
**Acceptance:** three real steps completed by voice only; transcript and reply text shown; key never reaches client.
**Verification:** API tests with real WAV bytes; core command tests; Maestro `voice-step.yaml` with the fixture; manual on device in a noisy room once billing works.
**Dependencies:** T12. **Files:** `apps/api/src/voice.ts`, `apps/mobile/src/voice/{ptt,tts}.ts`, `apps/mobile/src/components/step-work.tsx`, `packages/ai/src/{audio,pipelines}.ts`, `packages/core/src/voice.ts`, `packages/ui/src/native/voice.tsx`. **Size:** M

### Checkpoint 3 — end of Wed 28 Oct
- [ ] Three real pump steps guided by voice with highlighted parts and safety gate.

#### T15 Step check by photo
**Description:** `/steps/:id/check` → Check (pass / fail / not_verifiable + reason); CheckResult UI with reference image; statuses via `core.transitionStep`.
**Acceptance:** correct stage → verified; deliberately wrong stage → needs attention with a specific reason; torque-type step → not verifiable → user-confirmed.
**Verification:** `pnpm --filter @tandrix/ai test` (fixtures for each outcome); manual.
**Dependencies:** T12. **Files:** `apps/api/src/{step-checker,routes/steps,repos/step-state}.ts`, `supabase/migrations/*_record_check.sql`, `packages/ui/src/native/feedback.tsx` (CheckResult), `apps/mobile/src/{app/(app)/job/[id]/step/[stepId],components/step-work}.tsx`. Reference images per step come with recorded procedures (T28). **Size:** M

#### T16 Parts check
**Description:** `/parts-check` (SAM all objects + Spark assignment to PartSpecs); PartsList UI with found/possible/missing; corrections; missing parts block dependent steps.
**Acceptance:** demo layout: all present parts found, removed O-ring flagged missing; correction updates result.
**Verification:** ai test with fixture; core test for blocking; manual.
**Dependencies:** T11, T2. **Files:** `apps/api/src/{parts-checker,routes/parts,repos/parts-checks}.ts`, `supabase/migrations/*_parts_check.sql` (adds `job_steps.blocked_by`), `packages/core/src/parts.ts`, `apps/mobile/src/app/(app)/job/[id]/{index,parts}.tsx`. **Size:** M

#### T17 Offline cache and upload queue
**Description:** Cache procedure, manual pages, reference images per job; queue evidence uploads and checks; "pending" state.
**Acceptance:** airplane mode mid-job: steps still navigable, captures queued, synced on reconnect.
**Verification:** unit tests for queue; manual airplane-mode run.
**Dependencies:** T15. **Files:** `apps/mobile/src/offline/{queue,store,index}.ts`, `apps/mobile/src/components/step-work.tsx`, `packages/contracts/src/api.ts` (`occurredAt`), `apps/api/src/routes/steps.ts`. Manual PDF and reference image caching left for later. **Size:** S

### Checkpoint 4 — end of Thu 29 Oct
- [ ] Full phone path: identify → manual → parts check (missing flagged) → steps with highlights, voice, checks.
- [ ] Recorded-response tests cover every AI pipeline; CI green.

---

### Phase 3 — Desktop (Fri 30 Oct; Track C can start after Checkpoint 1)

#### T18 Electron shell with overlay and panel
**Description:** macOS-only Electron app: main process, menu-bar panel window (job, steps, mic state, mode), transparent click-through always-on-top overlay per display, Screen Recording permission onboarding; sign-in. Built on `packages/ui`.
**Acceptance:** overlay draws a test pointer on each monitor at a given coordinate; panel shows the signed-in user's active job.
**Verification:** `pnpm --filter @tandrix/desktop test` (coordinate mapping unit tests); manual on macOS with two displays.
**Dependencies:** T6, T0.7. **Files:** `apps/desktop/src/main/{index,windows,displays}.ts`, `apps/desktop/src/renderer/{panel,overlay}.tsx`. **Size:** M

**Status (25 Oct):** Built and verified on this Mac (one Retina display). Menu-bar panel with email-code and local sign-in, the active job and its steps (web `Notice` and `StepRow` added to `@tandrix/ui`; step chip/citation helpers moved there from the phone app), Screen Recording notice with the system prompt or System Settings, and "Test the pointer"; an overlay per display. Verified: 17 desktop unit tests (display mapping with a negative-origin second display and downsized Retina captures; `app://` path confinement; active job choice); signed in through the panel over the DevTools protocol, panel showed the active job, test pointer seen at the screen centre over a full-screen app; dev restarts keep the session; the production build loads from `app://tandrix` and reads the job once the API allows that origin; Mac component gallery reviewed in all three themes. Manual (product owner): two displays, the Screen Recording prompt for a built app. Moved: mode toggle to T27, mic state to T19. Fixed on the way: the panel at 380 px cut off the generic source chip (now 400 px); restarts raced the single-instance lock; Electron started as Node under editors that set `ELECTRON_RUN_AS_NODE`. Actual paths: `apps/desktop/src/main/{index,windows,displays,app-protocol,screen-access,session-store}.ts`, `src/preload/index.ts`, `src/shared/bridge.ts`, `src/renderer/{panel,overlay,gallery}.tsx`, `src/renderer/panel/{SignIn,Home}.tsx`, `src/renderer/lib/*`, `scripts/dev.ts`.

#### T19 Show me: ask → pointer + voice
**Description:** Hold-to-talk hotkey; desktopCapturer screenshot with scale/origin; `/screen/ask` (Spark computer-use, render-only) → reply + PointerTarget; pointer flies with caption; TTS. Fallback from T4 if needed.
**Acceptance:** ≥ 9/10 on target in the demo app; any non-`move` action rendered as instruction, never executed.
**Verification:** api test with recorded responses; coordinate tests; manual.
**Dependencies:** T18, T4, T14 (voice proxy). **Files:** `apps/desktop/src/main/{hotkey,capture}.ts`, `apps/api/src/routes/screen.ts`, `packages/ai/src/screen.ts`, `apps/desktop/src/renderer/PointerBuddy.tsx`. **Size:** M

**Status (25 Oct):** Built; open until the live model is measured (≥ 9/10, with T4) once Meta billing works and the demo desktop app is chosen (open question 1). Flow: ⌃⌥Space (tap to listen, tap to ask; Esc cancels), the panel's hold-to-talk mic, or a typed question → screenshot of the display under the cursor (1280 px JPEG, uploaded as job evidence while the question is transcribed) → `POST /jobs/:id/screen/ask` (Spark computer-use, one turn; the current step as context) → the pointer flies to the first positioned action with the reply as its caption, the reply is spoken (Web Speech) and shown in a web `VoiceTranscript` (added to `@tandrix/ui`). Nothing is executed: proposed actions are returned for drawing and for T27. Verified: 3 ai tests (request shape with the computer tool; reply and actions with rounding; invalid actions dropped, safety checks counted), 8 API tests (context, evidence ownership and kind, malformed requests, off-screen points, empty replies, unavailable), WAV encoder tests; on this Mac with `dev:fixtures` a typed question captured a 1280×800 screenshot without the panel, uploaded it, and the pointer landed at (480, 300) on the 1440×900 display, a third of the way in as scripted; 46 integration tests still pass. Manual (product owner): speaking a question (hotkey and mic button; the microphone prompt), hearing the reply, two displays. Decisions: the hotkey can't be held (Electron reports no key-up); `PointerTarget.confidence` is optional because computer use gives none. Actual paths: `packages/ai/src/screen.ts`, `apps/api/src/{screen-guide,routes/screen,fixtures/screen}.ts`, `apps/desktop/src/main/{capture,hotkey,show-me}.ts`, `apps/desktop/src/renderer/lib/{recorder,pcm-capture.worklet.js,wav,speech,screenshot,use-show-me}.ts`, `apps/desktop/src/renderer/panel/ShowMe.tsx`, `packages/ui/src/web/voice.tsx`.

#### T20 Screen step verification
**Description:** After the user acts, re-capture (hotkey or auto) and check expected screen state; set job step verified or user-confirmed.
**Acceptance:** desktop step in the job turns verified on correct screen state, needs attention otherwise.
**Verification:** ai test; manual.
**Dependencies:** T19, T15. **Files:** `packages/ai/src/check.ts`, `apps/desktop/src/main/verify.ts`. **Size:** S

**Status (25 Oct):** Built and verified on this Mac with fixtures; open until a live check on the demo app (billing). The check route takes a screenshot (not a photo) for `screen` steps and asks Spark with a screen prompt; the panel shows the current desktop step in a web `StepCard` (added to `@tandrix/ui`) with Start, "Check my screen" and, after a not-verifiable answer, "I've done it"; the result is a `CheckResult` with a screen chip (`evidenceKind` added) and is spoken. The phone no longer offers a photo check on screen steps and says to finish them on the Mac. Actions from the Mac are recorded as `desktop` (`X-Tandrix-Surface`); checks use the evidence's surface (both were hard-coded to the phone). The fixture procedure gained a desktop step 5. Verified: ai tests (screen prompt; photo rules by default), API tests (screen step takes only a screenshot and records `desktop`; a photo step refuses a screenshot; surface header), desktop step choice tests; on this Mac a new job's step 5 went start → "Check my screen" → needs attention → "Check again" → verified, with every event in the database marked `desktop` and the verified status on the screenshot. Not rerun: the phone Maestro flows (two now expect 5 steps). Actual paths: `packages/ai/src/{pipelines,prompts}.ts`, `apps/api/src/{step-checker,routes/steps,fixtures/check,fixtures/procedure}.ts`, `apps/desktop/src/renderer/{lib/desktop-step.ts,panel/DesktopStep.tsx}`, `packages/ui/src/web/{cards,job}.tsx`, `apps/mobile/src/components/step-work.tsx`. Auto re-capture after the user acts was not built; the check is on demand.

### Checkpoint 5 — end of Fri 30 Oct
- [ ] "Teach me this screen" works in the demo app with pointer + voice; screen step verifies.

---

### Phase 4 — Continuity (Sat 31 Oct)

#### T21 Desktop pairing by QR
**Description:** Desktop shows a short-lived pairing code/QR; phone scans and approves; desktop gets a session for the same user.
**Acceptance:** pairing in under 20 s; code single-use and expires in 2 min.
**Verification:** API tests for code lifecycle; manual.
**Dependencies:** T18, T7. **Files:** `apps/api/src/routes/pairing.ts`, `apps/desktop/src/renderer/pair.tsx`, `apps/mobile/app/pair.tsx`. **Size:** M

**Status (25 Oct):** Done on this Mac and the iOS simulator. The signed-out panel shows a QR (`tandrix://pair?code=…`, always dark on light) and the code as text, renewed every 2 minutes and polled every 1.5 s while the panel is open; the phone opens it from the camera app or its own scanner (`expo-camera` QR), or takes the typed code, shows "Sign in {Mac}?" and approves; the Mac exchanges the one-time token and the panel opens on the active job. Verified: 3 contract tests (code normalisation, links), 8 API tests (lifecycle, two-minute expiry, approve once, use once, signed-in phone only, poll token required, hashes only, mint failure, rate limits), 2 integration tests on the local stack (the minted token signs in as the approving user, only once; clients can't read pairings), scan-link parsing tests; on this Mac + simulator: the Mac's live code approved on the phone and the panel signed itself in within one poll; `pair-mac/run.sh` passes; the panel's QR decodes to its code (Core Image). Manual (product owner): scanning the QR with a physical iPhone. Actual paths: `packages/contracts/src/pairing.ts`, `supabase/migrations/20261025170000_pairings.sql`, `apps/api/src/{routes/pairing,repos/pairings,session-minter,rate-limit}.ts`, `apps/desktop/src/renderer/{panel/PairWithPhone,panel/QrCode,lib/pairing}.ts(x)`, `apps/mobile/src/app/(app)/pair.tsx`, `apps/mobile/src/lib/pairing.ts`, `apps/mobile/e2e/pair-mac/`.

#### T22 Handoff between devices
**Description:** `/jobs/:id/handoff`; Supabase Realtime subscription on both apps; desktop notification opens the job at the current step; phone shows "Waiting on desktop".
**Acceptance:** desktop opens the step within 3 s; status changes on either device appear on the other.
**Verification:** API test; manual 5/5 runs.
**Dependencies:** T21, T20. **Files:** `apps/api/src/routes/handoff.ts`, `apps/mobile/src/realtime.ts`, `apps/desktop/src/main/realtime.ts`. **Size:** M

**Status (25 Oct):** Done on this Mac and the iOS simulator, on the local stack. `POST /jobs/:id/handoff` (`hand_off_job`: active device, current step and a `handoff` event in one transaction; `events` added to Realtime). Phone: "Continue on Mac" on a desktop step, "Waiting on your Mac" on the step and job with "Back to physical steps", live reload of the open job and step. Mac: listens for handoff events, opens the job, macOS notification and incoming banner ("Open step 5"), live reload. Verified: 2 API tests, 2 integration tests (the owner's client hears the handoff over Realtime in time and another user doesn't; the event records who sent it; a step from another job or another user's job is refused), parser tests; the phone flow sent step 5 and the Mac panel showed "…: step 5 is ready"; the Mac's check turned the phone's open step Verified with no refresh; 5/5 handoffs reached the Mac panel in 0.25–0.59 s (local stack; hosted latency to be measured at T32); `handoff/run.sh` passes. Fixed on the way: two primaries on a desktop step on the phone; a stale banner for a step already finished; an empty gap in the panel. Actual paths: `supabase/migrations/20261025190000_hand_off_job.sql`, `apps/api/src/{routes/jobs,repos/jobs}.ts`, `apps/desktop/src/renderer/lib/realtime.ts`, `apps/desktop/src/renderer/panel/Home.tsx`, `apps/desktop/src/main/index.ts` (notifications), `apps/mobile/src/lib/realtime.ts`, `apps/mobile/src/app/(app)/job/[id]/{index,step/[stepId]}.tsx`, `apps/mobile/e2e/handoff/`.

#### T23 Job report and share link
**Description:** `/jobs/:id/report` JSON from persisted facts; in-app report on phone and desktop; `/r/:token` read-only web page; share link create/revoke.
**Acceptance:** report separates verified / user-confirmed / needs attention / unresolved with evidence and sources; token hashed, expiring, revocable.
**Verification:** API tests (report composition, token lifecycle); Playwright smoke on `/r/:token`.
**Dependencies:** T22. **Files:** `apps/api/src/routes/report.ts`, `apps/api/src/web/report.tsx`, `apps/mobile/app/job/[id]/report.tsx`. **Size:** M

### Checkpoint 6 — end of Sat 31 Oct
- [ ] Full demo spine on real hardware twice in a row: phone → desktop → report.
- [ ] Human review: demo story and cut decisions for Phase 5–6.

---

### Phase 5 — Glasses (Sun 1 Nov)

#### T24 Glasses module: shared interface + iOS
**Description:** Expo native module with one TypeScript interface (connect, state events, capture photo) and the Swift implementation over the Wearables toolkit iOS SDK; capture screen can switch source to glasses; evidence `surface: glasses`.
**Acceptance:** on iPhone, a step's highlight and check run on a photo taken by the glasses.
**Verification:** interface unit tests with a mock module; manual on device.
**Dependencies:** T12, T15, T0.2. **Files:** `apps/mobile/modules/glasses/{src,ios}/*`, `apps/mobile/src/capture/sources.ts`. **Size:** M

#### T24b Glasses module: Android
**Description:** Kotlin implementation of the same interface over the Wearables toolkit Android SDK.
**Acceptance:** same acceptance as T24 on an Android phone, with no changes to the TypeScript side.
**Verification:** manual on device; shared interface tests pass.
**Dependencies:** T24. **Files:** `apps/mobile/modules/glasses/android/*`. **Size:** M

#### T25 Glasses audio and voice capture trigger
**Description:** Route PTT mic and TTS to the glasses (Bluetooth) on both platforms; voice command "capture" triggers a glasses photo.
**Acceptance:** one full step done hands-free through the glasses on iOS and on Android.
**Verification:** manual on both devices.
**Dependencies:** T24, T24b, T14. **Files:** `apps/mobile/src/voice/audio-route.ts`, `apps/mobile/src/voice/commands.ts`. **Size:** S

### Checkpoint 7 — end of Sun 1 Nov
- [ ] One step fully through glasses on iOS and Android; phone path unaffected when glasses are disconnected.

---

### Phase 6 — Extend and harden (Mon 2 Nov)

#### T26 Action guard (Do it for me rules)
**Description:** `core.actionGuard(action, context)` → allow / confirm / deny: allowed action types, sensitive classes (pay, send, delete, password/secret fields, system/security settings, installs), drag and system key combos need confirm, per-request action cap and rate limit.
**Acceptance:** table-driven tests for every class; model can't change mode or bypass.
**Verification:** `pnpm --filter @tandrix/core test`.
**Dependencies:** T1. (Can be done any time after Phase 1 by Track C.) **Files:** `packages/core/src/action-guard.ts`, tests. **Size:** S

#### T27 Do it for me on desktop
**Description:** Mode toggle in panel + voice ("just do it"); plain confirmation "Clicking this allows Tandrix to control your device."; macOS Accessibility permission flow; nut.js input driver; observe → act loop with announce + ~1 s cancel window; interrupt on Esc, hotkey, or real user input; persistent in-control indicator; before/after screenshot Events; mode resets per job.
**Acceptance:** completes the demo screen task by itself; sensitive action stops for confirm; moving the mouse stops it immediately; every action in the job timeline.
**Verification:** unit tests for loop + interrupt watcher with a fake driver; manual.
**Dependencies:** T26, T19. **Files:** `apps/desktop/src/main/{control-loop,input-driver,interrupts}.ts`, `apps/desktop/src/renderer/{ControlIndicator,ModeToggle}.tsx`. **Size:** M

#### T28 Record mode (time-boxed 6 h)
**Description:** Record video on phone/glasses; `/procedures/from-recording` (Files API) → draft steps with timestamps; keyframes via ffmpeg; expert review/publish screen.
**Acceptance:** 2-minute expert video → editable draft with keyframes; published procedure offered on next job for that model.
**Verification:** ai test with recorded response; manual.
**Dependencies:** T11. **Files:** `packages/ai/src/from-recording.ts`, `apps/api/src/routes/recording.ts`, `apps/mobile/app/record.tsx`. **Size:** M

#### T29 Multilingual
**Description:** Job language setting; passed to ASR and prompts; TTS voice per language.
**Acceptance:** a step run end to end in a second language.
**Verification:** manual.
**Dependencies:** T14. **Files:** `apps/mobile/src/i18n.ts`, `packages/ai/src/prompts.ts`. **Size:** S

#### T30 Hardening pass
**Description:** Error states and negative tests from User Flows §9: permissions denied, blurry photo, part not found, no signal, model timeout/malformed output, pointer target not visible, prompt injection on a label and on screen, wiring request, delete job removes evidence. Also: move procedure generation to the async pattern (job ID + Realtime progress, Architecture §5) so a dropped phone connection or a proxy timeout during a long manual can't lose the result.
**Acceptance:** each case has a test or a scripted manual check with expected behaviour; none blocks the demo path.
**Verification:** `pnpm test`; checklist in `docs/engineering/negative-tests.md` signed off.
**Dependencies:** Checkpoint 6. **Files:** tests across packages, `docs/engineering/negative-tests.md`. **Size:** M

### Checkpoint 8 — end of Mon 2 Nov
- [ ] Feature set frozen; anything unfinished cut per §Cut order.
- [ ] Negative-test checklist signed off.

---

### Phase 7 — Ship (Tue 3 – Wed 4 Nov)

#### T31 Demo reliability
**Description:** Cache manual/procedure/highlights for the demo pump; prefetch next-step highlights; demo runbook; five consecutive rehearsals on real hardware.
**Acceptance:** 5/5 clean runs within 5 minutes.
**Verification:** rehearsal log in `docs/engineering/rehearsals.md`.
**Dependencies:** Checkpoint 8. **Files:** `apps/api/src/cache.ts`, `docs/engineering/{runbook,rehearsals}.md`. **Size:** S

#### T32 Builds and README
**Description:** iOS TestFlight build, Android APK, signed and notarised macOS desktop build, deployed API; README with setup, env vars, models used, limitations.
**Acceptance:** fresh install on a second iPhone, an Android phone and a second Mac runs the demo.
**Verification:** clean-install test.
**Dependencies:** T31. **Files:** `README.md`, `apps/mobile/eas.json`, `apps/desktop/electron-builder.yml`. **Size:** M

#### T33 Demo video and submission
**Description:** Shoot from real captures; architecture diagram; project description naming each Meta model and why; submit.
**Acceptance:** submitted by 3 PM ET 4 Nov with all required fields.
**Verification:** submission confirmation saved.
**Dependencies:** T32. **Files:** `docs/submission/*`. **Size:** S

### Checkpoint 9 — Complete
- [ ] PRD release definition met (§11).
- [ ] Definition of done in Hackathon Plan §6 met.
- [ ] Submitted.

## Cut order (if behind, cut from the top)

1. Ray-Ban Display lens output, asset QR history (already out of this plan)
2. T29 Multilingual
3. Share link web page in T23 (keep in-app report)
4. T28 Record mode (pitch slide only)
5. T27 Do it for me (keep T26 guard + a pitch mention)
6. T24b Android glasses (keep iOS), then T24–T25 entirely (keep a short clip if anything works)
7. T17 Offline cache

**Never cut:** T9–T16 core phone path, T19–T20 Show me, T22 handoff, T23 report, safety gates.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Model rate limits/quota in demo | High | Check limits in T0.1; demo cache in T31; recorded responses for tests. |
| SAM or pointing accuracy below bar | High | Day-1 spikes T3/T4 with pre-chosen fallbacks. |
| Glasses toolkit access/build issues | Medium | T0.2 in prep; single day; phone path independent. |
| Expo native rebuild churn | Medium | Dev client from T7; no native changes after Checkpoint 7. |
| "Do it for me" misfires | High | Deterministic guard, announce + cancel window, interrupt on user input, sensitive-action confirm; demo only on the chosen app. |
| Contract drift across tracks | Medium | Contracts frozen at Checkpoint 1; PR-only changes. |
| Design system decision slips and blocks UI | High | Decide T0.5 by 25 Oct; T0.6–T0.7 run in parallel with T1–T6; API and AI work never waits on UI. |
| Two glasses platforms double native work | Medium | Shared TS interface first; Android after iOS works; Android is first glasses cut. |
| macOS permissions (Screen Recording, Accessibility) in demo | Medium | Grant during clean-install test in T32; runbook step. |

## Open questions

1. Which desktop software is the handoff target (controller config, VFD tool, monitoring dashboard)? Blocks T4 and T19.
2. ~~Design direction~~ Decided: Geist-style system, documented at https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp.
3. Once the system is documented, `docs/product/Design_Brief.md` is reduced to product requirements and links to the design system.
