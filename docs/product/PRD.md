# Tandrix — Product Requirements

**Status:** current as of 30 October 2026.
**In one line:** an assistant that sees your screen and what's in front of your camera, points at the answer, and checks every step with you.

## 1. Summary

People get stuck in two places: inside software (a new app, a setting they can't find, a task across several apps) and in front of physical things (a kit to assemble, a device to set up, something to fix). Tandrix helps in both, on the device that fits:

- **Mac.** Ask about anything on screen and Tandrix rings the exact control and says the next step (**Show me**). Ask it to do the task and it does the steps itself, visibly, asking before anything that sends, pays or deletes (**Do it for me**). Work that needs no screen (look-ups, drafts, calendar entries, reminders, a website task) runs in the background, several at once, without touching the mouse or keyboard.
- **iPhone.** Start a project from one sentence. Tandrix reads the label, finds the manual, writes steps that cite its pages, outlines the parts in a photo, and checks each step from a photo before moving on.
- **Report.** A finished project becomes a shareable record of what was done and how each step was checked.

One account spans both. A project can hand a step from the phone to the Mac (and back) without repeating anything.

## 2. Problem

- Help is split by medium. Chat assistants can't see the control or the part; screen tools lose the physical context; none of them say, with evidence, whether a step was done right.
- Instructions don't map to what's in front of you. Manuals are missing, generic, or hard to match to the actual parts; software help describes menus you can't find.
- People want the task done, not explained, but they won't hand control to something that might send, pay or delete without asking.

## 3. Who it's for

| Person | Situation | What they want |
|---|---|---|
| Someone learning an app | New spreadsheet, editor or setting at work or home | "Show me where it is, one step at a time." |
| Someone with a task to finish | A booking, an email, a setup across apps | "Just do it, and ask me before anything that matters." |
| Someone building or fixing | A kit, a device, furniture, a repair | "Tell me which part goes where, and whether I got it right." |
| Someone sharing the result | Handing off to a manager, a client, a friend | "Show what was done and how it was checked." |

## 4. Goals and non-goals

**Goals**
- Point at the exact control or part before explaining it.
- Do tasks on the Mac when asked, visibly and stoppably, with guarded actions.
- Run independent work in parallel; only work that needs the screen waits its turn.
- Ground physical steps in a source (the manual, cited by page) and label anything generic.
- Report status honestly: verified by evidence, confirmed by the user, or unresolved.
- Work by voice and hands-free where possible.

**Non-goals**
- Electrical wiring, live electrical work, gas, refrigerant, lifting or pressurised systems beyond "make it safe first" gates.
- Certifying that anything is safe or correctly installed.
- Acting on physical equipment.
- Sending, paying or deleting without the user's explicit confirmation.
- Billing, team administration or a marketplace.

## 5. Core experiences

### 5.1 Show me (Mac)
Hold ⌥⌘ in any app, ask, let go (or say "Hey Tandrix"). Tandrix looks at the screen, rings the control and says the next step. "Teach me" turns it into a lesson, one step per turn with "say next" check-ins.

### 5.2 Do it for me (Mac)
Asked to do something, Tandrix offers ("Want me to do it?") and acts on a spoken or clicked yes; "do it for me" acts straight away; a setting makes it always act without asking first. While it works:
- A presence pill shows Tandrix is in control; its pointer moves to each target and says what it's doing.
- Pressing Esc or the Tandrix hotkey stops it at once. Moving the mouse or typing doesn't, so a brushed trackpad can't throw the work away.
- Paying, sending, deleting, typing a password or changing security settings always stops for a confirm.
- It finishes the whole task unless stopped, checks the result before saying it's done, and asks for help rather than repeating itself.
- Said while it works: "stop" stops it, a correction steers it, a new screen task queues next.

### 5.3 Background agents (Mac)
Tasks that need no screen run in parallel, up to three at once: look-ups and comparisons with web search, drafts, and actions through fixed Mac tools (calendar events, reminders, notes, email drafts, file lists). Website tasks run in Tandrix's own hidden browser, signed in where the user has signed in. Nothing touches the user's mouse, keyboard or screen; nothing sends, pays or deletes.

### 5.4 Projects (iPhone)
One screen takes the goal and, optionally, a label photo, photos of where things stand, the manual (PDF, page photos, or found by search) and a photo of the parts. Tandrix identifies the item, finds the manual, writes steps citing its pages, and checks the parts against the list. Without a manual, steps are labelled Generic.

### 5.5 Guided steps (iPhone)
Each step shows its instruction, the cited manual page and the reference image, with parts outlined on a photo on request. Hazardous steps wait behind a safety gate. A photo of the finished step is checked against what it should look like: verified, needs attention (with what to fix), or not provable by photo (the user confirms). Questions about the step are answered by voice.

### 5.6 Handoff
A step done on a computer offers **Continue on Mac**; the Mac shows the step at once and checks it from a screenshot. Either device can take it back.

### 5.7 Report and sharing
Every step with its status, evidence and time, safety confirmations and the parts check. A private link (expires in a week, revocable) shows it read-only on the web.

### 5.8 Listening
Hold to talk on both devices. On the Mac, an optional wake word ("Hey Tandrix") is heard on the Mac only, with an optional on-device voiceprint so it answers only the user's voice. Replies are spoken in Tandrix's own voice and shown as text.

## 6. Requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | Create and resume a project from any signed-in device | P0 | Done |
| FR-02 | Capture or pick photos as evidence | P0 | Done |
| FR-03 | Identify the item from a label | P0 | Done |
| FR-04 | Find or attach the manual | P0 | Done |
| FR-05 | Steps from the manual, each citing its page or labelled Generic | P0 | Done |
| FR-06 | Outline parts on a photo, with a numbered text fallback | P0 | Done |
| FR-07 | Check a step from a photo: verified, needs attention, or not verifiable | P0 | Done |
| FR-08 | Voice in and out; text always shown; typing always possible | P0 | Done |
| FR-09 | Safety gates before hazardous steps | P0 | Done |
| FR-10 | Show me on the Mac: ask, ring the control, say the step | P0 | Done |
| FR-11 | Do it for me: guarded, visible, stoppable, finishes the task | P0 | Done |
| FR-12 | Background agents in parallel, with Mac tools and a hidden browser | P1 | Done; Mac tools await a first run in the real apps |
| FR-13 | Handoff between phone and Mac within 3 s | P0 | Done locally; hosted latency at deploy |
| FR-14 | Report and private share link | P0 | Done |
| FR-15 | Parts check with corrections, blocking steps that need a missing part | P0 | Done |
| FR-16 | Wake word and on-device voiceprint (Mac) | P1 | Done |
| FR-17 | Point the camera live and ask "what is this?" | P1 | Open (L1) |
| FR-18 | Offline: steps readable, actions and photos queued | P1 | Done; manual pages and reference images not yet cached |
| FR-19 | Glasses as camera, microphone and speaker | P2 | Open (after everything else) |
| FR-20 | Record mode: an expert's recording becomes a draft procedure | P2 | Open |
| FR-21 | Multilingual | P2 | Open |

## 7. Principles

- **Show, then tell.** Point at the control or part first, then say the step.
- **Evidence before confidence.** Every claim traces to a photo, screenshot, cited page or the user's word. "Marked done" is never "verified".
- **The user stays in control.** Tandrix acts only when asked, can be stopped instantly, and asks before anything consequential.
- **Only screen work waits.** Anything that doesn't need the mouse starts now.
- **Degrade gracefully.** No signal, a denied permission or a model failure never blocks the user from the text of the step.

## 8. Safety, privacy and trust

- Capture only on the user's action. No background recording; the wake word listens on the Mac only, and no audio is kept.
- The screen is looked at only when the user asks something or gives a task.
- Text in photos, screenshots, manuals and web pages is data and cannot change Tandrix's rules.
- Wiring and live electrical work are refused with a pointer to a qualified person.
- Shared reports are private links that expire and can be revoked. Deleting a project deletes its evidence.

## 9. Success measures

- Mac: the ring lands on the right control at least 9 times in 10 on the test screens.
- Mac: Do it for me finishes common multi-step tasks without looping, and every sensitive action is confirmed.
- Phone: from a sentence to cited steps in about two minutes, with progress shown.
- Phone: a wrong step is caught by the photo check with a specific reason.
- Report: a reader can tell verified from user-confirmed at a glance.

## 10. Risks

| Risk | Mitigation |
|---|---|
| The pointer misses on screen | Fresh-turn computer use with memory; box targets; ask rather than guess. |
| An action does the wrong thing | The action guard, confirms on sensitive actions, instant stop, visible pointer. |
| Wrong steps for a specific item | Manual-grounded steps with page citations; Generic labelled; photo checks. |
| Part misidentified | Candidate labels with confidence; user correction. |
| Over-trust | Honest statuses, "not verifiable from photo", safety gates, no certification claims. |
| Model latency | Fresh turns, low-effort reasoning on interactive calls, pre-voiced common lines, parallel work. |

## References
- Meta models: https://dev.meta.ai/docs/models
- Computer use: https://dev.meta.ai/docs/computer-use
- Wearables Device Access Toolkit: https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/
