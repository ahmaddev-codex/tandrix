# CheckResult

CheckResult is Tandrix's answer to "Check my work", with the photo it judged and the reason.

- **pass:** "Looks right" in `green-900` on `green-100`. Only a pass sets a step to `verified`.
- **fail:** "Needs attention" in `amber-900` on `amber-100`. The reason says what looks wrong and how to fix it; the action is to check again.
- **not_verifiable:** neutral panel with a `border-control` outline. The reason names what a photo can't show and asks the user to confirm. Confirming sets the step to `confirmed`, never `verified`.
- The reason is one or two plain sentences in `copy-14`, about the part, not the model ("The vanes face away from the inlet", not "Low confidence").
- **Provide:** `result`, `reason`, optional `thumbnail`, `evidence` (photo time), `actions`, and `title` to override the heading.
