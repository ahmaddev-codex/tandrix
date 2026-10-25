# SummaryCard

A SummaryCard shows something the job already has, such as the equipment or the manual, with where it came from.

- **Anatomy:** a `label-14` label in `text-secondary` ("Equipment", "Manual"); the name in `heading-20`; short facts in `copy-14` `text-secondary`, in `mono` for serials, part numbers and values; an optional `SourceChip`; at most one `secondary` Button.
- **Look:** `background-100`, `shadow-sm`, padding `space-5`, `radius-lg`.
- Facts are things the user can check against the real object: "Serial 4521-0098", "12 pages".
- **Provide:** `label`, `title`; optional `facts`, `source`, `sourceKind`, `action`.
- **Don't:** put the screen's primary action here; that belongs to an `ActionCard` or the `StepCard`.
