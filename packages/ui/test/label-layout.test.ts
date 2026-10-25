import { describe, expect, it } from "vitest";
import { estimateLabelSize, placeLabels, type LabelBox } from "../src/native/label-layout";

const view = { width: 360, height: 300 };
const label = (over: Partial<LabelBox>): LabelBox => ({
  top: 150,
  bottom: 220,
  centerX: 180,
  width: 100,
  height: 30,
  ...over,
});
const rect = (p: { left: number; top: number }, l: LabelBox) => ({
  ...p,
  right: p.left + l.width,
  bottom: p.top + l.height,
});
const intersect = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("placeLabels", () => {
  it("puts a label just above its part, centred", () => {
    const [p] = placeLabels([label({})], view);
    expect(p).toEqual({ left: 130, top: 150 - 8 - 30 });
  });

  it("goes below when there's no room above", () => {
    const [p] = placeLabels([label({ top: 10, bottom: 60 })], view);
    expect(p!.top).toBe(68);
  });

  it("stays inside the view horizontally", () => {
    const [l, r] = placeLabels(
      [label({ centerX: 5 }), label({ centerX: 355, top: 60, bottom: 90 })],
      view,
    );
    expect(l!.left).toBe(0);
    expect(r!.left).toBe(260);
  });

  it("never overlaps another label", () => {
    // The case seen on the simulator: a part near the top whose label would land on the label of
    // a larger part just below it.
    const big = label({ top: 120, bottom: 260, centerX: 200, width: 110 });
    const small = label({ top: 20, bottom: 80, centerX: 120, width: 130, height: 50 });
    const [a, b] = placeLabels([big, small], view);
    expect(intersect(rect(a!, big), rect(b!, small))).toBe(false);
  });

  it("separates three labels crowded on one spot", () => {
    const ls = [0, 1, 2].map(() => label({ top: 140, bottom: 160 }));
    const ps = placeLabels(ls, view);
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++)
        expect(intersect(rect(ps[i]!, ls[i]!), rect(ps[j]!, ls[j]!))).toBe(false);
  });
});

describe("estimateLabelSize", () => {
  it("grows with the text, caps the width and makes room for Possible match", () => {
    expect(estimateLabelSize("Impeller", false)).toEqual({ width: 88, height: 30 });
    expect(estimateLabelSize("x".repeat(100), true)).toEqual({ width: 240, height: 50 });
  });
});
