# Input

Input is a single-line text field with a label, an optional unit, and a hint or error below it.

- Always has a visible label above it; the placeholder is only an example, never the label.
- Use `mono` for model numbers, serials and values, and `suffix` for units ("Nm", "bar").
- The border is `border-control`; focus shows the `focus-ring`. An error turns the border `red-700` and the message `red-900`, with an icon. The message says what's expected ("The manual specifies 25 Nm for these bolts").
- `size="field"` makes it 56px tall with 18px text for the phone.
- **Provide:** `label`, `value` or `defaultValue`, `onChange`, and optionally `hint`, `error`, `suffix`, `mono`, `inputMode`, `placeholder`, `disabled`.
