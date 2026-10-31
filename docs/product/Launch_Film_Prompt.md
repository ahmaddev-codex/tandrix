# Prompt: the Tandrix launch film

Paste everything below the line into a new Claude Code session opened in this repository. It is written for Claude as the director, motion designer, sound designer and editor of a product film. It asks for the film to be built in code (Remotion) from the real product, so Claude can make nearly all of it; the few things it can't make are listed under "What you need besides Claude".

## What you need besides Claude

Have these ready, or decide to use the fallback. None of them stops the storyboard.

| What | Why | Fallback if you don't have it |
| ---- | --- | --- |
| The person's voice lines | Claude can't record a human voice | Sound-off captions for the person's lines; Tandrix's voice stays |
| A licensed music track | Claude can't license or compose finished music | A minimal bed synthesised in code, or no music in the first cut |
| Licences for the photos marked "unconfirmed" below | They aren't in the site's credits | Claude rebuilds those screens in code, or uses credited material |
| Your approval of the storyboard | The session waits for it before building | None |

---

You are the creative director, motion designer, sound designer and editor for the launch film of **Tandrix**, working in this repository. The bar is a first-party Google or Apple product film: one clear idea, real product on screen, calm confident pacing, and every frame on-brand. You will plan it, build it in code, render it, and hand over the files.

## The product, in one breath

Tandrix is one AI assistant for getting things done on your Mac and in front of you. On the Mac it looks at your screen, rings the exact control to use, and says the next step out loud. Hold ⌥⌘ to talk; let go to ask. Say “teach me” and it goes one step at a time, checking your screen. Hand it a goal and it does the steps itself across your apps (Do it for me): the bar at the top says what it's doing now (“Opening your calendar”), it asks before anything that sends, pays or deletes, and only Esc or the hotkey stops it. On the iPhone it sees through the camera: point it at something and ask, and it outlines what it means and says the answer. It reads the label, finds the real manual, outlines the parts you have and says what's missing, and checks each step from a photo. Someone who knows a job can record it once and Tandrix writes the steps. Risky steps wait until you confirm they're safe. A step that needs the computer goes to the Mac in one tap, and the finished job can be shared as a report.

Read these before writing anything, and use them as the source of truth: `docs/product/PRD.md`, `docs/product/User_Flows.md`, `apps/web/src/content/home.tsx` and `apps/web/src/app/(marketing)/page.tsx` (the marketing page and its copy), `apps/web/src/app/(marketing)/whats-new/page.tsx` (what shipped), `packages/ui/src/web/styles.css` and `packages/ui/src/web/overlay.tsx` (the presence pill and pointer), `packages/ui/tokens/tokens.json` (colour and type tokens).

## The one idea

**Tell it what you want done. It shows you the way.** Every scene proves that line: a person says what they want in plain words, and Tandrix points the way on a real screen or a real object, then checks it worked.

## Audience and goal

People who aren't experts at the thing in front of them: a new app at work, a router at 11 pm, a kit on the bench. After watching, a viewer should be able to say what Tandrix does in one sentence and want to sign up. The film ends on the website's call to action.

**The call to action is “Get early access” at `usetandrix.vercel.app`.** The apps aren't publicly downloadable yet: there's no App Store listing and no signed Mac download. Never say or show “Download”, “Available now” or an App Store badge.

## Deliverables

Make them in this order and show me each before starting the next. If time runs short, the first two are what matter.

1. A one-page **storyboard** (rendered frames plus timing) and a **shot list** with durations, before you build.
2. **Hero film**, 75 seconds, 16:9, 1920×1080, 30 fps. Also 3840×2160 only if the sources in each shot hold up at that size (see "Source quality").
3. **Cut-down**, 30 seconds, 16:9.
4. **Social cut**, 15 seconds, 9:16 (1080×1920), designed for sound off with burned-in captions.
5. **Hero loop**, 8 to 12 seconds, silent and seamless, for the website hero.
6. Masters as ProRes 422 HQ and web files as H.264 (High, about 12 Mbps at 1080p) and AV1/WebM. Captions as `.srt` for every cut. Stills: a poster frame for each cut.

## Story (75 s)

Plan it to this arc, then tighten it in the storyboard. Keep each beat to one action.

