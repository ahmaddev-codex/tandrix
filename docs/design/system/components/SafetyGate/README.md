# SafetyGate

A SafetyGate stands between a hazardous step and its start. The step can't begin until the gate is confirmed.

- **Mandatory (default):** a `blue-100` panel with the ISO 7010 mandatory-action disc (`mandatory`). It says exactly what to do ("Isolate power at the panel and release line pressure") and has one full-width `mandatory` Button that names the action ("Confirm isolated").
- **Confirmed:** replaces the button with a `green-900` check and the time it was confirmed.
- **Stop:** a `red-100` panel with a prohibition disc. Use it for refusals (wiring, live work). It has no action.
- **Provide:** `title`, `body`, `actionLabel`, `onConfirm`; `confirmed` once done; `tone="stop"` for refusals.
- **Don't:** dismiss it with a close icon, style it amber, or combine two hazards in one gate.
