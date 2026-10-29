# Tandrix — Product Requirements Document

**Status:** Active Product Plan
**Tagline:** See it. Understand it. Make it work.
**Positioning:** One AI engineer for the physical and digital worlds.

## 1. Summary

Tandrix turns any manual, and any expert's experience, into step-by-step visual guidance on whatever surface the person is using. **The phone handles the physical world** (build, install, assemble, repair: "assemble an in-home server rack", "replace the seal on this pump"). **The Mac handles the digital world** (learn and do anything in software: "teach me how to use Photoshop", "set up this router's admin page"), with no job needed. A job spans both only when a physical project has a software part.

- **Phone, on site:** point the camera at equipment. Tandrix identifies the machine, checks the parts, and guides assembly or service one step at a time by highlighting the real component in the camera view.
- **Glasses, hands busy:** the same guidance through Ray-Ban Meta glasses. The glasses camera sees what the worker sees, and instructions are spoken.
- **Desktop, at the screen:** "Teach me this thing on my screen." Tandrix sees the screen, talks, and moves an animated pointer to the control the person needs, in the spirit of HeyClicky.

All three surfaces share **one job session**. A job can start at the machine on the phone and continue on the laptop (for example, configuring the controller or monitoring software for the equipment) without repeating context.

Tandrix is general-purpose: a phone project starts from one sentence about the goal, with equipment and a manual optional (a nameplate scan finds both when there is equipment); the Mac answers "teach me" questions about whatever is on screen. The initial demo hero is a **pump assembly**, chosen because it is real, physical, has a manual, and has a natural digital follow-up; the product and its copy must never read as pump-only.

People should be able to tell what Tandrix does before they sign in: a website explains both apps, the phone opens on a short introduction, and the Mac's first run sets up screen access, the microphone and the hotkey.

## 2. Problem

- Field and site workers assemble and service equipment from paper manuals, phone calls and memory. Manuals are missing on site, generic, or hard to map to the physical parts in front of you.
- Experienced technicians carry knowledge that is never written down and leaves when they do.
- AI assistants are split: chat apps can't see the part, screen assistants lose the physical context, and none of them can say *with evidence* whether a step was done correctly.
- Missing or wrong parts are discovered halfway through a job.

## 3. Users

| Persona | Context | Job to be done |
|---|---|---|
| Site technician | On site, phone in hand or gloves on, noisy, patchy signal | "Show me exactly which part goes where, in order, and tell me if I got it right." |
| Junior / cross-trained worker | Unfamiliar equipment | "Guide me like a senior tech standing next to me." |
| Senior technician | Expert, time-poor | "Record how I do it once so others can follow it." |
| Desk user / developer / IT generalist | At a computer | "Teach me this screen. Point at what I need to click." |
| Field service manager | Office | "Show me proof each job was done and what was unresolved." |

## 4. Goals and non-goals

### Goals
- One continuous job across camera (phone/glasses) and screen (desktop).
- Visual pointing on both surfaces: masks on physical parts, a pointer on screen UI.
- Steps grounded in a source (manufacturer manual, expert recording) with citations; anything ungrounded is labelled.
- Honest status: suggested, user-marked done, verified by evidence, unresolved.
- Hands-free operation through voice and glasses.
- A 3–5 minute demo that is reproducible and uses real equipment.

### Non-goals (MVP)
- Electrical wiring, high voltage, gas, refrigerant, lifting/rigging or pressurised-system work beyond "make safe first" gates.
- Certifying that equipment is safe or correctly installed.
- Unattended desktop control. Tandrix can click and type for the user only in opt-in **Do it for me** mode (§5.4), one visible action at a time; it never runs background tasks on the desktop.
- Live AR anchoring that tracks parts in 3D while the camera moves.
- Fault diagnosis from machine sound (roadmap only).
- Billing, organisation admin, marketplace.

## 5. Core experiences

