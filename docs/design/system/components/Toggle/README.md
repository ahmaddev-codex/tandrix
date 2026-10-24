# Toggle

Toggle turns a setting on or off immediately, with no save step.

- The label says what's on when it's on ("Speak instructions"), with an optional one-line description in `text-secondary`.
- Off track is `gray-600`, on track is `blue-700`, and the thumb is `toggle-thumb`. All meet 3:1 in every theme.
- When disabled, the description says why.
- Never use a toggle to switch to Do it for me; that goes through `ModeToggle` and `ConfirmDialog`.
- **Provide:** `label`, `checked` and `onChange` (or `defaultChecked`), optional `description`, `disabled`.
