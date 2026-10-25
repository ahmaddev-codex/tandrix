Tandrix is one AI engineer for the physical and digital worlds. It runs on the phone on site, on Ray-Ban Meta glasses, as an overlay on the Mac, and as web reports. This system is monochrome-first and high-contrast, set in Geist, with colour kept for meaning. It adds field extensions for camera frames, the Mac pointer, evidence statuses, safety and the glasses lens.

## Principles

- **Monochrome carries the product; colour carries meaning.** Build every surface from `background-100`, `background-200` and the gray scale. Use blue, green, amber and red only for a state or an action with that meaning.
- **Evidence is visible.** Every step shows a `SourceChip`, and every status uses `StatusChip`. Never show `confirmed` with the look of `verified`.
- **One action per view.** One `primary` Button per view; everything else is `secondary` or `tertiary`.
- **Readable in the field.** On the phone, primary actions are `control-field` (56px) and instructions are set in `field-instruction`. In direct sun, switch to the `sunlight` theme.

## Voice

- Write short, imperative instructions with one action per sentence: "Fit the impeller onto the shaft."
- Give the reason only after the action: "Vanes face the inlet."
- Say how sure Tandrix is. Write "This looks like the mechanical seal. Is that right?", never "This is the mechanical seal."
- Name what can't be checked: "Tandrix can't check torque from a photo. Confirm you tightened to 25 Nm."
- Use sentence case everywhere. Address the user as "you" and Tandrix as "Tandrix" (not "I" in UI copy; spoken replies may use "I"). No exclamation marks, no emoji, no "Oops".
- Buttons say what happens ("Check my work", "Continue on Mac", "Confirm isolated"). The same word follows through the flow: "Turn on" leads to "Do it for me is on".
- Errors say what happened and what to do: "Tandrix can't find the impeller in this photo. Try from the front, closer."

## Colour

- **Surfaces:** pages and cards on `background-100`, recessed grounds on `background-200`, hover on `gray-100`, pressed on `gray-200`, selected rows on `gray-300`.
- **Text:** `text` (`gray-1000`) for primary text, `text-secondary` (`gray-900`) for reasons and descriptions, `text-tertiary` (`gray-800`) for metadata. All three pass 4.5:1 on `background-100`, `background-200` and `gray-100` in every theme, and 7:1 in `sunlight`.
- **Lines:** `border` (`gray-400`) for decorative hairlines only. The edge of any control uses `border-control` (`gray-600`), at 3:1 or more.
- **Primary:** `primary` fill (`gray-1000`) with `on-primary` text. Blue is never the primary button colour.
- **Blue** (`blue-700`, `blue-900`, `blue-100`): focus, links, selection, in-progress and mandatory actions (ISO 7010 blue). Text on `blue-700` uses `on-blue`.
- **Green:** only `verified` (and a confirmed `SafetyGate`). Never for a reading, a found manual or any other success message. **Amber:** needs attention, cautions, generic sources. **Red:** stop, errors, refusals, destructive actions. Each always comes with an icon and a word.
- **Themes:** `light` is the default on Mac and web. `dark` follows the system. `sunlight` is an added high-contrast theme (7:1 text, 3:1 borders) that the phone offers outdoors and switches to automatically above a light-sensor threshold.

## Field tokens

These sit on photos and over other apps, not on Tandrix surfaces, so they are the same in every theme.

- **Highlight stack (camera frames and the Mac pointer):** a `highlight-keyline` hairline outside, a 4px `highlight-halo`, then a 2.5px `highlight` outline. This stack works on any background, so never draw a highlight without it. Mask fills use `highlight-tint`.
- **Overlay surfaces (pointer caption, in-control indicator, highlight labels):** `overlay-ground` with `overlay-ink` and `shadow-overlay`. Controls inside them use `overlay-raised`, cautions `overlay-warn`, and focus `overlay-focus`.
- **Glasses lens:** `lens-ground` is see-through. Set text in `lens-ink` and the step number in `lens-accent`, nothing else.

## Type

- Set everything in Geist (`sans`). Use Geist Mono (`mono`) only for part numbers, serials, values, citations and logs.
- The scale is compact: every style is named for its size in px. Readability on site comes from contrast, weight and the `sunlight` theme, and touch targets stay large (`control-lg`, `control-field`) even where the text is small.
- **Headings** `heading-32` to `heading-14` use weight 600 and tight negative tracking. Use one `heading-32` per page at most.
- **Field** styles are for the phone and overlay: `field-instruction` for the step instruction, `field-body` for its reason, `field-caption` for pointer captions and highlight labels, `lens-20` for the lens.
- **Copy:** `copy-14` is the phone body, `copy-13` the Mac and web body, `copy-12` for dense tables. Keep line length near 65 characters.
- **Labels and buttons:** `label-*` and `button-*` at weight 500 (`button-15` at 600 for field buttons).
- Use tabular numerals wherever numbers line up: step counts, values, timestamps.