| Time | Beat | On screen |
| ---- | ---- | --- |
| 0–5 | **Quiet open** | Bright sky (`apps/web/public/photos/hero.png`), slow push in. The presence pill fades in at top centre: “Listening ⌥⌘”. Hands rest on a keyboard (`typing-on-laptop.mp4`). |
| 5–15 | **The ask** | A person, slightly lost in a spreadsheet, holds ⌥⌘: “Teach me pivot tables.” The waveform in the pill follows the voice. |
| 15–25 | **It shows the way** | The real spreadsheet. The blue ring settles on Insert; the pointer lands; the caption: “Click Insert, then PivotTable.” Tandrix's voice says it. The click lands. |
| 25–37 | **Out into the world** | Cut to the iPhone camera over a robot kit: outlines draw on the screwdriver, brackets and board, one by one. “Found these. The wheels go on last.” |
| 37–47 | **The real manual** | The exploded diagram: the ring finds the ultrasonic sensor. Footage: hands fitting a part (`working-on-electornics.mp4`). A photo check turns **Verified**. |
| 47–57 | **Do it for me** | Calendar on a laptop: “Book my dentist Thursday at ten.” The bar reads “Opening your calendar”, then what it's doing next. It pauses: “Send the invite?” You confirm. |
| 57–65 | **Stays safe, stays yours** | Three quick cards: “Asks before it sends or pays.” “Unplug it first.” (the gate waits) “Esc stops it at once.” |
| 65–75 | **The line and the ask** | The 3D ring of real moments turns once, as on the website (`apps/web/src/components/widgets/Carousel3D.tsx`), then resolves to the mark. Line: “Tell it what you want done.” Then: “Tandrix. On your Mac and your iPhone.” End card: “Get early access”, `usetandrix.vercel.app`. |

The 30 s cut keeps the ask, the ring on Insert, the parts outlines, Do it for me, and the end line. The 15 s cut is the ask, the ring, one outline, the line.

## Visual language

Match the website exactly; it is the brand. All design comes from this repository's design system, never from a skill's or template's defaults.

- **Colour:** white, black and the Tandrix blue only. Blue is `#2e7dff` (`--highlight`), with `--blue-100` and `--blue-700` for tints and depth. Read values from the tokens rather than retyping them. Real app screenshots keep their own colours.
- **Type:** Geist (in `apps/web/node_modules/geist`). Headlines weight 500, tracking about −0.05 em, sentence case. Never all-caps headlines.
- **Icons:** Phosphor only, through the `Icon` component in `@tandrix/ui`, solid and without a coloured container behind them.
- **The mark:** the pointer on a dark rounded tile, ringed with the blue gradient border (`packages/ui/src/web/wordmark.tsx`, `BrandMark`). Use it at the open and the end card only.
- **Tandrix on screen:** the presence pill (`PresenceBar` in `overlay.tsx`; states `listening`, `thinking`, `looking`, `answering`, `doing`) and the ring-and-pointer on a control. Reuse the real components and CSS, don't redraw them. During a task the pill says the action it's performing, not a thinking phrase and not the words it will speak. The pointer has no “Clicking now” caption.
- **Ground:** bright, airy sky for open and close; clean white for product moments; real photos and footage for the world.
- **Composition:** generous space, one subject per frame, slight parallax between layers, rounded 20–28 px corners on cards, soft blue-tinted shadows.

## Motion principles

- One idea per move. Nothing moves without a reason.
- Easing: standard `cubic-bezier(0.2, 0.7, 0.2, 1)` for entrances; `cubic-bezier(0.4, 0, 0.2, 1)` for transitions. No bounces, no elastic.
- Durations: UI micro-moves 180–300 ms, card and camera moves 600–900 ms, scene transitions 400–600 ms. Hold every readable caption at least 1.5 s.
- The ring always “settles”: scale from 1.12 to 1 with a soft blue glow pulse, then the pointer arrives 150 ms after.
- Camera: slow push-ins (2–4% over a shot), gentle parallax on photos (Ken Burns, never more than 6%). Real footage plays at natural speed unless a slower take reads calmer; never below 0.6×.
- Transitions: match-cuts on the blue ring or the pill; dissolve through sky between the Mac and the physical world.
- Respect real UI: never fake a feature. Anything shown must be something Tandrix does today (check the PRD, What's new and the site's FAQ). Moving the mouse does not stop a task; don't show or say that it does.

## Sound direction

- **Music:** warm, optimistic, minimal. About 96–104 BPM, felt piano or soft synth pad with light pulsing plucks, a gentle lift at the turn to “Do it for me” and a resolve on the end line. No vocals. Leave space under the voice. If I haven't given you a licensed track, ask once, then use the fallback at the top of this file. Never pull in music whose licence you can't state.
- **Voice:** Tandrix's own voice for its lines. Generate them locally with the product's speech engine (Kokoro through `kokoro-js`, voice `af_heart`, as in `apps/api/src/speech.ts`) so the film sounds like the product. It runs on this Mac and costs nothing. The person's lines are a natural human voice that I record or supply. Short, plain, warm.
- **Sound design palette:** a soft, glassy tick when the ring settles; a tactile key-down for ⌥⌘; a breathy rise when the pill starts listening; a low paper slide for manual pages; a crisp but quiet confirm for **Verified**; an airy whoosh for the 3D ring. Everything subtle, nothing cartoonish. Synthesise these in code, or state each one's licence.
- **Mix:** dialogue first. Integrated loudness about −14 LUFS for web (−16 for the social cut), true peak −1 dBTP, music ducked 8–10 dB under voice. Measure it; don't assume.

## Assets in this repository

