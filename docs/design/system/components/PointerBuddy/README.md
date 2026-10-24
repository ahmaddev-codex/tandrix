# PointerBuddy

PointerBuddy is Tandrix's pointer on the Mac overlay. It points at the control the user needs, with a short caption.

- **Shape:** an arrow distinct from the system cursor, in a `highlight` fill with a 2px `highlight-halo` and a hairline `highlight-keyline`. It never replaces the user's own cursor.
- **Caption:** `field-caption` text in `overlay-ink` on `overlay-ground`, with `shadow-overlay`, below-right of the tip. At most one sentence, naming the control in the app's own words ("Turn on dry-run protection here").
- **Motion:** flies to the target along a short curve in 500ms; jumps there under reduced motion.
- **Do it for me:** the caption says the action before it happens ("Clicking Save"), then the click follows after about 1 second.
- **Provide:** `x`, `y` in overlay coordinates (already mapped from screenshot pixels and the display's scale factor) and the `caption`.
