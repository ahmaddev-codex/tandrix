/**
 * The marking bench: how exactly Tandrix marks what it explains. Asks the local API about the
 * teaching screens in fixtures/screens/teach (render them first with render.mjs there), draws each
 * part's mark with the Mac's own code (apps/desktop/src/renderer/lib/ink.ts) from the screenshot's
 * pixels, and scores it against the part's true shape. Real models: a few cents a screen. Start
 * the API first with `pnpm --filter @tandrix/api dev`.
 *   pnpm --filter @tandrix/api marking-bench [screen…]
 * Writes fixtures/screens/teach/out/<screen>.png: the screen, the true parts (magenta, dotted) and
 * the marks as the Mac draws them (green), with the model's box for each (grey).
 *
 * A part passes when the model names it, its box overlaps the truth (IoU ≥ 0.4, either view of
 * it), and its mark is on it: a trace with 90% of its points within 6 px of the line; a loop or
 * box round at least 85% of the part and no more than 3 times its area; a line under, over or
 * through words across at least 80% of them and at the right height; a dot or arrow tip on it.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wantsExplanation, wantsLesson } from "@tandrix/core";
import { markFor, type Pixels } from "../../desktop/src/renderer/lib/ink";
import { placeQuote, type ReadLine } from "../../desktop/src/renderer/lib/text-place";
import { readLedger } from "../src/spend";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const dir = join(import.meta.dirname, "../../../fixtures/screens/teach");
const out = join(dir, "out");
const ledger = join(import.meta.dirname, "..", ".meta-spend.json");
const tmp = join(out, "tmp");
mkdirSync(tmp, { recursive: true });

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Part {
  id: string;
  names: string[];
  box: Box;
  alt?: Box;
  points: Array<[number, number]>;
}
interface Screen {
  screen: string;
  file: string;
  width: number;
  height: number;
  ask: string;
  parts: Part[];
}
interface Region {
  quote?: string | null;
  label: string;
  detail: string | null;
  mark: string;
  point: { x: number; y: number } | null;
  box: Box;
}

/**
 * The bench picture's colours (an image for the bench's own report, not app UI): the mark is the
 * overlay's own green (packages/ui/src/web/styles.css, --tx-mark).
 */
/* eslint-disable no-restricted-syntax */
const C = { mark: "#1a9c4a", halo: "#fff", model: "#888", point: "#e5484d", truth: "#d63bd6" };
/* eslint-enable no-restricted-syntax */

const only = process.argv.slice(2);
// PARTS=parts-1920.json measures sharper screenshots (render.mjs with WIDTH=1920).
const screens = (
  JSON.parse(readFileSync(join(dir, process.env.PARTS ?? "parts.json"), "utf8")) as Screen[]
).filter((s) => !only.length || only.includes(s.screen));

