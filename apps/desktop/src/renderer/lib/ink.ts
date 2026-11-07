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
/**
 * Where to start a trace near a point: on a coloured line when there is one close by (a sine
 * curve, not the black axis it crosses), else on the nearest ink.
 */
function curveSeed(px: Pixels, at: { x: number; y: number }, bg: number): { x: number; y: number } {
  const r = 16;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = Math.max(0, Math.round(at.y - r)); y <= Math.min(px.height - 1, at.y + r); y++)
    for (let x = Math.max(0, Math.round(at.x - r)); x <= Math.min(px.width - 1, at.x + r); x++) {
      const [R, G, B] = rgbAt(px, x, y);
      const sat = Math.max(R, G, B) - Math.min(R, G, B);
      if (sat < 70 || Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) < 35) continue;
      const d = (x - at.x) ** 2 + (y - at.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  if (!best) return nearestInk(px, at, 30);
  // The line's core, not its pale anti-aliased edge: the most coloured pixel right there.
  let core = best;
  let coreSat = -1;
  for (let y = best.y - 3; y <= best.y + 3; y++)
    for (let x = best.x - 3; x <= best.x + 3; x++) {
      if (x < 0 || y < 0 || x >= px.width || y >= px.height) continue;
      const [R, G, B] = rgbAt(px, x, y);
      const sat = Math.max(R, G, B) - Math.min(R, G, B);
      if (sat > coreSat) {
        coreSat = sat;
        core = { x, y };
      }
    }
  return core;
}

const saturation = (c: readonly number[]) =>
  Math.max(c[0]!, c[1]!, c[2]!) - Math.min(c[0]!, c[1]!, c[2]!);

