// Landing the pen exactly on a part (the spine, an arm, a line of a chart): the model's point can
// be 20 or 30 pixels off a thin line, so it's moved to the nearest pixel that's actually drawn
// there (ink: anything that stands out from the local background), read from the screenshot.

/** Pixels of a screenshot, as the canvas gives them: RGBA, row by row. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const luminance = (d: Uint8ClampedArray, i: number) =>
  0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;

/**
 * The nearest drawn pixel to a point, within `radius`: one whose brightness differs from the
 * patch's typical (median) brightness by more than `contrast`. The point itself when it's already
 * on ink, or when nothing nearby is.
 */
export function nearestInk(
  px: Pixels,
  at: { x: number; y: number },
  radius = 45,
  contrast = 55,
): { x: number; y: number } {
  const x0 = Math.max(0, Math.round(at.x - radius));
  const y0 = Math.max(0, Math.round(at.y - radius));
  const x1 = Math.min(px.width - 1, Math.round(at.x + radius));
  const y1 = Math.min(px.height - 1, Math.round(at.y + radius));
  if (x1 < x0 || y1 < y0) return at;
  // The background: the patch's median brightness (most of a patch round a part is background).
  const sample: number[] = [];
  for (let y = y0; y <= y1; y += 3)
    for (let x = x0; x <= x1; x += 3) sample.push(luminance(px.data, (y * px.width + x) * 4));
  sample.sort((a, b) => a - b);
  const bg = sample[Math.floor(sample.length / 2)] ?? 0;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = (x - at.x) ** 2 + (y - at.y) ** 2;
      if (d >= bestD || d > radius * radius) continue;
      if (Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) > contrast) {
        best = { x, y };
        bestD = d;
      }
    }
  return best ?? at;
}

/** A screenshot's pixels, decoded once; null when it can't be read. */
export async function readPixels(image: Uint8Array, mimeType: string): Promise<Pixels | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([image as BlobPart], { type: mimeType }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { data, width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
}

/**
 * How a part is marked, as a teacher would on a whiteboard: traced along (a curve), looped round
 * (a group), boxed (a block), underlined or highlighted (words), bracketed (lines that go
 * together), struck through (what's wrong), ticked or crossed (right and wrong), pointed at with
 * an arrow, measured across or up (a span), or dotted when it's tiny.
 */
export { MARK_KINDS, type MarkKind } from "@tandrix/contracts";
import type { MarkKind } from "@tandrix/contracts";

/** A mark as the pen draws it: strokes in order, each a run of points (the pen lifts between). */
export type Strokes = Array<Array<[number, number]>>;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rgbAt = (px: Pixels, x: number, y: number) => {
  const i = (y * px.width + x) * 4;
  return [px.data[i]!, px.data[i + 1]!, px.data[i + 2]!] as const;
};
const colourGap = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** The background's brightness round a box: the median of the patch, sampled. */
function background(px: Pixels, b: Box): number {
  const s: number[] = [];
  const step = Math.max(2, Math.round(Math.sqrt((b.w * b.h) / 1500)));
  for (let y = Math.max(0, b.y); y < Math.min(px.height, b.y + b.h); y += step)
    for (let x = Math.max(0, b.x); x < Math.min(px.width, b.x + b.w); x += step)
      s.push(luminance(px.data, (y * px.width + x) * 4));
  s.sort((a, c) => a - c);
  return s[Math.floor(s.length / 2)] ?? 255;
}

const grow = (b: Box, by: number, px: Pixels): Box => {
  const x = Math.max(0, Math.round(b.x - by));
  const y = Math.max(0, Math.round(b.y - by));
  return {
    x,
    y,
    w: Math.min(px.width - x, Math.round(b.w + 2 * by)),
    h: Math.min(px.height - y, Math.round(b.h + 2 * by)),
  };
};

/**
 * Along a curve or line (a sine wave, a bond, a bone): from the point on it, follow the pixels of
 * its own colour column by column (row by row for an upright part), each step the run nearest the
 * last, so it stays on its curve where others cross it. Points in screenshot pixels, in order.
 */
export function traceAlong(
  px: Pixels,
  seed: { x: number; y: number },
  box: Box,
): Array<[number, number]> {
  const b = grow(box, 10, px);
  const bg = background(px, b);
  const start = nearestInk(px, seed, 30);
  const colour = rgbAt(px, Math.round(start.x), Math.round(start.y));
  const isInk = (x: number, y: number) => {
    const c = rgbAt(px, x, y);
    return (
      Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) > 35 && colourGap(c, colour) < 80
    );
  };
  const across = b.w >= b.h;
  // Walk one way from the seed, then the other.
  const walk = (dir: 1 | -1) => {
    const out: Array<[number, number]> = [];
    let along = Math.round(across ? start.x : start.y);
    let at = across ? start.y : start.x;
    let missed = 0;
    const end = across ? (dir > 0 ? b.x + b.w : b.x) : dir > 0 ? b.y + b.h : b.y;
    for (; dir > 0 ? along < end : along >= end; along += dir) {
      // The runs of ink across this column (or row), and the one nearest where the curve was.
      let best: number | null = null;
      let bestGap = 28;
      let runStart = -1;
      const lo = across ? b.y : b.x;
      const hi = across ? b.y + b.h : b.x + b.w;
      for (let k = lo; k <= hi; k++) {
        const on = k < hi && (across ? isInk(along, k) : isInk(k, along));
        if (on && runStart < 0) runStart = k;
        if (!on && runStart >= 0) {
          const mid = (runStart + k - 1) / 2;
          if (Math.abs(mid - at) < bestGap) {
            bestGap = Math.abs(mid - at);
            best = mid;
          }
          runStart = -1;
        }
      }
      if (best === null) {
        if (++missed > 8) break;
        continue;
      }
      missed = 0;
      at = best;
      out.push(across ? [along, best] : [best, along]);
    }
    return out;
  };
  const back = walk(-1).reverse();
  const forth = walk(1);
  const pts = [...back, ...forth];
  // The middle of each run jitters a pixel or two: smoothed across five neighbours, it's one
  // clean pen line that still lies on the curve, tight bends included; then every fourth point.
  const k = across ? 1 : 0;
  const pass = (line: Array<[number, number]>) =>
    line.map((p, i) => {
      const near = line.slice(Math.max(0, i - 2), i + 3);
      const avg = near.reduce((s, q) => s + q[k], 0) / near.length;
      return (k === 1 ? [p[0], avg] : [avg, p[1]]) as [number, number];
    });
  // Twice: smoother where curves cross and blur into each other, still tight on the bends.
  const smoothed = pass(pass(pts));
  return smoothed.filter((_, i) => i % 4 === 0 || i === smoothed.length - 1);
}

