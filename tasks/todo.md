# Tandrix — Task list

See [plan.md](plan.md) for descriptions, acceptance criteria and verification.
Tracks: **D** design, **A** mobile & glasses, **B** API & AI, **C** desktop (macOS).

## Phase 0 — Prep
- [x] T0.1 Meta API smoke script (B): all four models live; $0.004 a run; results in docs/engineering/spikes.md
- [ ] T0.2 Glasses toolkit sample running (A)
- [ ] T0.3 Demo fixtures: pump photos, manual, desktop app choice (all)
- [ ] T0.4 Monorepo skeleton + CI (B): local lint, format, typecheck, test and build pass; open until CI runs green on the first push
- [x] T0.5 Choose the design direction (D + you): Geist-style, see docs/design/decision.md
- [x] T0.6 Document the Tandrix design system (D): https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp, mirrored in docs/design/system
- [x] T0.7 `packages/ui`: tokens and core components (D + A + C): phone feature components land in their feature tasks; galleries in T7 and T18

## Phase 1 — Foundation and spikes
- [x] T1 Contracts: core entities (B)
- [x] T2 Core rules: step status + safety gates (B)
- [ ] T3 Spike: SAM highlighting (B)
- [x] T4 Spike: screen pointing (C): 20 of 20 on the pointing bench (`pointing-bench`, four synthetic app screens); see spikes.md
- [x] T5 Spike: nameplate → manual (B): decided — live search steered to direct PDFs (T10) with manual upload/pages as the fallback path; see spikes.md
- [ ] T6 Jobs API with auth, deployed (B): built and tested locally; open until deployed (needs hosted Supabase + Fly.io)
- [x] T7 Mobile shell: sign in, create/list jobs (A): passes on the iOS simulator (Maestro e2e); physical-device check by you; Android deferred
- [ ] **Checkpoint 1:** CI green, API live, spikes decided, contracts frozen, ui gallery renders

## Phase 2 — Physical core
- [x] T8 Capture photo as evidence (A): passes on the iOS simulator; camera shutter on a physical phone by you
- [x] T9 Identify asset from nameplate (B + A): live, reads makes and models from nameplates, labels and packaging (Raspberry Pi 5 box: 0.99); a physical-phone check by you
- [x] T10 Find or attach manual (B + A): upload live (22-page kit); web search steered toward direct PDF manuals and datasheets (`filetype:pdf`)
- [x] T11 Procedure from manual with citations (B + A): live, 18 steps from a 22-page manual, 15 with page citations, ~$0.12 and ~55 s
- [x] **Checkpoint 2:** nameplate → cited procedure on phone
- [x] T12 Highlight parts on the step screen (B + A): live, boards and assemblies outlined (mask, 0.98) via plain-word concepts; small connectors are beyond SAM
- [x] T13 Safety gates on steps (A): gates, starting and finishing steps pass on the iOS simulator; refusal and skipping covered by API and integration tests; physical-device check by you
- [x] T14 Voice in and out on phone (B + A): transcription and answers live; answers name the step that covers a question; speaking on a physical phone by you
- [ ] **Checkpoint 3:** three steps by voice with highlights
- [x] T15 Step check by photo (B + A): live, fail then pass with specific reasons
- [x] T16 Parts check (B + A): live, each kind of part looked for by what it looks like; generic SAM words find nothing
- [x] T17 Offline cache and upload queue (A): an offline start shows Pending and syncs on reconnect on the iOS simulator. Opening a project online keeps its manual PDF and every step's pictures on the phone; a kept manual opens in place (Quick Look) with or without a connection, checked on the simulator; offline, steps show their kept pictures (the network-cut case not run on the simulator)
- [ ] **Checkpoint 4:** full phone path

## Phase 3 — Desktop
- [x] T18 Electron shell with overlay and panel (C): verified on this Mac with one display; two displays and the built app's Screen Recording prompt are manual checks
- [x] T19 Show me: ask → pointer + voice (C + B): 20 of 20 inside the control on the pointing bench; the earlier "10 px below" was the overlay window's offset and the arrow tip, both corrected; answers in 2–6 s (reasoning minimal, narration rewritten without a second call, slow answers asked again after 7 s)
- [ ] T20 Screen step verification (C): built and verified with fixtures; live check not yet run
- [ ] **Checkpoint 5:** teach-me-this-screen works

