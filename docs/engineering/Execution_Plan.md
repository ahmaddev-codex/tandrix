# Tandrix — Execution Plan

**Status:** stages 1–6 are built and verified locally; deploy, glasses and release remain. The task-level list is [tasks/todo.md](../../tasks/todo.md).

## 1. Strategy

- **The phone path is the physical product; desktop handles the digital world and physical-to-digital handoff; glasses are the hands-free companion.** Build in that order.
- Each milestone ends with something that runs on real hardware.
- Test risky assumptions early with focused spikes.
- Cut features in the order in §5. Never cut honesty (sources, statuses, safety gates).

## 2. Pre-build checklist

- [x] Meta Model API key working: one call each to `muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`. Note rate limits.
- [ ] Wearables Developer Center access; glasses paired with the Meta AI app; toolkit sample app runs on the phone.
- [x] A real demo kit on hand: a Raspberry Pi 5 case kit (`fixtures/demo-pi5`), with its label, parts, kit sheet and assembly stages photographed.
- [x] Desktop software for the handoff: writing the OS image (a synthetic OS Writer screen in `fixtures/demo-pi5/screens`).
- [ ] Hosted Supabase project for production (local stack already runs), Fly.io/Railway account, Apple developer account (for device builds), Expo account.
- [x] `git init`, monorepo skeleton, local dev stack (`pnpm setup:local`, see Local_Dev.md).

## 3. Milestones

| Stage | Focus | Exit check | Status |
|---|---|---|---|
| 1 | **Spikes + foundation.** SAM on real parts, screen pointing, label → manual search. Monorepo, contracts, API, Supabase schema, auth. | Spike notes in `spikes.md`; API with `/health`. | Done; deploy open (D1) |
| 2 | **Identify + procedure.** Label pipeline, manual fetch and upload, steps with citations and a parts list. Phone shell with capture. | A label photo becomes cited steps on the phone. | Done |
| 3 | **Guided step loop.** Part highlights, step card, safety gates, voice in and out. | Three real steps guided by voice with highlighted parts. | Done |
| 4 | **Checks + parts check.** Photo checks with reference images; parts check; offline queue. | A missing part flagged; a wrong step returns needs attention. | Done; offline manual caching open |
| 5 | **Desktop.** Panel, overlay, hold to talk, pointer, Show me, Do it for me, background agents. | Show me and Do it for me work on macOS; pointer on target ≥ 9/10. | Done |
| 6 | **Handoff + report.** Realtime sync, Continue on Mac, pairing by QR, report, share link. | Phone steps → Mac step → report, twice in a row. | Done locally |
| 7 | **Glasses.** Native module for the Wearables toolkit; glasses camera and audio. | One step done entirely through the glasses. | Open (last) |
| 8 | **Record mode + multilingual**, then hardening. | A draft procedure from a two-minute expert video, or record mode cut. | Hardening done; record mode and multilingual open |
| 9 | **Rehearsals & builds.** Five rehearsals; demo video from real captures; builds. | Five clean rehearsals; builds verified. | Open |
| 10 | **Release.** Feature freeze, clean install test, release package. | All release criteria met. | Open |

## 4. Spikes (pass/fail)

| Spike | Pass | If it fails |
|---|---|---|
| SAM on real parts (10 photos) | Correct part highlighted in ≥ 8/10 with a noun phrase, or after Spark picks among boxes | Use point prompts from Spark's guessed location; or box-only highlights; or numbered callouts on the reference image. |
| Screen pointing (20 targets, demo app) | ≥ 18/20 within the target control | Accessibility-API lookup by name (macOS AX); else SAM snapping on screenshot. |
| Label → manual | Correct model and manual for the demo kit | Manual upload is the demo path; search shown as "try it" only. |
| Glasses sample (from prep) | Frames received in our app | Glasses become a recorded clip in the video only, or cut. |

## 5. Cut order (cut from the top)

1. Ray-Ban Display lens output (P2)
2. Asset QR + history (P2)
3. Multilingual (P1)
4. Share link page (show the report in-app instead)
5. Record mode (P1) — keep as a pitch slide
6. Glasses (P1) — keep a short clip if anything works
7. Offline cache — demo on good network

**Never cut:** nameplate/manual grounding (with upload fallback), highlighted step loop, photo checks with honest statuses, safety gates, desktop pointer, handoff, report.

## 6. Definition of done

- Fresh install on phone and laptop runs the full demo without hidden setup.
- Every model output used in UI passes a Zod schema.
- Every step shows its source; every status is backed by evidence or labelled user-confirmed.
- Desktop clicks or types only in opt-in **Do it for me** mode, through the action guard, with stop always available.
- No API keys in client builds or the repo.
- README covers setup, environment variables, models used, limitations and known gaps.

## 7. Risks

| Risk | Likelihood / impact | Plan |
|---|---|---|
| Rate limits or quota during demo | Medium / High | Cache the manual and procedure for the demo kit; prefetch highlights; spend cap on. |
| Glasses SDK access or build issues | Medium / Medium | Phone path is complete without it. |
| Expo native build time | Medium / Medium | Use a dev client; avoid rebuilding native code late. |
| Pointer accuracy | Medium / High | Spike and fallback. |
| Scope creep | High / High | Keep core surfaces sharp and verified end to end. |
| Hardware or photos not ready | Low / High | Real photos of the demo kit in `fixtures/demo-pi5`. |

## 8. Release checklist

- [ ] Demo video (3–5 min) from real app captures; any concept art labelled.
- [ ] Project description: problem, solution, Meta models used and why (Spark, SAM 3.1, Voice Transcribe, Wearables toolkit).
- [ ] Repo with README and architecture diagram.
- [ ] Build links: iOS TestFlight / Android APK, desktop build.
- [ ] Known limitations stated plainly.
