# Tandrix — Hackathon Plan

**Event:** Meta Global AI Developer Hackathon
**Build window:** Mon 26 Oct – Wed 4 Nov 2026
**Submission deadline:** 4 Nov 2026, 9:00 PM ET (aim to submit by 3:00 PM ET)
Re-check the official rules and submission requirements: https://dev.meta.ai/events/global-hackathon

## 1. Strategy

- **The phone path is the product; desktop proves the physical-to-digital handoff; glasses are the wow factor.** Build in that order.
- Each day ends with something that runs on real hardware.
- Test risky things on day 1 so we change plan early, not on day 8.
- Cut features in the order in §5. Never cut honesty (sources, statuses, safety gates).

## 2. Before the build (24–25 Oct)

- [ ] Meta Model API key working: one call each to `muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`. Note rate limits.
- [ ] Wearables Developer Center access; glasses paired with the Meta AI app; toolkit sample app runs on the phone.
- [ ] Demo pump on hand. Photograph: nameplate, every part laid out, each assembly stage, from 2–3 angles. Get the manual PDF.
- [ ] Decide the **desktop software** for the handoff (pump controller config tool, VFD software, monitoring dashboard, or the vendor's web configurator).
- [ ] Hosted Supabase project for production (local stack already runs), Fly.io/Railway account, Apple developer account (for device builds), Expo account.
- [x] `git init`, monorepo skeleton, local dev stack (`pnpm setup:local`, see Local_Dev.md).

## 3. Day by day

| Day | Date | Focus | Exit check |
|---|---|---|---|
| 1 | Mon 26 Oct | **Spikes + foundation.** (a) SAM on pump photos, (b) Spark screen pointing on the chosen desktop app, (c) nameplate → manual search. Monorepo, contracts, API skeleton, Supabase schema, auth. | Accuracy notes for all three spikes written in `docs/engineering/spikes.md`; go/no-go on fallbacks. API deployed with `/health`. |
| 2 | Tue 27 Oct | **Identify + procedure.** Nameplate pipeline, manual fetch/upload, procedure generation with citations and parts list. Mobile app shell with capture. | Phone photo of the nameplate → procedure with cited steps appears on the phone. |
| 3 | Wed 28 Oct | **Guided step loop.** Highlight parts (SAM + Spark pick), step card, safety gates, voice in (ASR proxy) and voice out (TTS). | Three real steps guided by voice with highlighted parts. |
| 4 | Thu 29 Oct | **Checks + parts check.** Step check by photo with reference image, statuses; parts check with found/missing; offline cache. | Missing O-ring flagged; a wrong step returns "needs attention". |
| 5 | Fri 30 Oct | **Desktop.** Electron overlay + panel, hold-to-talk, screenshot, pointer rendering, multi-display mapping, TTS. | "Teach me this screen" works in the demo app, pointer on target ≥ 9/10. |
| 6 | Sat 31 Oct | **Handoff + report.** Realtime job sync, Continue on desktop, desktop pairing QR, job report, share link page. | Full spine: phone steps → desktop step → report, twice in a row. |
| 7 | Sun 1 Nov | **Glasses.** Expo native module for the Wearables toolkit, glasses camera into capture pipeline, Bluetooth audio for voice. | One guided step done entirely through the glasses. |
| 8 | Mon 2 Nov | **Record mode (time-boxed to 6 h)** + multilingual. Then hardening: error states, permissions, retries, prompt-injection and wiring-request tests. | Draft procedure from a 2-minute expert video, or record mode cut. |
| 9 | Tue 3 Nov | **Demo.** Rehearse 5 times, fix blockers only. Shoot demo video from real captures. README, architecture diagram, setup instructions, build links (TestFlight / APK, desktop build). | Five clean rehearsals; video cut. |
| 10 | Wed 4 Nov | **Freeze and submit.** Feature freeze at noon ET. Clean install test, final video, submission form. | Submitted with buffer before 9 PM ET. |

If there's more than one builder: one person takes mobile + glasses, the other takes API/AI pipelines + desktop. Days 5 and 7 can then run in parallel with days 3–4.

## 4. Day-1 spikes (pass/fail)

| Spike | Pass | If it fails |
|---|---|---|
| SAM on pump parts (10 photos) | Correct part highlighted in ≥ 8/10 with a noun phrase, or after Spark picks among boxes | Use point prompts from Spark's guessed location; or box-only highlights; or numbered callouts on the reference image. |
| Screen pointing (20 targets, demo app) | ≥ 18/20 within the target control | Accessibility-API lookup by name (macOS AX); else SAM snapping on screenshot. |
| Nameplate → manual | Correct model + correct manual for the demo pump | Manual upload is the demo path; search shown as "try it" only. |
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
| Rate limits or quota during demo | Medium / High | Cache manual and procedure for the demo pump; prefetch highlights; check limits on day 0. |
| Glasses SDK access or build issues | Medium / Medium | Prep on 24–25 Oct; day 7 is the only glasses day; phone path is complete without it. |
| Expo native build time | Medium / Medium | Use a dev client from day 2; avoid rebuilding native code after day 7. |
| Pointer accuracy | Medium / High | Day-1 spike and fallback. |
| Scope creep from "AI engineer for everything" | High / High | Demo is one pump job; other equipment is the pitch, not the build. |
| Hardware or photos not ready | Low / High | Prep checklist, spare photos in `fixtures/demo-pump`. |

## 8. Submission checklist

- [ ] Demo video (3–5 min) from real app captures; any concept art labelled.
- [ ] Project description: problem, solution, Meta models used and why (Spark, SAM 3.1, Voice Transcribe, Wearables toolkit).
- [ ] Repo with README and architecture diagram.
- [ ] Build links: iOS TestFlight / Android APK, desktop build.
- [ ] Known limitations stated plainly.
- [ ] Rules re-read; all required fields complete.
