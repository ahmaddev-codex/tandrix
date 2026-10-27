# StepCard

A StepCard is the phone's single working step: one instruction, one reason, one check. It sits under the camera frame.

- **Anatomy:** the step count, status and source; the title in `field-instruction`; the body in `field-body`, in `text-secondary`; an optional caution in `amber-900` on `amber-100`; then an optional StepVisual (the step's pictures), then the actions.
- **Title:** one imperative sentence of at most 8 words where possible ("Fit the impeller onto the shaft").
- **Actions:** one `field`-size primary Button ("Check my work") plus an icon-only mic Button. Nothing else.
- **Provide:** `index`, `total`, `title`; optionally `body`, `caution`, `status`, `source`, `sourceKind`, `visual`, `actions`.
- **Don't:** list several actions in one card, or put a caution that belongs to another step.
