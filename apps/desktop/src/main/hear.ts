// Hearing a question on this Mac (SP2): the panel streams the question's audio here as the user
// talks, and the tandrix-wake helper in --hear mode (native/wake/hear.swift) recognises it on the
// device, so letting go gives the text at once instead of an upload and a server transcription.
// The helper has no microphone of its own and nothing leaves the Mac. When it can't hear, the
// panel uploads the recording as before.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { installedApps } from "./apps";

/** Names worth hearing right: Tandrix's own, then the apps on this Mac ("Open Pixelmator"). */
export const NAMES = ["Tandrix", "Hey Tandrix", "Wake up Tandrix"];
/** The longest the panel waits for the text after letting go, before it uploads instead. */
export const HEAR_WAIT_MS = 1500;

export interface HeardLocally {
  text: string;
  /** From the end of the audio to the text. */
  ms: number;
  engine: string;
}

let helper: ChildProcessWithoutNullStreams | undefined;
let engine = "";
let ready = false;
let unusable = false;
let next = 0;
let current = 0;
const waiting = new Map<number, (r: HeardLocally | null) => void>();
let restartAfter = 0;

function helperPath(): string {
  const packaged = join(process.resourcesPath ?? "", "native", "tandrix-wake");
  return existsSync(packaged) ? packaged : join(app.getAppPath(), "dist", "native", "tandrix-wake");
}

function settle(id: number, r: HeardLocally | null) {
  const done = waiting.get(id);
  waiting.delete(id);
  done?.(r);
}

/** Starts the helper ahead of the first question, so it's warm when the user talks. */
export function warmHearing() {
  if (helper || unusable || Date.now() < restartAfter) return;
  const path = helperPath();
  if (!existsSync(path)) {
    unusable = true;
    return;
  }
  const child = spawn(path, ["--hear"], { stdio: ["pipe", "pipe", "pipe"] });
  helper = child;
  ready = false;
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      let msg: {
        ready?: boolean;
        engine?: unknown;
        heard?: unknown;
        text?: unknown;
        ms?: unknown;
        error?: unknown;
      };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (msg.ready) {
        ready = true;
        engine = typeof msg.engine === "string" ? msg.engine : "";
      }
      if (typeof msg.heard === "number")
        settle(msg.heard, {
          text: typeof msg.text === "string" ? msg.text.slice(0, 2000) : "",
          ms: typeof msg.ms === "number" ? msg.ms : 0,
          engine,
        });
      // It can't hear on this Mac (no on-device recognition, or no permission): uploads it is.
      if (typeof msg.error === "string") unusable = true;
    }
  });
  child.stderr.resume();
  child.on("error", () => {
    unusable = true;
  });
  child.on("exit", () => {
    if (helper === child) helper = undefined;
    ready = false;
    for (const id of [...waiting.keys()]) settle(id, null);
    // A crash: try again on the next question, but not in a tight loop.
    restartAfter = Date.now() + 5000;
  });
}

const write = (obj: unknown) => {
  if (helper && ready) helper.stdin.write(`${JSON.stringify(obj)}\n`);
};

/** A new question: returns its id, or 0 when this Mac can't hear it (it will be uploaded). */
export function beginHearing(): number {
  warmHearing();
  if (!helper || !ready) return 0;
  if (current) write({ cancel: current });
  current = ++next;
  write({ begin: current, words: [...NAMES, ...installedApps().slice(0, 100 - NAMES.length)] });
  return current;
}

/** 16 kHz mono 16-bit PCM, as recorded. */
export function hearAudio(id: number, pcm: Uint8Array) {
  if (id && id === current) write({ audio: Buffer.from(pcm).toString("base64") });
}

/** The user let go: the question's text, or null when it couldn't be heard here in time. */
export function endHearing(id: number): Promise<HeardLocally | null> {
  if (!id || id !== current || !helper || !ready) return Promise.resolve(null);
  current = 0;
  return new Promise((resolve) => {
    const timer = setTimeout(() => settle(id, null), HEAR_WAIT_MS);
    waiting.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    write({ end: id });
  });
}

export function cancelHearing(id: number) {
  if (!id || id !== current) return;
  current = 0;
  write({ cancel: id });
}

export function stopHearing() {
  helper?.stdin.end();
  helper?.kill();
  helper = undefined;
}