## Phase 4a — Product surfaces
- [x] P1 Positioning and copy: phone = physical projects, Mac = software, Clicky-style
- [x] P2 Goal-first projects: steps from a goal; equipment and manual optional
- [x] P3 Mac: Show me without a job; Clicky-first panel; first-run setup
- [x] P4 Phone: intro, permissions, home ("What are you building or fixing?"); all phone flows pass
- [x] P5 Website: consumer-first rebuild, then rebuilt again in Phase 9 (W1–W3): drawn figures instead of product photos, App Router structure, Tailwind; report page /r/[token] verified
- [ ] P6 Known gaps: offline manual/reference caching, deploy readiness, Mac icons and packaging, design system additions
- [x] **Checkpoint 4a:** clear what each app does; project from a sentence; Mac teaches with no job

- [x] P7 Step visuals: each step shows the user's reference photo, the cited manual page (rendered once, zoomable) and the latest photo, on the phone and the Mac; the photo check compares against the reference. Open: crop to the cited figure; reference in the report (with T23)
- [ ] P8 Mixed demo material: more than one product (electronics build, a bike repair, a home-network install) plus synthetic app screens for Show me and the T4 spike

## Phase 4b — Real product, end to end
- [x] R1 No demo data: no fixture mode in API/config/scripts/docs (only honest noModel "unavailable" fallbacks, unreachable in prod since META_API_KEY is required). The 88 local test projects deleted with their photos (the two live Pi 5 projects kept); each e2e run now clears earlier runs' projects first (`e2e:clean`). E2E on real models: all ten flows pass
- [x] I1 Intake at project start: built. One screen takes the goal, label photo, where-it-stands photos, the manual (PDF or pages, else search), the parts photo and notes; one pass sets it up with visible stages and resumes from a stopped stage. Live run on the Pi 5: label read, manual found, 10 steps (9 cited), parts flagged, about $0.20 and 2 min. E2E flows rewritten for real models: all pass (sign-in with intake, gallery, photo, identify, manual pages, highlight, safety, voice, check, visuals, parts, handoff, offline), seeded per flow by `e2e:seed`
- [ ] L1 Point the camera: live camera on the phone; ask "what is this?" or "where does this go?" by voice or tap, and Tandrix answers and highlights on the live view (frames on demand, not streamed)
- [x] V1 Voice: natural voice (Kokoro on the API, pre-warmed cache, Premium/Enhanced device voice fallback, never robotic); mic held or tapped on phone and Mac, silence never sent; hold ⌥⌘ to talk on the Mac; presence bar at the top of the screen instead of the panel; speech timeout extended to 20s
- [ ] L2 Learn software on the Mac: conversational lessons shipped (lesson detector + Software Coach prompt, one step per turn with "say next" check-ins, Do-mode demo with narration); open: a software *project* with persisted steps, each with Show me and a screen check
- [ ] D1 Deploy: API container on Fly.io, hosted Supabase (migrations, buckets, auth), website on Vercel, EAS profiles, signed Mac build, production env checklist; deploy itself after the user's go-ahead
- [x] T27a Do it for me on the Mac: a switch in the panel and by voice ("do it for me" or direct commands like "Open Spotify"), the in-control pill with Stop, actions run one at a time through the action guard, a confirm before anything that sends, buys, deletes or types a password, any key or mouse movement takes control back; Swift native driver Cocoa runloop event pumping; single-open instant reply ("Opened Spotify.") and multi-step continuation
- [x] M1 Multi-agent architecture: live system is the sixteen `prompts.ts` skills (dead `routeAgent` registry removed 2026-10-28, prompt goldens started); expanded capabilities without false refusals ("Tandrix cannot do that"), full query/command typing in Do it for me, and automatic mode switching when asked to act
- [x] M2 System latency and execution speedup: parallel SAM 3.1 segmentation (`highlightParts`, `checkParts`), low-effort reasoning on interactive screen/desktop turns, deterministic app-plan fast path, faster action announce/settle cadence, expanded native macOS key mappings, parallel API DB/storage fetches, PDF render deduplication, and parallel mobile intake uploads
- [x] M3 Intentional visual guidance: three distinct modes — Mode A (point/identify with subtle arrow dot, no box), Mode B (region highlight around ribbons/toolbars/sections only when helpful), and Mode C (progressive step badges)
- [ ] U1 UI pass on every surface (phone, Mac panel and overlay, website): hierarchy, spacing, motion and empty, loading and error states, to the design system; published back to the design system
- [x] A1 Loophole audit: fixed voice input silently dead while working (barge-in now queues spoken follow-ups — FAQ already promised it); added branded web 404. Verified: home/new-job/report/job-detail empty + error states all have actions; Setup/access notices link to Settings; no TODO/stale-promise copy in apps
- [x] W1 Wake word "Tandrix" / "Wake up Tandrix": on-device recognition (Mac and phone) via `parseWakePhrase` and desktop wake engine, handles trailing commands and punctuation seamlessly
- [ ] **Checkpoint 6b:** a new project from intake to report on real models, on the simulator and the Mac, against the deployed stack

