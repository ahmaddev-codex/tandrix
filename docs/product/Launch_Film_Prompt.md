# Prompt: the Tandrix launch film

Paste everything below the line into a new Claude Code session opened in this repository. It is written for Claude as the director, motion designer, sound designer and editor of a product film. It asks for the film to be built in code (Remotion) from the real product, so Claude can make nearly all of it; the few things it can't make are listed under "What you need besides Claude".

---

You are the creative director, motion designer, sound designer and editor for the launch film of **Tandrix**, working in this repository. The bar is a first-party Google or Apple product film: one clear idea, real product on screen, calm confident pacing, and every frame on-brand. You will plan it, build it in code, render it, and hand over the files.

## The product, in one breath

Tandrix is one AI assistant for getting things done on your Mac and in front of you. On the Mac it looks at your screen, rings the exact control to use, and says the next step out loud. Hold ⌥⌘ to talk; let go to ask. Say “teach me” and it goes one step at a time. Hand it a goal and it does the steps itself across your apps (Do it for me), asking before anything that sends, pays or deletes; move the mouse or press Esc and you're back in control. On the iPhone it sees through the camera: it reads the label, finds the real manual, outlines the parts you have and says what's missing, and checks each step from a photo. Risky steps wait until you confirm they're safe. A step that needs the computer goes to the Mac in one tap, and the finished job can be shared as a report.

Read these before writing anything, and use them as the source of truth: `docs/product/PRD.md`, `docs/product/User_Flows.md`, `apps/web/src/app/page.tsx` (the marketing page and its copy), `packages/ui/src/web/styles.css` (the presence pill and pointer), `packages/ui/tokens/tokens.json` (colour and type tokens).

## The one idea

**Tell it what you want done. It shows you the way.** Every scene proves that line: a person says what they want in plain words, and Tandrix points the way on a real screen or a real object, then checks it worked.

## Audience and goal

People who aren't experts at the thing in front of them: a new app at work, a router at 11 pm, a kit on the bench. After watching, a viewer should be able to say what Tandrix does in one sentence and want to download it. The film ends on the website's call to action.

## Deliverables

1. **Hero film**, 75 seconds, 16:9, 3840×2160 and 1920×1080, 30 fps.
2. **Cut-down**, 30 seconds, 16:9.
3. **Social cut**, 15 seconds, 9:16 (1080×1920), designed for sound off with burned-in captions.
4. **Hero loop**, 8 to 12 seconds, silent and seamless, for the website hero.
5. Masters as ProRes 422 HQ and web files as H.264 (High, about 12 Mbps at 1080p) and AV1/WebM. Captions as `.srt` for every cut. Stills: a poster frame for each cut.
6. A one-page **storyboard** (rendered frames plus timing) before you build, and a **shot list** with durations.

## Story (75 s)

Plan it to this arc, then tighten it in the storyboard. Keep each beat to one action.

| Time   | Beat                                   | On screen                                                                                                                                                                                          |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–5    | **Quiet open**                         | Bright sky (`apps/web/public/photos/hero.png`), slow push in. The presence pill fades in at top centre: “Listening ⌥⌘”. A hand rests on a keyboard.                                                  |
| 5–15   | **The ask**                            | A person, slightly lost in a spreadsheet, holds ⌥⌘: “Teach me pivot tables.” The waveform in the pill follows the voice.                                                                           |
| 15–25  | **It shows the way**                   | The real spreadsheet (`photos/budget-laptop.jpeg`). The blue ring settles on Insert; the pointer lands; the caption: “Click Insert, then PivotTable.” Tandrix's voice says it. The click lands. |
| 25–37  | **Out into the world**                 | Cut to the iPhone camera over a robot kit (`photos/robot-parts.jpeg`): outlines draw on the screwdriver, brackets and board, one by one. “Found these. The wheels go on last.”              |
| 37–47  | **The real manual**                    | The exploded diagram (`photos/robot-manual.jpeg`): the ring finds the ultrasonic sensor. Footage: hands fitting a part (`videos/working-on-electornics.mp4`). A photo check turns **Verified**.   |
| 47–57  | **Do it for me**                       | Calendar on a laptop (`photos/calendar-laptop.jpeg`): “Book my dentist Thursday at ten.” The pill reads “Tandrix is in control · Esc”. Steps tick by; it pauses: “Send the invite?” You confirm. |
| 57–65  | **Stays safe, stays yours**            | Three quick cards: “Asks before it sends or pays.” “Unplug it first.” (the gate waits) “Move the mouse to take over.”                                                                              |
| 65–75  | **The line and the ask**               | The 3D ring of real moments turns once, as on the website, then resolves to the mark. Line: “Tell it what you want done.” Then: “Tandrix. On your Mac and your iPhone.” End card with the URL. |

The 30 s cut keeps the ask, the ring on Insert, the parts outlines, Do it for me, and the end line. The 15 s cut is the ask, the ring, one outline, the line.

## Visual language

Match the website exactly; it is the brand.

