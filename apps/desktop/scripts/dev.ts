/**
 * Runs the Mac app against the local stack:
 *   pnpm --filter @tandrix/desktop dev [-- <electron flags, e.g. --remote-debugging-port=9222>]
 * Serves the renderer with Vite (hot reload), rebuilds the main process and preload on change,
 * and restarts Electron when they change.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { context } from "esbuild";
import { createServer } from "vite";

const appDir = resolve(import.meta.dirname, "..");
const electronPath = createRequire(import.meta.url)("electron") as unknown as string;

const server = await createServer({ configFile: resolve(appDir, "vite.config.ts") });
await server.listen();
const rendererUrl = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "http://localhost:5173";

let electron: ChildProcess | undefined;
let quitting = false;

async function startElectron() {
  // The app holds a single-instance lock, so the old process must be gone first.
  if (electron && electron.exitCode === null) {
    const old = electron;
    old.removeAllListeners("exit");
    await new Promise((resolve) => {
      old.once("exit", resolve);
      old.kill();
    });
  }
  // Editors built on Electron (VS Code and friends) export ELECTRON_RUN_AS_NODE to their
  // terminals, which would start Electron as plain Node.
  const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
  electron = spawn(electronPath, [".", ...process.argv.slice(2).filter((a) => a !== "--")], {
    cwd: appDir,
    stdio: "inherit",
    env: { ...env, TANDRIX_RENDERER_URL: rendererUrl },
  });
  // Quitting the app from its menu ends the dev session too.
  electron.on("exit", () => {
    if (!quitting) void stop();
  });
}

// Rebuilds can land back to back; restart one at a time.
let restarting = Promise.resolve();
const restart = () => (restarting = restarting.then(startElectron));

// macOS asks the app that launches a helper why it wants speech recognition (the wake word):
// in dev that's the stock Electron app, so its Info.plist gets the same explanation Tandrix's
// own build carries. Idempotent.
const electronPlist = resolve(
  createRequire(import.meta.url).resolve("electron/package.json"),
  "../dist/Electron.app/Contents/Info.plist",
);
try {
  execFileSync(
    "/usr/libexec/PlistBuddy",
    [
      "-c",
      "Add :NSSpeechRecognitionUsageDescription string Tandrix listens for its name on this Mac. Nothing leaves your Mac until you say it.",
      electronPlist,
    ],
    { stdio: "ignore" },
  );
} catch {
  // Already there.
}

// The wake-word helper (native/wake/main.swift): on-device speech recognition only.
execFileSync(
  "swiftc",
  [
    "-O",
    "-o",
    resolve(appDir, "dist/native/tandrix-wake"),
    resolve(appDir, "native/wake/main.swift"),
    resolve(appDir, "native/wake/voiceprint.swift"),
    resolve(appDir, "native/wake/hear.swift"),
    "-Xlinker",
    "-sectcreate",
    "-Xlinker",
    "__TEXT",
    "-Xlinker",
    "__info_plist",
    "-Xlinker",
    resolve(appDir, "native/wake/Info.plist"),
  ],
  { stdio: "inherit" },
);

// The input helper Do it for me drives (native/input/main.swift), built once per dev session.
mkdirSync(resolve(appDir, "dist/native"), { recursive: true });
execFileSync(
  "swiftc",
  [
    "-O",
    "-o",
    resolve(appDir, "dist/native/tandrix-input"),
    resolve(appDir, "native/input/main.swift"),
  ],
  { stdio: "inherit" },
);

const main = await context({
  entryPoints: [resolve(appDir, "src/main/index.ts"), resolve(appDir, "src/preload/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  // Native modules load their own binaries, so they stay outside the bundle.
  external: ["electron", "uiohook-napi"],
  outbase: resolve(appDir, "src"),
  outdir: resolve(appDir, "dist"),
  outExtension: { ".js": ".cjs" },
  sourcemap: true,
  logLevel: "warning",
  plugins: [
    {
      name: "restart-electron",
      setup: (b) => b.onEnd((r) => void (r.errors.length || restart())),
    },
  ],
});
await main.watch();

async function stop() {
  quitting = true;
  electron?.kill();
  await main.dispose();
  await server.close();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