const auth = (await (
  await fetch(`${env("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ email: env("DEV_USER_EMAIL"), password: env("DEV_USER_PASSWORD") }),
  })
).json()) as { access_token: string };

/** A JPEG's pixels, through macOS's sips (to BMP) so no image library is needed. */
function pixelsOf(file: string): Pixels {
  const bmp = join(tmp, "p.bmp");
  execFileSync("sips", ["-s", "format", "bmp", file, "--out", bmp], { stdio: "ignore" });
  const b = readFileSync(bmp);
  const offset = b.readUInt32LE(10);
  const width = b.readInt32LE(18);
  const rawH = b.readInt32LE(22);
  const height = Math.abs(rawH);
  const bpp = b.readUInt16LE(28) / 8;
  const stride = Math.ceil((width * bpp) / 4) * 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = rawH > 0 ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const i = offset + row * stride + x * bpp;
      const o = (y * width + x) * 4;
      data[o] = b[i + 2]!;
      data[o + 1] = b[i + 1]!;
      data[o + 2] = b[i]!;
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

const area = (b: Box) => Math.max(0, b.w) * Math.max(0, b.h);
function iou(a: Box, b: Box) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = x * y;
  return i / (area(a) + area(b) - i || 1);
}
const inBox = (p: { x: number; y: number }, b: Box, pad = 0) =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

function inPolygon(x: number, y: number, poly: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polyArea(poly: Array<[number, number]>) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    a += (poly[j]![0] + poly[i]![0]) * (poly[j]![1] - poly[i]![1]);
  return Math.abs(a / 2);
}
const nearest = (p: [number, number], pts: Array<[number, number]>) =>
  pts.reduce((m, q) => Math.min(m, Math.hypot(q[0] - p[0], q[1] - p[1])), Infinity);

/** How well a mark sits on its part: a score from 0 to 1, and why. */
function markScore(
  kind: string,
  strokes: Array<Array<[number, number]>>,
  truth: Box,
  part: Part,
): { ok: boolean; why: string } {
  const all = strokes.flat();
  if (kind === "point" || kind === "arrow") {
    // A dot has no strokes; the arrow's tip is its last point of the first stroke.
    return { ok: true, why: "tip checked by point" };
  }
  if (!all.length) return { ok: false, why: "no strokes" };
  if (kind === "trace") {
    const on = all.filter((p) => nearest(p, part.points) <= 6).length / all.length;
    return { ok: on >= 0.9, why: `${Math.round(on * 100)}% on the line` };
  }
  if (kind === "outline" || kind === "box") {
    const poly = strokes[0]!;
    let n = 0;
    let inside = 0;
    for (let y = truth.y; y <= truth.y + truth.h; y += Math.max(1, truth.h / 12))
      for (let x = truth.x; x <= truth.x + truth.w; x += Math.max(1, truth.w / 12)) {
        n++;
        if (inPolygon(x, y, poly)) inside++;
      }
    const cover = inside / (n || 1);
    const size = polyArea(poly) / (area(truth) || 1);
    return {
      ok: cover >= 0.85 && size <= 3,
      why: `round ${Math.round(cover * 100)}%, ${size.toFixed(1)}× its area`,
    };
  }
  // Lines under, over or through words.
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const span =
    Math.max(0, Math.min(Math.max(...xs), truth.x + truth.w) - Math.max(Math.min(...xs), truth.x)) /
    (truth.w || 1);
  const y = ys.reduce((s, v) => s + v, 0) / ys.length;
  const height =
    kind === "underline"
      ? y >= truth.y + truth.h - 4 && y <= truth.y + truth.h + 14
      : kind === "highlight" || kind === "strike"
        ? y >= truth.y && y <= truth.y + truth.h
        : true;
  return {
    ok: span >= 0.8 && height,
    why: `across ${Math.round(span * 100)}%${height ? "" : ", wrong height"}`,
  };
}

const spentBefore = readLedger(ledger).totalUsd;
let passed = 0;
let total = 0;
for (const s of screens) {
  const file = join(dir, s.file);
  const data = readFileSync(file).toString("base64");
  const px = pixelsOf(file);
  const explain = wantsExplanation(s.ask);
  const lesson = !explain && wantsLesson(s.ask);
  const started = Date.now();
  const res = await fetch(`${api}/screen/ask`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({
      screenshot: { mimeType: "image/jpeg", data },
      transcript: s.ask,
      geometry: {
        displayId: "1",
        imageWidth: s.width,
        imageHeight: s.height,
        originX: 0,
        originY: 0,
        displayWidth: 1440,
        displayHeight: 900,
      },
      mode: "show",
      history: [],
      explain,
      lesson,
    }),
  });
  const body = (await res.json()) as { status: string; reply?: string; regions?: Region[] };
  const regions = body.regions ?? [];
  console.log(
    `\n${s.screen}: "${s.ask}" → ${explain ? "explain" : lesson ? "lesson" : "show"}, ${regions.length} parts marked, ${Date.now() - started} ms`,
  );
  // The text on the screen, read as the Mac reads it (native/text), to place quoted text exactly.
  const read = JSON.parse(
    execFileSync(join(import.meta.dirname, "../../desktop/dist/native/tandrix-text"), [file], {
      encoding: "utf8",
    }),
  ) as { lines: ReadLine[] };
  // Then each drawn part clicked, streamed, as the Mac does while it speaks the intro.
  const answered = Date.now() - started;
  const toClick = regions.flatMap((r, i) => (r.quote ? [] : [i]));
  const clickTimes: number[] = [];
  if (toClick.length) {
    const t0 = Date.now();
    const res = await fetch(`${api}/screen/locate`, {
      method: "POST",
      headers: { authorization: `Bearer ${auth.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({
        screenshot: { mimeType: "image/jpeg", data },
        geometry: {
          displayId: "1",
          imageWidth: s.width,
          imageHeight: s.height,
          originX: 0,
          originY: 0,
          displayWidth: 1440,
          displayHeight: 900,
        },
        parts: toClick.map((i) => ({
          label: regions[i]!.label,
          detail: regions[i]!.detail,
          box: regions[i]!.box,
        })),
      }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let held = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (value) held += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = held.indexOf("\n")) >= 0) {
        const line = JSON.parse(held.slice(0, nl)) as {
          i: number;
          point: { x: number; y: number } | null;
          box: Box;
        };
        held = held.slice(nl + 1);
        clickTimes.push(Date.now() - t0);
        const r = regions[toClick[line.i]!]!;
        r.box = line.box;
        if (line.point) r.point = line.point;
      }
      if (done) break;
    }
  }
  console.log(
    `  answer in ${answered} ms; clicks landed at ${clickTimes.map((t) => `${(t / 1000).toFixed(1)}s`).join(", ") || "-"} after it`,
  );
  const drawn: Array<{ r: Region; strokes: Array<Array<[number, number]>> }> = [];
  for (const r of regions) {
    const placed = r.quote ? placeQuote(read.lines, r.quote) : null;
    if (placed) {
      r.box = {
        x: Math.round(placed.x),
        y: Math.round(placed.y),
        w: Math.round(placed.w),
        h: Math.round(placed.h),
      };
      r.point = { x: Math.round(placed.x + placed.w / 2), y: Math.round(placed.y + placed.h / 2) };
    }
    const point = r.point ?? { x: r.box.x + r.box.w / 2, y: r.box.y + r.box.h / 2 };
    drawn.push({
      r,
      strokes: markFor(px, r.mark as Parameters<typeof markFor>[1], r.box, point),
    });
  }
  for (const part of s.parts) {
    const d = drawn.find(({ r }) =>
      part.names.some((n) => r.label.toLowerCase().includes(n.toLowerCase())),
    );
    if (!d) continue;
    total++;
    const truths = [part.box, ...(part.alt ? [part.alt] : [])];
    const truth = truths.reduce((a, b) => (iou(d.r.box, b) > iou(d.r.box, a) ? b : a));
    const o = iou(d.r.box, truth);
    const point = d.r.point;
    const pointOn = point ? inBox(point, truth, 4) : false;
    const m = markScore(d.r.mark, d.strokes, truth, part);
    const ok = o >= 0.4 && pointOn && m.ok;
    if (ok) passed++;
    console.log(
      `  ${ok ? "PASS" : "FAIL"} ${part.id.padEnd(11)} "${d.r.label}" ${d.r.mark.padEnd(9)} IoU ${o.toFixed(2)}  point ${pointOn ? "on" : "off"}  mark ${m.why}`,
    );
  }
  const unnamed = s.parts.filter(
    (p) =>
      !regions.some((r) => p.names.some((n) => r.label.toLowerCase().includes(n.toLowerCase()))),
  );
  if (unnamed.length) console.log(`  (not marked: ${unnamed.map((p) => p.id).join(", ")})`);
  const extra = regions.filter(
    (r) =>
      !s.parts.some((p) => p.names.some((n) => r.label.toLowerCase().includes(n.toLowerCase()))),
  );
  if (extra.length) console.log(`  (also marked: ${extra.map((r) => r.label).join(", ")})`);

  // The picture: truth dotted magenta, model boxes grey, marks green as the Mac draws them.
  const path = (pts: Array<[number, number]>) =>
    pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}">
  <image href="file://${file}" width="${s.width}" height="${s.height}"/>
  ${s.parts.map((p) => [p.box, ...(p.alt ? [p.alt] : [])].map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${C.truth}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>`).join("")).join("\n")}
  ${drawn.map(({ r }) => `<rect x="${r.box.x}" y="${r.box.y}" width="${r.box.w}" height="${r.box.h}" fill="none" stroke="${C.model}" stroke-width="1"/>`).join("\n")}
  ${drawn.map(({ r, strokes }) => strokes.map((st) => `<path d="${path(st)}" fill="none" stroke="${C.halo}" stroke-width="4.5" opacity="0.85" ${/outline|box/.test(r.mark) ? 'stroke-dasharray="7 4"' : ""}/><path d="${path(st)}" fill="none" stroke="${C.mark}" stroke-width="${r.mark === "highlight" ? 16 : 2}" opacity="${r.mark === "highlight" ? 0.3 : 1}" stroke-linejoin="round" ${/outline|box/.test(r.mark) ? 'stroke-dasharray="7 4"' : ""}/>`).join("") + (r.point ? `<circle cx="${r.point.x}" cy="${r.point.y}" r="4" fill="${C.point}"/>` : "") + `<text x="${r.box.x + r.box.w + 6}" y="${r.box.y + 14}" font-family="Helvetica" font-size="14" fill="${C.mark}" stroke="${C.halo}" stroke-width="3" paint-order="stroke">${r.label.replace(/&/g, "&amp;").replace(/</g, "&lt;")} (${r.mark})</text>`).join("\n")}
</svg>`;
  const svgFile = join(tmp, `${s.screen}.svg`);
  writeFileSync(svgFile, svg);
  execFileSync(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      `--window-size=${s.width},${s.height}`,
      `--screenshot=${join(out, `${s.screen}.png`)}`,
      `file://${svgFile}`,
    ],
    { stdio: "ignore" },
  );
}
const spent = readLedger(ledger).totalUsd - spentBefore;
console.log(`\n${passed} of ${total} parts marked exactly. Spent $${spent.toFixed(3)}.`);