- **Colour:** white, black and the Tandrix blue only. Blue is `#2e7dff` (`--highlight`), with `--blue-100` and `--blue-700` for tints and depth. Black is near-black `#0b0b0c`; text on sky is white. No other accent colours. Real app screenshots keep their own colours.
- **Type:** Geist (in `node_modules/geist`). Headlines weight 500, tracking about −0.05 em, sentence case. Never all-caps headlines.
- **The mark:** the pointer on a dark rounded tile, ringed with the blue gradient border (`packages/ui/src/web/wordmark.tsx`, `BrandMark`). Use it at the open and the end card only.
- **Tandrix on screen:** the presence pill (dark pill, blue glowing ring, states Listening, Thinking, Answering, In control) and the ring-and-pointer on a control with a dark caption. Reuse the real components and CSS, don't redraw them.
- **Ground:** bright, airy sky for open and close; clean white for product moments; real photos and footage for the world.
- **Composition:** generous space, one subject per frame, slight parallax between layers, rounded 20–28 px corners on cards, soft blue-tinted shadows.

## Motion principles

- One idea per move. Nothing moves without a reason.
- Easing: standard `cubic-bezier(0.2, 0.7, 0.2, 1)` for entrances; `cubic-bezier(0.4, 0, 0.2, 1)` for transitions. No bounces, no elastic.
- Durations: UI micro-moves 180–300 ms, card and camera moves 600–900 ms, scene transitions 400–600 ms. Hold every readable caption at least 1.5 s.
- The ring always “settles”: scale from 1.12 to 1 with a soft blue glow pulse, then the pointer arrives 150 ms after.
- Camera: slow push-ins (2–4% over a shot), gentle parallax on photos (Ken Burns, never more than 6%). Real footage plays at 0.6–0.8× for calm.
- Transitions: match-cuts on the blue ring or the pill; dissolve through sky between the Mac and the physical world.
- Respect real UI: never fake a feature. Anything shown must be something Tandrix does today (check the PRD and the site's FAQ).

## Sound direction

- **Music:** warm, optimistic, minimal. About 96–104 BPM, felt piano or soft synth pad with light pulsing plucks, a gentle lift at the turn to “Do it for me” and a resolve on the end line. No vocals. Leave space under the voice.
- **Voice:** Tandrix's own voice for its lines. Generate them with the product's speech engine (Kokoro, voice `af_heart`, as in `apps/api/src/speech.ts`) so the film sounds like the product. The user's lines are a natural human voice (record one, or use a licensed voice). Short, plain, warm.
- **Sound design palette:** a soft, glassy tick when the ring settles; a tactile key-down for ⌥⌘; a breathy rise when the pill starts listening; a low paper slide for manual pages; a crisp but quiet confirm for **Verified**; an airy whoosh for the 3D ring. Everything subtle, nothing cartoonish.
- **Mix:** dialogue first. Integrated loudness about −14 LUFS for web (−16 for the social cut), true peak −1 dBTP, music ducked 8–10 dB under voice.

## Assets in this repository

- Sky: `apps/web/public/photos/hero.png`, `sky-bright.jpg`, `sky-fluffy.jpg`.
- Real screens and objects: `apps/web/public/photos/budget-laptop.jpeg`, `wifi-settings.jpeg` (private names must stay replaced, as on the site), `calendar-laptop.jpeg`, `analytics-laptop.jpeg`, `robot-manual.jpeg`, `robot-parts.jpeg`, `manual-booklet.jpeg`, `manual-leaflet.jpeg`, `tools-flatlay.jpg`.
- Footage: `apps/web/public/videos/*.mp4` (compressed). Full-quality originals of the owner's clips are in `design/media/originals/`. Use originals for the master.
- Exact ring and outline positions on the photos: `apps/web/src/components/scenes/photos.ts` (photo pixel coordinates; outlines on the parts photo are real segmenter output). Use them so the ring lands exactly on the control.
- Live product: the Mac app (`pnpm --filter @tandrix/desktop dev`) and the iPhone simulator (`pnpm --filter @tandrix/mobile ios`) can be screen-recorded for real UI moments (`xcrun simctl io booted recordVideo`).
- Credits and licences: `apps/web/public/photos/CREDITS.md`. Keep attribution in the film's end credits where licences need it.

## How to build it

1. Write the storyboard and shot list first; show them to me and wait for my go-ahead.
2. Build the film in **Remotion** (React video) in a new workspace package `apps/film`, reusing the real components and CSS from `packages/ui` so the UI is pixel-true. One composition per cut, sharing scene components.
3. Generate Tandrix's voice lines with Kokoro to WAV, time the scenes to them, and lay in music and sound effects as audio tracks in Remotion.
4. Render previews at 1080p, review them yourself frame by frame against this brief (on-brand, readable, nothing faked, captions held long enough), fix, then render masters.
5. Hand over the files in `apps/film/out/`, with a short note listing every third-party asset and its licence.

## Acceptance criteria

- The one idea reads in the first 15 seconds, sound on or off.
- Only white, black and the Tandrix blue as brand colours; Geist type; the real presence pill, ring and mark.
- Every product claim is something Tandrix does today. No invented customers, quotes, numbers or ratings.
- Captions match the voice and are held at least 1.5 s; the social cut works with sound off.
- Loudness and formats as specified; the hero loop is seamless.