export function traceAlong(
  px: Pixels,
  seed: { x: number; y: number },
  box: Box,
): Array<[number, number]> {
  // The curve runs on past a box drawn round part of it: follow it across the whole picture
  // round the part, to its own ends.
  const b = grow(box, Math.max(box.w, box.h), px);
  const bg = background(px, grow(box, 10, px));
  const start = curveSeed(px, seed, bg);
  const colour = rgbAt(px, Math.round(start.x), Math.round(start.y));
  // A coloured line never takes in grey (the axis or grid it crosses).
  const coloured = saturation(colour) >= 70;
  const isInk = (x: number, y: number) => {
    const c = rgbAt(px, x, y);
    return (
      Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) > 35 &&
      colourGap(c, colour) < 80 &&
      (!coloured || saturation(c) >= saturation(colour) * 0.4)
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

/**
 * The part's own ink inside its box: what's drawn there, in connected pieces, less what only
 * runs into the box from outside (a leader line from a label, a bracket, the edge of a neighbour):
 * thin pieces that touch the box's edge. Everything else stays, outlines (a ring, a membrane) as
 * much as solid shapes.
 */
function inkIn(px: Pixels, box: Box, at?: { x: number; y: number }): Array<[number, number]> {
  // Looked at a little beyond the box: the part's box is only roughly where it is.
  const b = grow(box, Math.max(12, 0.25 * Math.max(box.w, box.h)), px);
  const near = grow(box, 10, px);
  const within = grow(box, 4, px);
  const bg = background(px, grow(box, 16, px));
  const step = Math.max(1, Math.round(Math.sqrt((b.w * b.h) / 60000)));
  const gw = Math.ceil(b.w / step);
  const gh = Math.ceil(b.h / step);
  const on = new Uint8Array(gw * gh);
  let count = 0;
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = b.x + gx * step;
      const y = b.y + gy * step;
      if (x >= px.width || y >= px.height) continue;
      if (Math.abs(luminance(px.data, (y * px.width + x) * 4) - bg) > 45) {
        on[gy * gw + gx] = 1;
        count++;
      }
    }
  const all = (): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < on.length; i++)
      if (on[i]) out.push([b.x + (i % gw) * step, b.y + Math.floor(i / gw) * step]);
    return out;
  };
  if (count < 6) return all();
  // Connected pieces (8-neighbours, bridging one-cell gaps of anti-aliasing).
  const label = new Int32Array(gw * gh).fill(-1);
  const pieces: Array<{ cells: number[]; x0: number; y0: number; x1: number; y1: number }> = [];
  const stack: number[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || label[i]! >= 0) continue;
    const piece = { cells: [] as number[], x0: gw, y0: gh, x1: 0, y1: 0 };
    label[i] = pieces.length;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % gw;
      const y = (j - x) / gw;
      piece.cells.push(j);
      piece.x0 = Math.min(piece.x0, x);
      piece.y0 = Math.min(piece.y0, y);
      piece.x1 = Math.max(piece.x1, x);
      piece.y1 = Math.max(piece.y1, y);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const k = ny * gw + nx;
          if (on[k] && label[k]! < 0) {
            label[k] = pieces.length;
            stack.push(k);
          }
        }
    }
    pieces.push(piece);
  }
  const thin = Math.max(2, Math.round(5 / step));
  const px0 = (p: (typeof pieces)[number]) => ({
    x: b.x + p.x0 * step,
    y: b.y + p.y0 * step,
    w: (p.x1 - p.x0 + 1) * step,
    h: (p.y1 - p.y0 + 1) * step,
  });
  const share = (r: Box, inside: Box) => {
    const x = Math.max(0, Math.min(r.x + r.w, inside.x + inside.w) - Math.max(r.x, inside.x));
    const y = Math.max(0, Math.min(r.y + r.h, inside.y + inside.h) - Math.max(r.y, inside.y));
    return (x * y) / (r.w * r.h || 1);
  };
  const inNear = (c: number) => {
    const x = b.x + (c % gw) * step;
    const y = b.y + Math.floor(c / gw) * step;
    return x >= near.x && x <= near.x + near.w && y >= near.y && y <= near.y + near.h;
  };
  /** A piece, all of it when it's a thing on its own, else cut to the part's extent. */
  const take = (p: (typeof pieces)[number]) => {
    const r = px0(p);
    return r.w * r.h <= 2.5 * box.w * box.h ? p : { ...p, cells: p.cells.filter(inNear) };
  };
  // Everything drawn wholly inside the part's area (a nucleolus in a nucleus, the inner bonds of
  // a ring), thin or not. Slivers running in from outside (a leader line, a bracket) aren't.
  // Long thin lines (a bracket beside a region, a leader line) are never the part.
  const longLine = (p: (typeof pieces)[number]) => {
    const r = px0(p);
    return (
      (r.w <= thin * step + step || r.h <= thin * step + step) &&
      Math.max(r.w, r.h) > 0.5 * Math.max(box.w, box.h)
    );
  };
  const kept: Array<(typeof pieces)[number]> = pieces.filter(
    (p) => share(px0(p), within) >= 0.8 && !longLine(p),
  );
  // The part's main shape: the piece with most ink in its area (a spine drawn as one piece, cut
  // from its first vertebra to its last; a molecule cut to one group).
  const inside = (p: (typeof pieces)[number]) => p.cells.filter(inNear).length;
  const main = pieces.reduce<(typeof pieces)[number] | null>(
    (a, p) => (!a || inside(p) > inside(a) ? p : a),
    null,
  );
  const lineLike = (p: (typeof pieces)[number]) => p.x1 - p.x0 <= thin || p.y1 - p.y0 <= thin;
  if (main && !kept.includes(main) && !lineLike(main)) kept.push(take(main));
  // And the piece the click landed on (a mitochondrion: all of it, wherever the box was).
  if (at) {
    const gx = Math.round((at.x - b.x) / step);
    const gy = Math.round((at.y - b.y) / step);
    let best: (typeof pieces)[number] | null = null;
    let bestD = Infinity;
    for (const p of pieces)
      for (const c of p.cells) {
        const d = ((c % gw) - gx) ** 2 + (Math.floor(c / gw) - gy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    if (best && !kept.includes(best) && !kept.some((k) => k.cells[0] === best!.cells[0]))
      kept.push(take(best));
  }
  const out: Array<[number, number]> = [];
  for (const p of kept)
    for (const c of p.cells) out.push([b.x + (c % gw) * step, b.y + Math.floor(c / gw) * step]);
  if (out.length >= 6) return out;
  // Nothing to go on: what's inside the box itself.
  return all().filter(
    ([x, y]) =>
      x >= within.x && x <= within.x + within.w && y >= within.y && y <= within.y + within.h,
  );
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
 * Round the part itself, following its shape (a bone, a functional group, an organ): its ink,
 * less thin lines (leader lines, the odd stroke of a label), widened by a margin, and the edge of
 * that traced once, smoothly, from the top-left. Falls back to the hull when there's too little
 * ink to follow.
 */
export function outlineAround(
  px: Pixels,
  box: Box,
  at?: { x: number; y: number },
  margin = MARGIN,
): Array<[number, number]> {
  const ink = inkIn(px, box, at);
  // A shape drawn solid (a bone, an organelle) is followed round its edge; one drawn in thin lines
  // (a molecule's group, a ring of bonds) would come out as tubes round each line, so it's looped
  // round as a whole, smoothly, the way a teacher circles it.
  const contour = contourOf(ink, margin);
  const round = hullLoop(ink, box, margin);
  const loop =
    contour && polygonArea(contour) >= 0.55 * polygonArea(round)
      ? contour
      : chaikin(chaikin(round));
  // Start at the top-left-most point and close the loop.
  const first = loop.reduce((bi, p, i) => (p[0] + p[1] < loop[bi]![0] + loop[bi]![1] ? i : bi), 0);
  const ordered = [...loop.slice(first), ...loop.slice(0, first)];
  return [...ordered, ordered[0]!];
}

/** How far an outline stands off the part. */
const MARGIN = 7;
/** The grid the shape is worked out on, in pixels. */
const CELL = 2;

function polygonArea(p: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    a += (p[j]![0] + p[i]![0]) * (p[j]![1] - p[i]![1]);
  return Math.abs(a / 2);
}

function hullLoop(
  ink: Array<[number, number]>,
  box: Box,
  margin = MARGIN,
): Array<[number, number]> {
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
  return shape.map(([x, y]): [number, number] => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * (margin + 3), y + ((y - cy) / d) * (margin + 3)];
  });
}

