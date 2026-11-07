// Renders the marking bench's teaching screens the way the Mac captures a display (1280 px wide,
// JPEG quality 80), with each part's true shape: its box, and points along every line of it (a
// curve, a ring's bonds, an outline), in the image's pixels. Run with Electron:
//   apps/desktop/node_modules/.bin/electron fixtures/screens/teach/render.mjs
// Writes <screen>.jpg and parts.json here; apps/desktop/scripts/marking-bench.ts reads them.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";

const dir = import.meta.dirname;
const SCREENS = (process.env.SCREENS ?? "spine,chem,trig,code,equation,cell").split(",");
const WIDTH = 1440;
const HEIGHT = 900;
// The Mac sends 1280 px wide; WIDTH= renders sharper, to measure what more detail is worth.
const IMAGE_WIDTH = Number(process.env.WIDTH ?? 1280);
const SUFFIX = IMAGE_WIDTH === 1280 ? "" : `-${IMAGE_WIDTH}`;

app.dock?.hide();
app.on("window-all-closed", () => undefined);
app.whenReady().then(main);

async function main() {
  const out = [];
  for (const name of SCREENS) {
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      useContentSize: true,
    });
    await win.loadFile(join(dir, `${name}.html`));
    await new Promise((r) => setTimeout(r, 400));
    const k = IMAGE_WIDTH / WIDTH;
    const parts = await win.webContents.executeJavaScript(`(() => {
      const k = ${k};
      const pts = (el) => {
        const out = [];
        const shapes = el instanceof SVGGeometryElement ? [el] : [...el.querySelectorAll("path, ellipse, circle, line, rect, polygon")];
        for (const s of shapes) {
          if (!(s instanceof SVGGeometryElement)) continue;
          const m = s.getScreenCTM();
          const len = s.getTotalLength();
          const n = Math.max(8, Math.ceil(len / 3));
          for (let i = 0; i <= n; i++) {
            const p = s.getPointAtLength((i / n) * len);
            out.push([(m.a * p.x + m.c * p.y + m.e) * k, (m.b * p.x + m.d * p.y + m.f) * k]);
          }
        }
        // Text and HTML: the boxes of what's written.
        const texts = el instanceof SVGTextElement || !(el instanceof SVGElement) ? [el] : [...el.querySelectorAll("text")];
        for (const t of texts) {
          const r = t.getBoundingClientRect();
          if (!r.width) continue;
          for (let x = r.left; x <= r.right; x += 3) out.push([x * k, r.top * k], [x * k, r.bottom * k]);
          for (let y = r.top; y <= r.bottom; y += 3) out.push([r.left * k, y * k], [r.right * k, y * k]);
        }
        return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      };
      return [...document.querySelectorAll("[data-part]")].map((el) => {
        const r = el.getBoundingClientRect();
        // The same part elsewhere in the picture (another view of it), in the same units.
        const alt = el.dataset.alt ? (() => {
          const [x, y, w, h] = el.dataset.alt.split(" ").map(Number);
          const m = el.getScreenCTM();
          return { x: (m.a * x + m.e) * k, y: (m.d * y + m.f) * k, w: m.a * w * k, h: m.d * h * k };
        })() : null;
        return {
          id: el.dataset.part,
          ...(alt ? { alt } : {}),
          names: el.dataset.names.split("|"),
          box: { x: r.x * k, y: r.y * k, w: r.width * k, h: r.height * k },
          points: pts(el),
        };
      });
    })()`);
    const ask = await win.webContents.executeJavaScript("window.__ask");
    const shot = await win.webContents.capturePage();
    const image = shot.resize({ width: IMAGE_WIDTH, quality: "best" });
    writeFileSync(join(dir, `${name}${SUFFIX}.jpg`), image.toJPEG(80));
    const { width, height } = image.getSize();
    out.push({ screen: name, file: `${name}${SUFFIX}.jpg`, width, height, ask, parts });
    win.destroy();
  }
  writeFileSync(join(dir, `parts${SUFFIX}.json`), JSON.stringify(out, null, 1));
  console.log(out.map((s) => `${s.screen}: ${s.parts.length} parts`).join("\n"));
  app.quit();
}
