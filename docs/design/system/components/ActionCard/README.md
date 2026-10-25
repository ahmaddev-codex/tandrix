# ActionCard

An ActionCard puts the screen's one next thing to do in front of the user: what it is, why it matters, and a single primary action.

- **Look:** a `background-100` card with `shadow-sm`, padding `space-5`. Title in `heading-20` with an optional 20px icon, body in `copy-16` `text-secondary`. It stays monochrome: the `primary` Button carries the attention, not a coloured panel.
- **Actions:** one `field` primary Button that names what happens ("Find the manual"). Optionally one `tertiary` alternative under it ("Use general steps instead").
- Show one ActionCard per screen at most, for the step the job is waiting on: identify the equipment, add the manual, write the steps.
- **Provide:** `title`, `body`, `actionLabel`, `onAction`; optional `icon`, `secondaryLabel`, `onSecondary`.
- **Don't:** colour it blue or green, add a second primary action, or use it for something the user has already done (use `SummaryCard`).
