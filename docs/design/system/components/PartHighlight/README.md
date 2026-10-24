# PartHighlight

PartHighlight marks a part on a captured camera frame. It's the physical-world version of the pointer.

- **Stroke stack:** a 1px `highlight-keyline` at 55% opacity, then a 4px `highlight-halo`, then a 2.5px `highlight` outline. It reads on dark metal, bright sky and white walls without changing colour.
- **Mask:** set `mask: true` when SAM returns a mask; the inside fills with `highlight-tint`.
- **Label:** `overlay-ground` with an `overlay-ink` name, the part number in mono, and "Possible match" in `overlay-warn` below the confirm threshold. Tapping the label corrects it.
- **Frame:** `radius-lg`, on a `highlight-keyline` ground while loading.
- **Provide:** the frame as children, its `viewBox`, `targets` from the highlight API, and a text alternative in `alt`.
- **Motion:** the outline draws on in 300ms; no motion under reduced motion.
- **Don't:** highlight more than three parts at once, or show a highlight without its label.
