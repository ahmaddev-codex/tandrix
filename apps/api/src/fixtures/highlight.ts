// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): finds the first part in the middle of
// the photo with a mask, the second as a lower-confidence box, and reports the rest missing, so
// every highlight state can be seen and tested without the model.
import type { Highlighter } from "../highlighter";

/** An octagon filling a 40×40 raster: a stand-in for a SAM mask outline. */
const OCTAGON = "M12 0L28 0L40 12L40 28L28 40L12 40L0 28L0 12Z";

export const fixtureHighlighter: Highlighter = {
  async find({ size, parts }) {
    const [first, second] = parts;
    const w = Math.max(1, Math.round(size.width * 0.36));
    const h = Math.max(1, Math.round(size.height * 0.3));
    const picks = [];
    if (first) {
      picks.push({
        partSpecId: first.id,
        box: { x: Math.round(size.width * 0.32), y: Math.round(size.height * 0.36), w, h },
        mask: { path: OCTAGON, raster: { width: 40, height: 40 } },
        confidence: 0.92,
      });
    }
    if (second) {
      picks.push({
        partSpecId: second.id,
        box: {
          x: Math.round(size.width * 0.08),
          y: Math.round(size.height * 0.1),
          w: Math.round(w * 0.6),
          h: Math.round(h * 0.6),
        },
        mask: null,
        confidence: 0.55,
      });
    }
    return {
      status: "found",
      picks,
      ...(parts.length > 2 ? { hint: "Show the rest of the parts laid out flat" } : {}),
    };
  },
};
