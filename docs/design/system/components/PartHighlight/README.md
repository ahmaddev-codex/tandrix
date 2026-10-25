# PartHighlight

PartHighlight marks a part on a captured camera frame. It's the physical-world version of the pointer.

- **Stroke stack:** a 1px `highlight-keyline` at 55% opacity, then a 4px `highlight-halo`, then a 2.5px `highlight` outline. It reads on dark metal, bright sky and white walls without changing colour.
- **Mask:** set `mask: true` when SAM returns a mask; the inside fills with `highlight-tint`.
- **Label:** `overlay-ground` with an `overlay-ink` name in `field-caption`, the part number in mono, and "Possible match" in `overlay-warn` below the confirm threshold. Tapping the label opens `HighlightCorrection`.
- **Label placement:** just above its part, else just below; inside the frame; never on top of another label. Each label is one control whose accessible name includes "possible match" when it applies.
- **Masks:** SAM masks arrive as an outline traced from the mask raster; draw the stroke stack along that outline, scaled from the raster to the part's box. Without a mask, outline the box with `radius-md` corners.
- **Frame:** `radius-lg`, on a `highlight-keyline` ground while loading.
- **Provide:** the frame as children, its `viewBox`, `targets` from the highlight API, and a text alternative in `alt`.
- **Motion:** the outline draws on in 300ms; no motion under reduced motion.
- **Don't:** highlight more than three parts at once, or show a highlight without its label.