/**
 * The outline of a shape from its pixels: a mask on a fine grid, thin lines opened away (unless
 * that leaves nearly nothing: a molecule drawn in thin bonds), grown by the margin with gaps
 * closed, then the edge of its largest piece walked round and smoothed.
 */
function contourOf(ink: Array<[number, number]>, margin: number): Array<[number, number]> | null {
  if (ink.length < 12) return null;
  const xs = ink.map((p) => p[0]);
  const ys = ink.map((p) => p[1]);
  // Room round the shape for it to grow into and shrink back from without touching the edge.
  const pad = 2 * margin + 24;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const w = Math.ceil((Math.max(...xs) + pad - x0) / CELL) + 1;
  const h = Math.ceil((Math.max(...ys) + pad - y0) / CELL) + 1;
  if (w * h > 600_000) return null;
  let mask: Uint8Array = new Uint8Array(w * h);
  for (const [x, y] of ink) mask[Math.floor((y - y0) / CELL) * w + Math.floor((x - x0) / CELL)] = 1;
  // Ink sampled coarser than the grid leaves holes: close them first.
  mask = dilate(mask, w, h, 1);
  const opened = dilate(erode(mask, w, h, 1), w, h, 1);
  const before = mask.reduce((a, v) => a + v, 0);
  const after = opened.reduce((a, v) => a + v, 0);
  if (after > before * 0.35) mask = opened;
  // The margin, and gaps between the pieces of one part closed (vertebrae, atoms and bonds).
  // (Less the cell the holes were closed with, and the half cell the edge walk adds.)
  const grownBy = Math.max(0, Math.round(margin / CELL) - 2);
  mask = erode(dilate(mask, w, h, grownBy + 4), w, h, 4);
  const edge = boundary(largestPiece(mask, w, h), w, h);
  if (!edge || edge.length < 8) return null;
  const pts = edge.map(([cx, cy]): [number, number] => [x0 + cx * CELL, y0 + cy * CELL]);
  return simplify(chaikin(chaikin(pts)), 1.2);
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m;
  // Separable square: rows, then columns.
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = -1;
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) run = x;
      else if (run >= 0 && x - run <= r) a[y * w + x] = 1;
    run = -1;
    for (let x = w - 1; x >= 0; x--)
      if (m[y * w + x]) run = x;
      else if (run >= 0 && run - x <= r) a[y * w + x] = 1;
    for (let x = 0; x < w; x++) if (m[y * w + x]) a[y * w + x] = 1;
  }
  const b = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let run = -1;
    for (let y = 0; y < h; y++)
      if (a[y * w + x]) run = y;
      else if (run >= 0 && y - run <= r) b[y * w + x] = 1;
    run = -1;
    for (let y = h - 1; y >= 0; y--)
      if (a[y * w + x]) run = y;
      else if (run >= 0 && run - y <= r) b[y * w + x] = 1;
    for (let y = 0; y < h; y++) if (a[y * w + x]) b[y * w + x] = 1;
  }
  return b;
}

function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1;
  const grown = dilate(inv, w, h, r);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) out[i] = grown[i] ? 0 : 1;
  return out;
}

/** The biggest connected piece of a mask, alone, with any holes in it filled. */
function largestPiece(m: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  let best = -1;
  let bestSize = 0;
  let n = 0;
  const stack: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]! >= 0) continue;
    let size = 0;
    stack.push(i);
    label[i] = n;
    while (stack.length) {
      const j = stack.pop()!;
      size++;
      const x = j % w;
      const y = (j - x) / w;
      for (const k of [
        x > 0 ? j - 1 : -1,
        x < w - 1 ? j + 1 : -1,
        y > 0 ? j - w : -1,
        y < h - 1 ? j + w : -1,
      ])
        if (k >= 0 && m[k] && label[k]! < 0) {
          label[k] = n;
          stack.push(k);
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = n;
    }
    n++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) if (label[i] === best) out[i] = 1;
  return out;
}

