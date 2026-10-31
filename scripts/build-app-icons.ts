/**
 * Every app icon, from the Tandrix mark (the pointer in its active ring, as in apps/web/public/icon.svg):
 *   apps/desktop/build/icon.icns            the Mac app, on Apple's grid (824 of 1024, with margin)
 *   apps/desktop/build/trayTemplate*.png    the menu bar: the pointer alone, as a template image
 *   apps/mobile/assets/icon.png             iOS: full bleed and opaque (iOS rounds the corners)
 *   apps/mobile/assets/android-icon-*.png   Android's adaptive layers
 *   apps/mobile/assets/favicon.png, splash-icon.png
 *   tsx scripts/build-app-icons.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..");
const desktop = join(root, "apps/desktop/build");
const mobile = join(root, "apps/mobile/assets");
mkdirSync(desktop, { recursive: true });

/** The pointer, in a 24-unit box (the same path as the overlay's). */
const POINTER =
  "M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z";
/** Its drawn extent in that box, to centre it by what the eye sees. */
const POINTER_BOX = { x: 3.1, y: 3.1, w: 17.2, h: 17.5 };

const INK = "#0b0b0c";
const RING = `<linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2e7dff"/><stop offset=".5" stop-color="#a9cbff"/><stop offset="1" stop-color="#2e7dff"/></linearGradient>`;

/** The pointer centred in a square, `share` of its side wide. */
function pointer(side: number, share: number, fill: string) {
  const k = (side * share) / POINTER_BOX.w;
  const x = (side - POINTER_BOX.w * k) / 2 - POINTER_BOX.x * k;
  const y = (side - POINTER_BOX.h * k) / 2 - POINTER_BOX.y * k;
  return `<path d="${POINTER}" transform="translate(${x} ${y}) scale(${k})" fill="${fill}"/>`;
}

/** The mark on a rounded square of `size`, inset `inset` from each edge of the canvas. */
function mark(canvas: number, inset: number, radius: number) {
  const size = canvas - inset * 2;
  const stroke = size * 0.05;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}"><defs>${RING}</defs><rect x="${inset + stroke / 2}" y="${inset + stroke / 2}" width="${size - stroke}" height="${size - stroke}" rx="${radius}" fill="${INK}" stroke="url(#r)" stroke-width="${stroke}"/>${pointer(canvas, (size / canvas) * 0.46, "#fff")}</svg>`;
}

const svg = (body: string, side: number, background?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${background ? `<rect width="${side}" height="${side}" fill="${background}"/>` : ""}${body}</svg>`;

const png = (source: string, out: string, size?: number) =>
  (size ? sharp(Buffer.from(source)).resize(size, size) : sharp(Buffer.from(source)))
    .png()
    .toFile(out);

// The Mac: Apple's grid, a rounded square 824 of 1024 with the margin left clear for the shadow.
const macIcon = mark(1024, 100, 185);
const set = join(mkdtempSync(join(tmpdir(), "tandrix-icon-")), "icon.iconset");
mkdirSync(set);
for (const size of [16, 32, 128, 256, 512]) {
  await png(macIcon, join(set, `icon_${size}x${size}.png`), size);
  await png(macIcon, join(set, `icon_${size}x${size}@2x.png`), size * 2);
}
execFileSync("iconutil", ["-c", "icns", set, "-o", join(desktop, "icon.icns")]);
rmSync(join(set, ".."), { recursive: true });

// The menu bar: black on clear; macOS tints a template image to suit the bar.
await png(svg(pointer(32, 0.72, "#000"), 32), join(desktop, "trayTemplate@2x.png"));
await png(svg(pointer(32, 0.72, "#000"), 32), join(desktop, "trayTemplate.png"), 16);

// iOS: no transparency and no rounding of its own. The ring sits inside the corners iOS cuts.
const ring = `<defs>${RING}</defs><rect x="84" y="84" width="856" height="856" rx="190" fill="none" stroke="url(#r)" stroke-width="40"/>`;
await png(svg(ring + pointer(1024, 0.42, "#fff"), 1024, INK), join(mobile, "icon.png"));

// Android: the launcher masks a 1024 layer to its middle two thirds or so.
await png(svg("", 1024, INK), join(mobile, "android-icon-background.png"));
await png(svg(pointer(1024, 0.3, "#fff"), 1024), join(mobile, "android-icon-foreground.png"));
await png(svg(pointer(1024, 0.3, "#000"), 1024), join(mobile, "android-icon-monochrome.png"));

// The web build of the app, and the splash.
await png(mark(1024, 0, 280), join(mobile, "favicon.png"), 48);
await png(mark(1024, 0, 280), join(mobile, "splash-icon.png"));

console.log("App icons written.");
