# Button

Buttons start an action and say exactly what happens ("Check my work", "Continue on Mac"), in sentence case.

- **Variants:** `primary` (gray-1000 fill) is the one main action in a view. `secondary` has a `border-control` outline and is the default. `tertiary` is text-only, for low-emphasis actions such as "Skip step". `danger` (red-700) is only for destructive actions. `mandatory` (blue-700) is only for confirming a safety gate.
- **Sizes:** `sm` 32px for dense Mac rows, `md` 40px is the Mac and web default, `lg` 44px for prominent actions, and `field` 44px, full width, for every primary action on the phone.
- **Provide:** the label as children. An icon-only button needs `aria-label` and `iconOnly`.
- **Don't:** put two primary buttons in one view, use colour to rank actions, or add a trailing arrow to the label.
- **Focus:** 2px `focus-ring`, 2px offset.
