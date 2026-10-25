# StepRow

A StepRow is one step in a job's list: its number, its title, where it stands and where it came from. The whole row opens the step.

- **Anatomy:** the step number in `mono` `text-secondary`, tabular; the title in `heading-14`; then a `StatusChip` and a `SourceChip` (Generic when the step has no citation).
- **Look:** `background-100` with `shadow-sm`, padding `space-4`, at least `control-field` tall. Hover `gray-100`, pressed `gray-200`, focus ring as everywhere.
- **Accessibility:** the row is one button, so its label carries everything a sighted user sees: "Step 2: Fit the mechanical seal, To do, Manual p.3, fig. 2".
- **Provide:** `index`, `title`, `status`, optional `statusLabel` (same meaning only, e.g. "To do" for pending), `source`, `onSelect`.
- **Don't:** hide the source, or show a status the step hasn't earned (`verified` only after a passing check).