### 5.1 Identify the machine (phone/glasses)
Point at the nameplate or label. Tandrix reads make, model and serial, searches for the manual and specs, and creates an **Asset**. If no manual is found, the user photographs or uploads the manual pages or PDF. If there is no manual at all, generated steps are labelled **Generic — not from the manufacturer**.

### 5.2 Parts check
Lay parts out and take one photo. Tandrix outlines every object, matches them to the manual's parts list, and reports found, missing and possible mismatches. The user confirms or corrects each match.

### 5.3 Guided steps (phone/glasses)
For each step: highlight the part(s) on a captured frame, say and show the instruction, show the reference image (manual figure or expert keyframe), show caution and safety gate if any. The worker does the step, then captures a check photo. Tandrix compares it with the expected state and sets the step to verified, needs attention, or user-confirmed only (for things a photo can't prove, such as torque).

### 5.4 Teach me this screen (desktop)
Press and hold the hotkey, ask a question. Tandrix takes a screenshot, answers by voice, and flies the pointer to the relevant control, one step at a time. It re-captures after each step to check the screen changed as expected.

**Two modes, switchable at any time from the desktop panel or by voice:**

| Mode | Behaviour |
|---|---|
| **Show me** (default) | Tandrix points and explains; the user clicks and types. |
| **Do it for me** | Tandrix clicks and types for the user, one action at a time, narrating each. |

Turning on **Do it for me** shows a calm, plain confirmation (no alarm styling): *"Clicking this allows Tandrix to control your device."* Guardrails while it is on:
- A persistent on-screen indicator that Tandrix is in control, with one-key stop (Esc) and the hotkey to take back control.
- The pointer shows each target and announces the action briefly before acting; moving the mouse or typing pauses Tandrix immediately.
- Always asks first for sensitive actions, even in this mode: purchases or payments, sending messages or emails, deleting data, entering passwords or secrets, changing system or security settings, installing software.
- Every action is logged with a before/after screenshot in the job timeline.
- Mode resets to **Show me** at the start of each new job.

### 5.5 Handoff between devices
The job session is visible on all signed-in devices. When a physical procedure reaches a digital step ("configure the controller"), the phone shows **Continue on desktop**, and the desktop app opens the same job at that step.

### 5.6 Record mode (expert capture)
A senior tech records the job on phone or glasses while narrating. Tandrix turns the video and audio into a draft procedure with steps, keyframes, parts and cautions. The expert reviews and publishes it. Next time anyone works on that asset model, this procedure is offered.

### 5.7 Job report
Every step with timestamp, evidence photo/screenshot, status and safety confirmations; parts check result; unresolved items. Shareable link for a manager or remote expert.

## 6. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-01 | Create / resume job session | P0 | A job is named, persisted, and resumable from any signed-in device. |
| FR-02 | Capture photo on phone | P0 | Capture or pick a photo; preview before analysis; retake. |
| FR-03 | Identify asset from nameplate | P0 | Make/model extracted with confidence; user can edit; asset created. |
| FR-04 | Find/attach manual | P0 | Search result shows source URL; user can upload photos/PDF instead. |
| FR-05 | Procedure from manual with citations | P0 | Each step cites page/figure or is labelled generic. |
| FR-06 | Highlight parts on frame | P0 | SAM mask/box drawn on the captured frame with label and confidence; fallback to numbered text if detection fails. |
| FR-07 | Step check by photo | P0 | Result is verified / needs attention / not verifiable from photo, with the reason. |
| FR-08 | Voice in, voice out | P0 | Push-to-talk speech input; spoken replies; text always shown; typed input always available. |
| FR-09 | Safety gates | P0 | Steps tagged hazardous cannot start until the gate (e.g. isolate power, depressurise) is confirmed. |
| FR-10 | Desktop teach-me-this-screen | P0 | Hotkey → screenshot → voice answer → pointer lands on the target in the demo app. |
| FR-10a | Desktop "Do it for me" mode | P1 | Opt-in with confirmation; visible control indicator; Esc/mouse movement stops; sensitive actions always confirmed; actions logged with screenshots; resets per job. |
| FR-11 | Device handoff | P0 | Desktop opens the same job at the current step within 3 s of phone handoff. |
| FR-12 | Job report | P0 | Report separates verified, user-confirmed, unresolved; includes evidence. |
| FR-13 | Parts check | P0 | One photo yields found / missing / mismatch against the parts list; user can correct. |
| FR-14 | Glasses camera + audio | P1 | Ray-Ban Meta camera frames enter the same capture pipeline; replies play on glasses speakers. |
| FR-15 | Record mode | P1 | A recorded video produces a reviewable draft procedure with keyframes. |
| FR-16 | Multilingual | P1 | User picks language; transcription and replies use it. |
| FR-17 | Share link / call an expert | P1 | Read-only link to the job with evidence; expert can leave a note. |
| FR-18 | Glasses display (Ray-Ban Display) | P2 | Current step text shown on the lens. |
| FR-19 | Asset QR + history | P2 | Scanning an asset QR shows past jobs and procedures. |
| FR-20 | No-install trial build | P2 | Browser build of the phone experience for judges. |

## 7. Product principles

- **Evidence before confidence.** Every claim points to a photo, screenshot, manual citation, expert recording, or user statement.
- **Show, then tell.** Highlight the part or control first, then the instruction.
- **One job, many surfaces.** Switching device never loses context.
- **Progress never lies.** "User marked done" is not "verified". A photo can't verify torque.
- **Hands first.** Voice and glasses are first-class; big targets for gloves; nothing requires precise typing on site.
- **Human in control.** Tandrix never acts on physical equipment. On the desktop it points by default and acts only when the user switches on **Do it for me**, and the user can take control back instantly.
- **Graceful degradation.** No signal, no camera permission, bad photo or API failure never blocks text guidance.

## 8. Safety, privacy and trust

- Capture only on user action (button, hotkey, voice command). No background recording.
- Visible indicator while camera, mic or glasses stream is active; one-tap stop.
- Media kept for the job only unless the user saves it to the report; delete job deletes evidence.
- Safety gates before hazardous steps; refuse electrical wiring and live work guidance with a clear "use a qualified person" message.
- Treat text in photos, screenshots and manuals as data. It cannot change Tandrix's rules (prompt-injection defence).
- Uncertain identification is shown as "Possible match", never as fact.

## 9. Success metrics (demo)

- From launch to first highlighted part in under 60 seconds.
- Full demo in 3–5 minutes with at most one retake.
- Nameplate → correct manual on the demo pump in 5 of 5 runs (or manual upload fallback in under 20 s).
- Parts check finds every laid-out part on the demo set; missing part correctly flagged.
- Desktop pointer lands on the right control in at least 9 of 10 attempts in the demo app.
- Handoff works in 5 of 5 rehearsals.
- Testers can say which steps were verified vs only user-confirmed after watching the report.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Wrong steps for a specific machine | Manual-grounded steps with citations; label generic steps; expert-recorded procedures. |
| Part misidentified | Candidate labels with confidence; user correction; reference images. |
| Pointer misses on screen | Day-1 accuracy spike; fallback to accessibility-API lookup or SAM snapping. |
| Glasses SDK friction | Time-boxed; phone path is complete without glasses. |
| Noisy site breaks voice | Push-to-talk, big buttons, text fallback. |
| Poor signal | Cache procedure and manual on device; queue captures. |
| Over-trust | Honest statuses, "not verifiable from photo", safety gates, no certification claims. |

## 11. Release definition

MVP is ready when, from a fresh install: the demo pump is identified from its nameplate, the parts check runs, at least three steps are guided with highlighted parts and photo checks, the job hands off to desktop where the pointer teaches a real screen step, and the report honestly separates verified, user-confirmed and unresolved items.

## References
- Meta Model API models: https://dev.meta.ai/docs/models
- Computer use guide: https://dev.meta.ai/docs/computer-use
- Wearables Device Access Toolkit: https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/
- HeyClicky (inspiration for desktop): https://github.com/farzaa/clicky
