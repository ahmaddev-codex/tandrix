# StepVisual

A StepVisual shows the pictures that go with a step: the user's own reference photo, the manual page the step cites, and the latest photo or screenshot taken for it. It sits inside the StepCard, under the step's words.

- **Anatomy:** Tabs when there is more than one picture ("Your reference", "Manual p.4", "Last photo"); a frame in `gray-100` with a 1px `border` and `radius-md`, showing the whole picture (contain) at full card width and at most 280px tall; an expand button (32px, `background-100`, `shadow-sm`) in the frame's top right; a SourceChip under the frame ("Manual p.4, fig. 2", "Your reference 10:46", "Photo 10:46").
- **Order:** the user's reference first, then the manual page, then the latest picture. The first one shows by default.
- **Open:** tapping the frame opens the picture full screen on the phone (pinch or double-tap to zoom) and over the whole panel on the Mac (Esc closes). A manual page is unreadable at frame size; opening it is how it is read.
- **Provide:** `items` (`id`, `label`, `source`, `sourceKind`, the picture, `alt`, optional `aspectRatio`), optionally `value`, `onChange` and `onOpen`.
- **Don't:** put actions inside the frame or the card for it: "Add a reference photo" and "Remove reference" are tertiary Buttons under the StepCard.