## Phase 4 — Continuity
- [x] T21 Desktop pairing by QR (C): the Mac's live code approved on the simulator signs the panel in; pair-mac e2e passes; scanning with a physical iPhone is a manual check
- [x] T22 Handoff between devices (A + C): phone → Mac and Mac → phone live on the simulator and this Mac; 5/5 handoffs under 0.6 s locally; handoff e2e passes; hosted latency at T32
- [x] T23 Job report and share link (B): API + /r/[token] reader + mobile owner UI (report screen, create/revoke) + 10-link cap; API tests pass; on-device E2E pending (H15)
- [ ] **Checkpoint 6:** full spine twice; human review

## Phase 5 — Glasses (last, after everything else)
- [ ] T24 Glasses module: shared interface + iOS (A)
- [ ] T24b Glasses module: Android (A)
- [ ] T25 Glasses audio + voice capture trigger, both platforms (A)
- [ ] **Checkpoint 7:** one step fully through glasses on iOS and Android

## Phase 6 — Extend and harden
- [x] T26 Action guard for Do it for me (C; can start after Phase 1)
- [x] T27 Do it for me on desktop (C)
- [ ] T28 Record mode, 6 h time-box (B + A)
- [ ] T29 Multilingual (A)
- [x] T30 Hardening pass + negative tests (all): `docs/engineering/negative-tests.md` checklist written; genuine gap found and closed (DELETE /jobs/:id removes evidence objects + cascading rows, manual bytes kept as shared); async procedure stays H10; manual-device rows stay H15
- [ ] **Checkpoint 8:** feature freeze, negatives signed off

## Phase 7 — Ship
- [ ] T31 Demo reliability + 5 rehearsals (all)
- [ ] T32 Builds and README (all)
- [ ] T33 Demo video and release package (all)
- [ ] **Checkpoint 9:** release ready

