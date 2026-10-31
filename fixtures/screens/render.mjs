// Renders the pointing bench's app screens to JPEGs the way the Mac captures a display (1280 px
// wide, JPEG quality 80), with each target control's box in the image's pixels and the question
// that should point at it. Run with Electron:
//   apps/desktop/node_modules/.bin/electron fixtures/screens/render.mjs
// Writes <screen>.jpg and targets.json here; apps/api/scripts/pointing-bench.ts reads them.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";

const dir = import.meta.dirname;
const SCREENS = ["mail", "settings", "photos", "sheet"];
const WIDTH = 1440;
const HEIGHT = 900;
const IMAGE_WIDTH = 1280;

app.dock?.hide();
// Closing each screen's window must not end the run.
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
    await new Promise((r) => setTimeout(r, 300));
    const targets = await win.webContents.executeJavaScript(`
    [...document.querySelectorAll("[data-target]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.target, ask: window.__asks[el.dataset.target], box: { x: r.x, y: r.y, w: r.width, h: r.height } };
    })
  `);
    const shot = await win.webContents.capturePage();
    const k = IMAGE_WIDTH / WIDTH;
    const image = shot.resize({ width: IMAGE_WIDTH, quality: "best" });
    writeFileSync(join(dir, `${name}.jpg`), image.toJPEG(80));
    const { width, height } = image.getSize();
    out.push({
      screen: name,
      file: `${name}.jpg`,
      width,
      height,
      targets: targets
        .filter((t) => t.ask)
        .map((t) => ({
          id: t.id,
          ask: t.ask,
          box: {
            x: Math.round(t.box.x * k),
            y: Math.round(t.box.y * k),
            w: Math.round(t.box.w * k),
            h: Math.round(t.box.h * k),
          },
        })),
    });
    win.destroy();
    console.log(`${name}: ${targets.length} targets`);
  }
  writeFileSync(join(dir, "targets.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${out.reduce((n, s) => n + s.targets.length, 0)} targets on ${out.length} screens`);
  app.quit();
}
