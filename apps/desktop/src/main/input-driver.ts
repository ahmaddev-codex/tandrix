// The input driver for Do it for me: the tandrix-input helper (native/input/main.swift) posts the
// mouse and key events, one command at a time. Meanwhile any input from the user (a key, a
// click, moving the mouse) takes control back at once; the driver's own events are told apart
// by timing, since each command is awaited before the next.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

export type DriverCommand =
  | { op: "move" | "click"; x: number; y: number; button?: string; count?: number }
  | { op: "drag"; path: Array<{ x: number; y: number }> }
  | { op: "scroll"; x: number; y: number; dx: number; dy: number }
  | { op: "type"; text: string }
  | { op: "keys"; keys: string[] }
  | { op: "focus" };

export interface DriverReply {
  ok: boolean;
  error?: string;
  secure?: boolean;
}

/** Input arriving this soon after one of ours is ours. */
const OWN_INPUT_MS = 250;

let helper: ChildProcessWithoutNullStreams | undefined;
let lines: Array<(r: DriverReply) => void> = [];
let buffer = "";
let busyUntil = 0;

function helperPath(): string {
  // Packaged: Contents/Resources/native; in dev: apps/desktop/dist/native.
  const packaged = join(process.resourcesPath ?? "", "native", "tandrix-input");
  return existsSync(packaged)
    ? packaged
    : join(app.getAppPath(), "dist", "native", "tandrix-input");
}

function start(): ChildProcessWithoutNullStreams {
  if (helper && helper.exitCode === null) return helper;
  const child = spawn(helperPath(), [], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      let r: DriverReply;
      try {
        r = JSON.parse(line) as DriverReply;
      } catch {
        r = { ok: false, error: "unreadable reply" };
      }
      lines.shift()?.(r);
    }
  });
  child.on("exit", () => {
    for (const waiting of lines) waiting({ ok: false, error: "input helper stopped" });
    lines = [];
    helper = undefined;
  });
  helper = child;
  return child;
}

/** Runs one command; resolves when the helper has posted its events. */
export function drive(cmd: DriverCommand): Promise<DriverReply> {
  const child = start();
  busyUntil = Number.POSITIVE_INFINITY;
  return new Promise<DriverReply>((resolve) => {
    lines.push((r) => {
      busyUntil = Date.now() + OWN_INPUT_MS;
      resolve(r);
    });
    child.stdin.write(`${JSON.stringify(cmd)}\n`);
  });
}

/** True while input could be the driver's own. */
export const driving = () => Date.now() < busyUntil;

export function stopDriver() {
  helper?.kill();
  helper = undefined;
}
