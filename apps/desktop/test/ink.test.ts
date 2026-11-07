import { describe, expect, it } from "vitest";
import {
  markFor,
  nearestInk,
  outlineAround,
  traceAlong,
  underlineBelow,
  type Pixels,
} from "../src/renderer/lib/ink";

/** A light page with a dark vertical line at x = 50, 3 px wide. */
function page(): Pixels {
  const width = 120;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4).fill(240);
  for (let y = 0; y < height; y++)
    for (let x = 49; x <= 51; x++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 40;
    }
  return { data, width, height };
}

describe("landing the pen on the part", () => {
  it("moves a point beside a thin line onto the line", () => {
    expect(nearestInk(page(), { x: 75, y: 60 })).toEqual({ x: 51, y: 60 });
    expect(nearestInk(page(), { x: 30, y: 20 })).toEqual({ x: 49, y: 20 });
  });

  it("keeps a point already on ink, and one with nothing drawn nearby", () => {
    expect(nearestInk(page(), { x: 50, y: 60 })).toEqual({ x: 50, y: 60 });
    expect(nearestInk(page(), { x: 110, y: 60 }, 20)).toEqual({ x: 110, y: 60 });
  });
});

/** A plot: blue sine, red cosine and black axes on white, 400 × 200. */
function plot(): Pixels & { sine: (x: number) => number } {
  const width = 400;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const put = (x: number, y: number, c: [number, number, number]) => {
    for (let dy = -1; dy <= 1; dy++) {
      const yy = Math.round(y) + dy;
      if (x < 0 || x >= width || yy < 0 || yy >= height) continue;
      const i = (yy * width + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  };
  const sine = (x: number) => 100 - 70 * Math.sin((x / 400) * 4 * Math.PI);
  const cosine = (x: number) => 100 - 70 * Math.cos((x / 400) * 4 * Math.PI);
  for (let x = 0; x < width; x++) {
    put(x, 100, [0, 0, 0]);
    put(x, cosine(x), [220, 40, 40]);
    put(x, sine(x), [40, 90, 230]);
  }
  for (let y = 0; y < height; y++) put(20, y, [0, 0, 0]);
  return { data, width, height, sine };
}

describe("marking a part exactly", () => {
  it("traces the sine wave along its own curve, through the cosine and the axes", () => {
    const p = plot();
    const pts = traceAlong(p, { x: 100, y: p.sine(100) + 6 }, { x: 0, y: 0, w: 400, h: 200 });
    expect(pts.length).toBeGreaterThan(60);
    const xs = pts.map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThan(15);
    expect(Math.max(...xs)).toBeGreaterThan(385);
    // On the curve: within 4 px even on this plot's tight bends (the band drawn over it is 12 wide).
    for (const [x, y] of pts) expect(Math.abs(y - p.sine(x))).toBeLessThan(4);
  });

  it("loops round what's drawn in a part, close to it, and closes", () => {
    const p = page();
    const loop = outlineAround(p, { x: 30, y: 30, w: 40, h: 40 });
    expect(loop[0]).toEqual(loop.at(-1));
    // Round the line (x 49–51), a margin away from it, not out at the box's edges.
    const xs = loop.map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThan(36);
    expect(Math.max(...xs)).toBeLessThan(64);
  });

  it("underlines just below what's written", () => {
    const p = page();
    const line = underlineBelow(p, { x: 40, y: 20, w: 20, h: 30 });
    expect(line[0]![1]).toBeGreaterThan(50);
  });
});

/** A white page with filled ellipses, a thin label line beside one, and a grey axis. */
function shapes(): Pixels {
  const W = 500;
  const H = 300;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const set = (x: number, y: number, c: [number, number, number]) => {
    const i = (y * W + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (((x - 150) / 60) ** 2 + ((y - 150) / 30) ** 2 <= 1) set(x, y, [200, 60, 50]);
      // A leader line from a label, running in from the right.
      if (y === 150 && x > 215 && x < 320) set(x, y, [40, 40, 40]);
    }
  return { data, width: W, height: H };
}

describe("outlines follow the part, and leave out what's beside it", () => {
  it("goes round an ellipse just outside its edge, not round its label's line", () => {
    const [loop] = markFor(
      shapes(),
      "outline",
      { x: 80, y: 110, w: 170, h: 80 },
      { x: 150, y: 150 },
    );
    const xs = loop!.map((p) => p[0]);
    const ys = loop!.map((p) => p[1]);
    // The ellipse spans 90..210 by 120..180; a margin of about 7 px round it.
    expect(Math.min(...xs)).toBeGreaterThan(78);
    expect(Math.max(...xs)).toBeLessThan(222);
    expect(Math.min(...ys)).toBeGreaterThan(108);
    expect(Math.max(...ys)).toBeLessThan(192);
    // Closed, and clean: a single loop back to where it began.
    expect(loop![0]).toEqual(loop!.at(-1));
  });

  it("draws a box as a clean rectangle", () => {
    const [b] = markFor(shapes(), "box", { x: 80, y: 110, w: 170, h: 80 }, { x: 150, y: 150 });
    expect(b).toHaveLength(5);
    expect(b![0]).toEqual(b![4]);
    expect(b![0]![1]).toBe(b![1]![1]);
  });
});
