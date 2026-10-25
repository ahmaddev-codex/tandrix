/**
 * Runs the Mac app against the local stack:
 *   pnpm --filter @tandrix/desktop dev [-- <electron flags, e.g. --remote-debugging-port=9222>]
 * Serves the renderer with Vite (hot reload), rebuilds the main process and preload on change,
 * and restarts Electron when they change.
 */
import { spawn, type ChildProcess } from "node:child_process";
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

const main = await context({
  entryPoints: [resolve(appDir, "src/main/index.ts"), resolve(appDir, "src/preload/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
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
