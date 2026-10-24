# SourceChip

A SourceChip names where a step, check or claim came from. Every step carries one.

- **Kinds:** `manual` (page and figure), `expert` (recording timestamp), `photo` and `screen` (evidence time), `generic` (no manufacturer source).
- `generic` is styled `amber-900` on `amber-100`, and its default label is "Generic, not from the manufacturer".
- Text is set in `mono-13`, the citation exactly as written: "Manual p.14, fig. 3".
- **Provide:** the citation text. Pass `href` to open the page, recording or evidence.