## Space, size, radius, elevation

- Use a 4px grid: `space-1` (4) to `space-16` (64). Card padding is `space-4` on the Mac and `space-5` on the phone; the gap between cards is `space-6`.
- Control heights: `control-sm` 32, `control-md` 40, `control-lg` 48, `control-field` 56, and `control-shutter` 72 for the camera shutter. Anything touched on the phone is at least `control-lg`, and primary phone actions are `control-field`.
- Radius by role: `radius-sm` for source chips and keycaps, `radius-md` for buttons, inputs and captions, `radius-lg` for cards, panels, dialogs and the camera frame, `radius-full` for status chips and the in-control indicator.
- Elevation is mostly a border: `shadow-border` and `shadow-sm` for cards, `shadow-md` for menus and the Mac panel, `shadow-lg` for dialogs. Over other apps, use `shadow-overlay`.

## Motion

- Motion is functional and short. Highlights draw on in 300ms, the pointer flies along a short curve in 500ms, chips and panels change state in 150ms ease.
- Nothing moves on its own, except the in-control dot and the listening indicator.
- Respect reduced motion: highlights appear without drawing, the pointer jumps, and pulses stop.

## States and focus

- Hover: `gray-100` fill on quiet controls; primary darkens to `gray-900`.
- Focus: a 2px solid `focus-ring` with a 2px offset in the surface colour, on every interactive element. Inside overlays, use `overlay-focus`.
- Disabled: `gray-100` fill, `gray-700` text, a `border` hairline. Always explain nearby why it's disabled.

## Iconography

- Icons are [Phosphor](https://phosphoricons.com) (MIT), in two styles only, both in `currentColor`: **solid** (Phosphor Fill) and **outline** (Phosphor Regular). Never mix in another set or another weight.
- **The rule:** solid for small inline icons (16px: in chips, buttons and inputs, next to a word); outline for standalone icons at 20px and up (in cards, banners, notices, gates and field buttons). `Icon` applies it from `size`; set `weight` only to break it on purpose (for example a selected state in solid).
- The bundle's `Icon` covers status, source, capture, safety and notice glyphs (`info` for an info `Notice`; never `progress`, which reads as loading). For anything else take the same Phosphor icon in the same style: `@phosphor-icons/react` on the Mac and web, `phosphor-react-native` on the phone, with `weight="fill"` or `weight="regular"`.
- Icons always sit next to a word, except icon-only buttons, which need an `aria-label`.
- The safety discs in `SafetyGate` follow ISO 7010 shapes: a blue disc for mandatory, a red slashed disc for stop.

## Logo

There is no Tandrix logo yet. Set the name in Geist at weight 600 with `heading-*` tracking, in `text`.

## Surfaces

- **Phone, job:** `SummaryCard`s for what the job has (equipment, manual), one `ActionCard` for what it's waiting on (identify the equipment, add the manual, write the steps), then the steps as `StepRow`s. A `Notice` explains when a service can't help; `ProgressState` covers long waits such as reading the manual.
- **Phone, step:** `CaptureView` on top, `StepCard` below with one `field` primary action plus the mic. After a photo, `PartHighlight` marks the step's parts and `HighlightCorrection` confirms or corrects one; without highlights, list the step's parts by number. `SafetyGate` before a hazardous step; the icon-only mic in the `StepCard` ("Hold to talk") with `VoiceTranscript` under it; `CheckResult` after "Check my work"; `PartsList` for the parts check; `HandoffBanner` when the next step is on the Mac; `Tabs` (Task, Evidence, Assistant) at `field` size. Use the `sunlight` theme outdoors.
- **Glasses:** speech carries the instruction and `LensCard` shows the step. Highlights stay on the phone.
- **Mac:** a menu-bar panel (`shadow-md`, `copy-13`) with `ModeToggle`, the job's steps and `HandoffBanner` (`incoming`); the transparent overlay with `PointerBuddy`, and `ControlIndicator` while in Do it for me mode. Switching to Do it for me always goes through `ConfirmDialog`. Settings use `Toggle` and `Input`.
- **Web report:** `JobReport`, with evidence thumbnails in `radius-lg`.
