// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): the last part on the
// list is missing (the demo's removed O-ring), the second is a possible match, the rest are found,
// each in its own cell of a grid across the photo.
import type { PartsChecker } from "../parts-checker";

export const fixturePartsChecker: PartsChecker = {
  async check({ size, parts }) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(parts.length)));
    const w = Math.floor(size.width / cols);
    const h = Math.floor(size.height / cols);
    return {
      status: "checked",
      results: parts.map((p, i) => {
        const missing = parts.length > 1 && i === parts.length - 1;
        const possible = parts.length > 2 && i === 1;
        const box = {
          x: (i % cols) * w + Math.floor(w * 0.15),
          y: Math.floor(i / cols) * h + Math.floor(h * 0.15),
          w: Math.max(1, Math.floor(w * 0.7)),
          h: Math.max(1, Math.floor(h * 0.7)),
        };
        return {
          partSpecId: p.id,
          status: missing ? "missing" : possible ? "possible" : "found",
          boxes: missing ? [] : [{ box, confidence: possible ? 0.5 : 0.9 }],
        };
      }),
    };
  },
};