/** The outer edge of a mask's piece, walked round (Moore neighbourhood), in grid cells. */
function boundary(m: Uint8Array, w: number, h: number): Array<[number, number]> | null {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  let start = -1;
  for (let i = 0; i < m.length && start < 0; i++) if (m[i]) start = i;
  if (start < 0) return null;
  const sx = start % w;
  const sy = (start - sx) / w;
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const out: Array<[number, number]> = [[sx, sy]];
  let x = sx;
  let y = sy;
  let d = 6; // came from above
  for (let steps = 0; steps < 200_000; steps++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (d + 6 + k) % 8;
      const nx = x + dirs[nd]![0]!;
      const ny = y + dirs[nd]![1]!;
      if (at(nx, ny)) {
        x = nx;
        y = ny;
        d = nd;
        found = true;
        break;
      }
    }
    if (!found || (x === sx && y === sy)) break;
    out.push([x, y]);
  }
  return out;
}

/** Corner cutting: a smooth line through a polygon's points. */
function chaikin(p: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
    out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
  }
  return out;
}

/** Fewer points, the same line to within `tol` pixels (Ramer–Douglas–Peucker, on a loop). */
function simplify(p: Array<[number, number]>, tol: number): Array<[number, number]> {
  const rdp = (pts: Array<[number, number]>): Array<[number, number]> => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0]!, pts.at(-1)!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let far = 0;
    let at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const q = pts[i]!;
      const d = Math.abs((b[0] - a[0]) * (a[1] - q[1]) - (a[0] - q[0]) * (b[1] - a[1])) / len;
      if (d > far) {
        far = d;
        at = i;
      }
    }
    if (far <= tol) return [a, b];
    return [...rdp(pts.slice(0, at + 1)).slice(0, -1), ...rdp(pts.slice(at))];
  };
  const half = Math.floor(p.length / 2);
  return [
    ...rdp(p.slice(0, half + 1)).slice(0, -1),
    ...rdp([...p.slice(half), p[0]!]).slice(0, -1),
  ];
}

/** Under what's written in a part: from its first ink to its last, just below its lowest. */
export function underlineBelow(
  px: Pixels,
  box: Box,
  at?: { x: number; y: number },
): Array<[number, number]> {
  const ink = inkIn(px, box, at);
  const xs = ink.map((p) => p[0]);
  const ys = ink.map((p) => p[1]);
  const left = xs.length ? Math.min(...xs) : box.x;
  const right = xs.length ? Math.max(...xs) : box.x + box.w;
  const y = (ys.length ? Math.max(...ys) : box.y + box.h) + 5;
  return [
    [left - 3, y],
    [right + 3, y],
  ];
}

/** The box round what's actually drawn in a part (its ink), else the part's own box. */
function inkBox(px: Pixels, box: Box, at?: { x: number; y: number }): Box {
  const ink = inkIn(px, box, at);
  if (ink.length < 4) return box;
  const xs = ink.map((p) => p[0]);
  const ys = ink.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

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
  const b = () => inkBox(px, box, at);
  switch (kind) {
    case "point":
      return [];
    case "underline":
      return [underlineBelow(px, box, at)];
    case "trace": {
      const t = traceAlong(px, point, box);
      // A closed curve (a membrane, a ring) goes back on itself, which a walk across can't
      // follow: round its own line instead, on it.
      const xs = t.map((p) => p[0]);
      const span = t.length ? Math.max(...xs) - Math.min(...xs) : 0;
      if (t.length >= 4 && span >= box.w * 0.6) return [t];
      const ring = outlineAround(px, box, at, 0);
      return [ring.length >= 4 ? ring : t];
    }
    case "outline":
      return [outlineAround(px, box, at)];
    case "box": {
      const k = b();
      const m = 6;
      const [l, t, r, d] = [k.x - m, k.y - m, k.x + k.w + m, k.y + k.h + m];
      // Round once from the top-left, a clean rectangle.
      return [
        [
          [l, t],
          [r, t],
          [r, d],
          [l, d],
          [l, t],
        ],
      ];
    }
    case "highlight": {
      const k = b();
      const mid = k.y + k.h / 2;
      return [
        [
          [k.x - 3, mid],
          [k.x + k.w + 3, mid],
        ],
      ];
    }
    case "strike": {
      const k = b();
      const mid = k.y + k.h / 2;
      return [
        [
          [k.x - 4, mid],
          [k.x + k.w + 4, mid],
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
      return [
        [
          [fx, fy],
          [(fx + tx) / 2, (fy + ty) / 2],
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