| Material | Files | Size | Rights |
| --- | --- | --- | --- |
| Owner's footage, `design/media/originals/` | `typing-on-laptop.mp4` | 4096×2160 | Owner's |
| | `working-on-electornics.mp4` | 3840×2160 | Owner's |
| | `working-on-a-cpu.mp4` | 2160×4096 (vertical) | Owner's |
| | `working-on-machine.mp4` | 1080×1920 (vertical) | Owner's |
| Site clips, `apps/web/public/videos/` | `laptop-*.mp4`, `phone-coffee.mp4`, `sky-clouds.mp4`, `woodwork.mp4`, `workshop.mp4` | 640×360 | Mixkit licence, see `CREDITS.md` |
| Skies, `apps/web/public/photos/` | `hero.png` | 3768 wide | Unconfirmed |
| | `sky-bright.jpg`, `sky-fluffy.jpg` | 2200 wide | CC, see `CREDITS.md`; attribution needed |
| Objects | `tools-flatlay.jpg` | 1800 wide | CC0 |
| Screens and objects | `wifi-settings.jpeg` | 1460 wide | Unconfirmed; private names must stay replaced, as on the site |
| | `budget-laptop.jpeg`, `calendar-laptop.jpeg`, `analytics-laptop.jpeg`, `robot-manual.jpeg`, `robot-parts.jpeg`, `manual-booklet.jpeg`, `manual-leaflet.jpeg` | About 736 wide | Unconfirmed |

- **Rights:** “Unconfirmed” means the file isn't listed in `apps/web/public/photos/CREDITS.md`. Ask me about those before the storyboard is final, and list every third-party asset and its licence at handover.
- **Source quality:** a 640×360 clip or a 736 px photo won't hold up full-frame at 1080p, let alone 4K. Don't upscale and hope. Use the owner's originals for footage. For Mixkit clips, get the higher-resolution download from the source link in `CREDITS.md`, under the same licence. For screens, rebuild the app in code at full resolution so it's sharp at any size; a small photo can only stay small in the frame. If a shot still can't hold up, tell me and propose a replacement.
- **Ring and outline positions:** `apps/web/src/components/scenes/photos.ts` has them in photo pixel coordinates; outlines on the parts photo are real segmenter output. Use them so the ring lands exactly on the control, and rescale them with the photo.
- **Live product:** the Mac app (`pnpm --filter @tandrix/desktop dev`) and the iPhone simulator (`pnpm --filter @tandrix/mobile ios`) can be screen-recorded for real UI moments (`xcrun simctl io booted recordVideo`).

## Rules of this repository

- **Screens:** never send a real capture of my Mac to a model, and don't record it with my personal content on screen. Use synthetic screens, or a window-only capture of something made for the film.
- **Secrets:** never read or print values from `.env` or `.env.local`; check presence only. The film shouldn't need them.
- **Model spend:** real model calls bill real credit. The film shouldn't need many; say what a run will cost before making any. Kokoro is free.
- **Production:** don't touch the live API, database or website, and don't add test data to them.
- **Git:** work on `dev`. Commit only when I ask, and push only when I ask. Messages are always `type(scope): one short imperative change` with short `- ` bullets in the body. No AI or Claude attribution anywhere, including commits, PRs and credits.
- **Rendered files:** add `apps/film/out/` to `.gitignore` first; never commit renders.
- **Other work:** leave `apps/web/src/components/figures/rack` alone; it's in progress. Reuse components from `apps/web` and `packages/ui` without changing their behaviour on the site.
- **Tools:** ask before installing anything system-wide. `ffmpeg` isn't installed here, and you'll need it for loudness measurement and probably AV1 (`brew install ffmpeg`). Check Remotion's current licence terms and tell me if the project would need a paid licence.

## How to build it

1. Write the storyboard and shot list first; show them to me and wait for my go-ahead.
2. Build the film in **Remotion** (React video) in a new workspace package `apps/film`, reusing the real components and CSS from `packages/ui` so the UI is pixel-true. One composition per cut, sharing scene components.
3. Generate Tandrix's voice lines with Kokoro to WAV, time the scenes to them, and lay in music and sound effects as audio tracks in Remotion.
4. Render previews at 1080p, review them yourself frame by frame against this brief (on-brand, readable, sharp, nothing faked, captions held long enough), fix, then render masters.
5. Hand over the files in `apps/film/out/`, with a short note listing every third-party asset and its licence.

## Acceptance criteria

- The one idea reads in the first 15 seconds, sound on or off.
- Only white, black and the Tandrix blue as brand colours; Geist type; Phosphor icons; the real presence pill, ring and mark.
- Every product claim is something Tandrix does today. No invented customers, quotes, numbers or ratings.
- The film ends on “Get early access” and never implies the apps can be downloaded today.
- Only Esc or the hotkey stops a task, anywhere it comes up.
- Every shot is sharp at its delivered size, with no visibly upscaled material.
- Every asset's licence is known, and attribution is included where a licence requires it.
- Captions match the voice and are held at least 1.5 s; the social cut works with sound off.
- Loudness and formats as specified, and measured; the hero loop is seamless.
