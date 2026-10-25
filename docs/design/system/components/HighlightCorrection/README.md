# HighlightCorrection

HighlightCorrection asks the user to confirm or correct one `PartHighlight`, after they tap its label.

- **Question:** says how sure Tandrix is, never that it knows: "This looks like the impeller. Is that right?"
- **Answers, in order:** `primary` "Yes, that's the impeller"; `secondary` "No, that's not it" (the highlight goes away and the part counts as not found); then a `tertiary` "It's the …" for each other part of the step.
- **Look:** `background-100`, `shadow-md`, padding `space-4`, buttons `control-lg` and full width, directly under the photo.
- The answer is stored on the detection; "Yes" and "It's the …" count as the user's confirmation.
- **Provide:** `label`, `otherParts`, `onConfirm`, `onReject`, `onOtherPart`.
- **Don't:** offer parts from other steps, or close it without an answer except by tapping another label.