/** Every drawn pixel inside a box (any colour that stands out), sampled: what's really there. */
function inkIn(px: Pixels, box: Box): Array<[number, number]> {
  const b = grow(box, 4, px);
  const bg = background(px, grow(box, 16, px));
  const out: Array<[number, number]> = [];
  const step = Math.max(1, Math.round(Math.sqrt((b.w * b.h) / 20000)));
  for (let y = b.y; y < b.y + b.h; y += step)
    for (let x = b.x; x < b.x + b.w; x += step)
      if (Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) > 45) out.push([x, y]);
  return out;
}

/** The convex hull of points (monotone chain), counter-clockwise. */
function hull(points: Array<[number, number]>): Array<[number, number]> {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Round what's drawn in a part (a functional group, an organ): its hull, pushed out a little and
 * gone round once, starting from the top-left, as a hand would loop it.
 */
export function outlineAround(px: Pixels, box: Box): Array<[number, number]> {
  const ink = inkIn(px, box);
  const shape =
    ink.length >= 6
      ? hull(ink)
      : ([
          [box.x, box.y],
          [box.x + box.w, box.y],
          [box.x + box.w, box.y + box.h],
          [box.x, box.y + box.h],
        ] as Array<[number, number]>);
  const cx = shape.reduce((s, p) => s + p[0], 0) / shape.length;
  const cy = shape.reduce((s, p) => s + p[1], 0) / shape.length;
  // Out from the middle by a margin, so the loop goes round the drawing, not through it.
  const out = shape.map(([x, y]): [number, number] => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * 9, y + ((y - cy) / d) * 9];
  });
  // Start at the top-left-most point and close the loop.
  const first = out.reduce((bi, p, i) => (p[0] + p[1] < out[bi]![0] + out[bi]![1] ? i : bi), 0);
  const loop = [...out.slice(first), ...out.slice(0, first)];
  return [...loop, loop[0]!];
}

/** Under what's written in a part: from its first ink to its last, just below its lowest. */
export function underlineBelow(px: Pixels, box: Box): Array<[number, number]> {
  const ink = inkIn(px, box);
  const xs = ink.map((p) => p[0]);
  const ys = ink.map((p) => p[1]);
  const left = xs.length ? Math.min(...xs) : box.x;
  const right = xs.length ? Math.max(...xs) : box.x + box.w;
  const y = (ys.length ? Math.max(...ys) : box.y + box.h) + 5;
  return [
    [left - 3, y + 1],
    [(left + right) / 2, y - 1],
    [right + 3, y + 1],
  ];
}

