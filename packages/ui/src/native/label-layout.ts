// Where each PartHighlight label goes, in view pixels. Prefer just above its part, then just
// below; never on top of another label; always inside the view. Pure, so it can be tested.

export interface LabelBox {
  /** The part's box on screen. */
  top: number;
  bottom: number;
  centerX: number;
  /** Estimated label size. */
  width: number;
  height: number;
}

export interface PlacedLabel {
  left: number;
  top: number;
}

const GAP = 8;

const overlaps = (
  a: PlacedLabel & { w: number; h: number },
  b: PlacedLabel & { w: number; h: number },
) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;

/** Rough label size: Geist field-caption is about 8.5px per character at 15px. */
export function estimateLabelSize(
  text: string,
  possible: boolean,
): { width: number; height: number } {
  return {
    width: Math.min(240, Math.round(text.length * 8.5) + 20),
    height: possible ? 50 : 30,
  };
}

export function placeLabels(
  labels: LabelBox[],
  view: { width: number; height: number },
): PlacedLabel[] {
  const placed: Array<PlacedLabel & { w: number; h: number }> = [];
  return labels.map((l) => {
    const left = Math.max(0, Math.min(view.width - l.width, l.centerX - l.width / 2));
    const clampTop = (t: number) => Math.max(0, Math.min(view.height - l.height, t));
    const candidates = [
      l.top - GAP - l.height, // above
      l.bottom + GAP, // below
    ].filter((t) => t >= 0 && t + l.height <= view.height);
    const fits = (top: number) =>
      !placed.some((p) => overlaps(p, { left, top, w: l.width, h: l.height }));

    let top = candidates.find(fits);
    if (top === undefined) {
      // Both sides blocked or out of view: start at the preferred side and step past each label
      // in the way until it's clear.
      top = clampTop(candidates[0] ?? l.top);
      for (let i = 0; i < placed.length + 1 && !fits(top); i++) {
        const blocker = placed.find((p) =>
          overlaps(p, { left, top: top!, w: l.width, h: l.height }),
        )!;
        const next = blocker.top + blocker.h + GAP;
        top = next + l.height <= view.height ? next : clampTop(blocker.top - GAP - l.height);
      }
    }
    const result = { left, top, w: l.width, h: l.height };
    placed.push(result);
    return { left, top };
  });
}
