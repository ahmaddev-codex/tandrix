// The apps a Do it for me task can open: those installed in the standard places, by name. A task
// opens an app only by a name from this list (never a path or anything the model wrote freely).
import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { drive } from "./input-driver";

const PLACES = [
  "/Applications",
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
  join(homedir(), "Applications"),
];

/** Names that are Tandrix itself (in dev, the Electron app). */
const own = () => new Set([app.getName(), "Tandrix", "Electron"]);

/** Installed app names ("System Settings", "Calendar"), sorted, without Tandrix itself. */
export function installedApps(): string[] {
  const names = new Set<string>();
  for (const dir of PLACES) {
    try {
      for (const f of readdirSync(dir)) if (f.endsWith(".app")) names.add(f.slice(0, -4));
    } catch {
      // Not every place exists on every Mac.
    }
  }
  for (const n of own()) names.delete(n);
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, 500);
}

/** The app in front, unless it's Tandrix (asking from the panel puts Tandrix in front). */
export async function frontApp(): Promise<string | undefined> {
  const r = await drive({ op: "front" });
  const name = r.ok ? r.app : undefined;
  return name && !own().has(name) ? name : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens an installed app by name and waits (up to 5 s) until it's in front. */
export async function openApp(name: string): Promise<boolean> {
  if (!installedApps().includes(name)) return false;
  await new Promise<void>((resolve) => execFile("/usr/bin/open", ["-a", name], () => resolve()));
  for (let i = 0; i < 25; i++) {
    if ((await drive({ op: "front" })).app === name) {
      // A moment for its window to draw before the screenshot.
      await sleep(600);
      return true;
    }
    await sleep(200);
  }
  return false;
}
