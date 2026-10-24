# Tabs

Tabs switch between views of the same job: Steps, Parts, Evidence, Manual on the Mac; Task, Evidence, Assistant on the phone.

- Text tabs with a 2px `gray-1000` underline on the selected tab, and an optional count in a `gray-100` pill.
- Arrow keys move between tabs; only the selected tab is in the tab order.
- `size="field"` makes them 48px tall for the phone.
- **Provide:** `items` (`id`, `label`, optional `count`), `value` and `onChange` (or `defaultValue`), and a `label` for the tab list.