/** The box round what's actually drawn in a part (its ink), else the part's own box. */
function inkBox(px: Pixels, box: Box): Box {
  const ink = inkIn(px, box);
  if (ink.length < 4) return box;
  const xs = ink.map((p) => p[0]);
  const ys = ink.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A small seeded wobble, so straight strokes look drawn by hand. */
const jitter = (seed: number) => (Math.sin(seed * 12.9898) * 43758.5453) % 1;

/** A two-line arrowhead at the end of a stroke from (fx, fy) to (tx, ty). */
function head(fx: number, fy: number, tx: number, ty: number, size = 11): Strokes {
  const a = Math.atan2(ty - fy, tx - fx);
  const side = (turn: number): Array<[number, number]> => [
    [tx - size * Math.cos(a - turn), ty - size * Math.sin(a - turn)],
    [tx, ty],
  ];
  return [side(0.5), side(-0.5)];
}

/** The mark for a part, in screenshot pixels: the strokes the pen draws, in order. */
export function markFor(
  px: Pixels,
  kind: MarkKind,
  box: Box,
  point: { x: number; y: number },
): Strokes {
  const at = nearestInk(px, point);
  const b = () => inkBox(px, box);
  switch (kind) {
    case "point":
      return [];
    case "underline":
      return [underlineBelow(px, box)];
    case "trace": {
      const t = traceAlong(px, point, box);
      // Too little to be the curve it was meant to follow: go round the part instead.
      return [t.length >= 4 ? t : outlineAround(px, box)];
    }
    case "outline":
      return [outlineAround(px, box)];
    case "box": {
      const k = b();
      const m = 6;
      const [l, t, r, d] = [k.x - m, k.y - m, k.x + k.w + m, k.y + k.h + m];
      // Round once from the top-left, overshooting the start a little, as a hand closes a box.
      return [
        [
          [l, t],
          [r, t + 1],
          [r - 1, d],
          [l + 1, d],
          [l, t - 1],
          [l + 8, t],
        ],
      ];
    }
    case "highlight": {
      const k = b();
      const mid = k.y + k.h / 2;
      return [
        [
          [k.x - 3, mid + 1],
          [k.x + k.w / 2, mid - 0.5],
          [k.x + k.w + 3, mid],
        ],
      ];
    }
    case "strike": {
      const k = b();
      return [
        [
          [k.x - 4, k.y + k.h * 0.6],
          [k.x + k.w + 4, k.y + k.h * 0.4],
        ],
      ];
    }
    case "bracket": {
      // A curly brace down the right of the lines, its point at their middle.
      const k = b();
      const x = k.x + k.w + 8;
      const t = k.y - 2;
      const d = k.y + k.h + 2;
      const mid = (t + d) / 2;
      return [
        [
          [x, t],
          [x + 6, t + 4],
          [x + 6, mid - 7],
          [x + 12, mid],
          [x + 6, mid + 7],
          [x + 6, d - 4],
          [x, d],
        ],
      ];
    }
    case "tick": {
      const k = b();
      const x = k.x + k.w + 12;
      const y = k.y + k.h / 2;
      return [
        [
          [x, y],
          [x + 6, y + 8],
          [x + 20, y - 12],
        ],
      ];
    }
    case "cross": {
      const k = b();
      const s = Math.max(14, Math.min(k.w, k.h, 60) / 2);
      const cx = k.x + k.w / 2;
      const cy = k.y + k.h / 2;
      return [
        [
          [cx - s, cy - s],
          [cx + s, cy + s],
        ],
        [
          [cx + s, cy - s],
          [cx - s, cy + s],
        ],
      ];
    }
    case "arrow": {
      // In from the upper left (or wherever there's room), stopping just short of the thing.
      const fx = at.x - 70 > 0 ? at.x - 70 : at.x + 70;
      const fy = at.y - 50 > 0 ? at.y - 50 : at.y + 50;
      const tx = at.x + (fx < at.x ? -5 : 5);
      const ty = at.y + (fy < at.y ? -5 : 5);
      const bend = jitter(at.x + at.y) * 8;
      return [
        [
          [fx, fy],
          [(fx + tx) / 2 + bend, (fy + ty) / 2 - 6],
          [tx, ty],
        ],
        ...head(fx, fy, tx, ty),
      ];
    }
    case "span_x": {
      // Across the part, just below it: a measuring arrow with heads at both ends.
      const k = b();
      const y = k.y + k.h + 10;
      const [l, r] = [k.x, k.x + k.w];
      return [
        [
          [l, y],
          [r, y],
        ],
        ...head(r, y, l, y, 9),
        ...head(l, y, r, y, 9),
      ];
    }
    case "span_y": {
      const k = b();
      const x = k.x + k.w + 10;
      const [t, d] = [k.y, k.y + k.h];
      return [
        [
          [x, t],
          [x, d],
        ],
        ...head(x, d, x, t, 9),
        ...head(x, t, x, d, 9),
      ];
    }
  }
}