## Phase 8 — Audit remediation & consumer relaunch (2026-10-28)
- [x] H1 Deploy build fix (Dockerfile ai COPY) + env docs (TANDRIX_ENV, spend, web/renderer URLs; dead ASR var removed)
- [x] H2 API abuse hardening (per-user model limits, XFF client key, transcribe body limit, share cap, mime/pointer/claim fixes + tests)
- [x] H3 Owner report UI on mobile (closes T23's loop; E2E pending H15)
- [x] H4 Latency (indexes migration, latest-checks RPC, record_check step return, parallel reads, per-step confirmations, async spend, render pool, mobile timeout)
- [x] H5 Marketing consumer rebuild (/technical, credits, metadata, nav menu, licensed photos, lazy three.js, a11y); clips pending H8
- [x] H6 Agent-skills cleanup (dead registry + ScreenReply removed; prompt goldens; shared-rules fix)
- [x] H7 Desktop gallery.html build entry
- [x] H8 Demo clips from owner → wired into slot + credits: 4 clips cycle as the fullscreen hero reel with chapter progress; all 5 credited on /credits
- [ ] H9 Integration suites on local stack (blocked: Docker in sandbox)
- [ ] H10 Async procedure pipeline (spec + build)
- [ ] H11 Deploy pipeline (Fly + Supabase + Vercel + EAS + signed Mac + Sentry; needs accounts)
- [x] H12 control_mode mirror endpoint + event emission: PATCH /jobs/:id/control-mode records the mode + control_mode_changed event; desktop mirrors on every switch (fire-and-forget)
- [x] H13 expert_recording reservation doc (`docs/engineering/expert-recording.md`); producer stays T28
- [ ] H14 Shared rate-limit store (needs Redis decision)
- [ ] H15 Device QA (physical-phone E2E, real-device web, Lighthouse, OG unfurls)
- [x] H16 Fly VM sizing (`docs/engineering/fly-sizing.md`): bump to shared-cpu-2x/1GB for release; split TTS only if measured p95 synth > ~2s; no page-count cap needed
- [x] H17 Guard sensitive-detection beyond English keywords: DE/FR/ES/IT/PT equivalents on all six categories with Unicode-aware word boundaries + substring tests

## Phase 9 — Assistant, agents and polish (2026-10-29 → 30)
- [x] C1 Do it for me engine: fresh model turns carrying a text memory plus one chained turn (chains grew from 8 to 14 s a turn), check before done, circling and no-progress detectors that nudge then ask, corrections mid-task, up to 200 turns, the pointer shown doing each action, scrolls as phased trackpad gestures (live: 600 px asked, 600 px moved)
- [x] C2 Talking like a person: offers to do a task and acts on a natural yes, varied acknowledgements and a light joke on big asks, pre-voiced lines; only screen jobs queue, everything else starts at once (`core.whileBusy`)
- [x] C3 Background agents: a task board, up to three at once beside the screen task; web search; typed Mac tools (calendar, reminders, notes, mail drafts, files) as fixed AppleScripts with arguments as data; Tandrix's own hidden browser driven by the computer-use runner (live: price and stock found on a real site in 24 s). Open: first run of the Mac tools in the real apps (my sandbox blocks Apple Events; macOS asks once per app)
- [x] C4 Mac Settings as its own page: grouped cards of rows, a sliding transition, and a real modal for the Do it for me confirmation (it had rendered at the foot of the page)
- [x] V2 Wake word answers on a short pause and accepts common mishearings; optional on-device voiceprint ("Only answer my voice"): three setup phrases, cut by the recogniser's word timings, compared by a scaled distance that cancels the microphone (live: the user's phrases 0.59–0.87, other voices 0.82–1.39, cutoff 0.9). Physical check by you with your own voice
- [x] M4 Phone: the home menu removed (the bottom bar covers it), Sign in a Mac as a compact sheet, the "Tandrix is ready" badge removed
- [x] W1 Website figures: isometric drawings in code (the pointing machine, the desk through a day, the kit assembling on scroll, the asks), objects drawn on the page itself, following the site's theme
- [x] W2 Website structure and styling: App Router layout (routes only in app/, sections, layout, ui, widgets, figures, content), Tailwind CSS v4 on the design-system tokens, no CSS modules left; checked against before/after screenshots of every section and page
- [x] W3 Website details: the Tandrix pointer as the cursor; the presence pill above every section on scroll
- [x] D2 Documentation pass: a root README, the docs index, the PRD and user flows rewritten for the product as it is, Architecture, Local development, the execution plan and the design brief brought up to date
- [x] C5 Multi-app tasks in one pass: plan first, NOTE what's read, one app at a time, forms in one turn, predictable clicks chained; fresh turns only; the runner notes an app's details itself when the model leaves without (`/screen/do/notes`); progress spoken only when new; "go to / grab / get" requests act. Synthetic WhatsApp → Calendar with the real model: 31 turns / 232 s → 9–11 turns / 37–40 s, three of three runs exact
- [x] U2 Phone redesign in the website's direction: sky header on Home, big-number tiles, white trays of rows, borderless cards; a compact frosted-glass tab pill floating over the tab screens (fades between them); light grey Back pills with dark text in place of the system back. All ten e2e flows pass on the iOS simulator
- [x] P9 Phone tabs share one held project list: switching tabs no longer refetches every project; Realtime (or this phone's own writes) marks what changed, and only those projects are fetched again
- [ ] **Checkpoint 9:** the Mac tools and voiceprint checked by you on this Mac; phone redesign reviewed; deploy go-ahead
