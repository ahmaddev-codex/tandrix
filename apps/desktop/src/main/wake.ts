// The wake word ("Hey Tandrix", "Wake up Tandrix"), heard on this Mac only. The tandrix-wake
// helper (native/wake/main.swift) uses Apple's on-device speech recognition; no audio or text
// leaves the Mac until the user has said Tandrix's name, and then only what they asked. It runs
// only while the user has the wake word switched on.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { isPrint } from "./voiceprint";

export type WakeStatus = "off" | "starting" | "listening" | "unavailable";

/** Why it can't listen, in words for the panel. */
const reasons: Record<string, string> = {
  on_device_unavailable:
    "This Mac can't recognise speech on the device, so the wake word is off. Hold ⌥⌘ to talk instead.",
  speech_not_allowed:
    "Allow Tandrix under Speech Recognition in System Settings > Privacy & Security, then switch the wake word on again.",
  microphone_unavailable: "Tandrix can't use the microphone. Allow it in System Settings.",
  no_recognizer: "Speech recognition isn't available on this Mac.",
};

let helper: ChildProcessWithoutNullStreams | undefined;
/** The name it listens for (VO6); sent to the helper whenever it starts. */
let wakeName = "Tandrix";

/** One word of letters, 3 to 20 long; anything else keeps Tandrix. */
export function cleanWakeName(raw: unknown): string {
  const w = typeof raw === "string" ? raw.trim() : "";
  return /^\p{L}{3,20}$/u.test(w) ? w : "Tandrix";
}

/** Listens for another name ("Hey Jarvis"), from now and after every restart. */
export function setWakeName(raw: unknown) {
  wakeName = cleanWakeName(raw);
  helper?.stdin.write(`${JSON.stringify({ name: wakeName })}\n`);
}
let wanted = false;
let retry: ReturnType<typeof setTimeout> | undefined;
/** Waiting for the print of a voice setup phrase. */
let sampleWaiter: ((r: SampleResult) => void) | undefined;

export type SampleResult = { print: number[]; voiced: number } | { print: null; reason: string };

function helperPath(): string {
  const packaged = join(process.resourcesPath ?? "", "native", "tandrix-wake");
  return existsSync(packaged) ? packaged : join(app.getAppPath(), "dist", "native", "tandrix-wake");
}

export interface WakeEvents {
  status(status: WakeStatus, message?: string): void;
  /**
   * The wake phrase was heard; `rest` is anything said after it in the same breath, `voice` the
   * voiceprint of the phrase when there was enough voice to tell.
   */
  wake(rest: string, voice?: number[]): void;
  /** The name was just heard (the continuous listener says so before the user pauses). */
  heard?(): void;
}

export function setWakeWord(on: boolean, events: WakeEvents) {
  wanted = on;
  clearTimeout(retry);
  if (!on) {
    helper?.stdin.end();
    helper?.kill();
    helper = undefined;
    events.status("off");
    return;
  }
  if (helper) return;
  events.status("starting");
  const child = spawn(helperPath(), [], { stdio: ["pipe", "pipe", "pipe"] });
  helper = child;
  let buffer = "";
  let failed = false;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      let msg: {
        ready?: boolean;
        heard?: boolean;
        wake?: boolean;
        rest?: unknown;
        voice?: unknown;
        sample?: unknown;
        voiced?: unknown;
        reason?: unknown;
        error?: unknown;
      };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (msg.ready) {
        child.stdin.write(`${JSON.stringify({ name: wakeName })}\n`);
        events.status("listening");
      }
      if (msg.heard === true) events.heard?.();
      if (msg.wake)
        events.wake(
          typeof msg.rest === "string" ? msg.rest.slice(0, 2000) : "",
          isPrint(msg.voice) ? msg.voice : undefined,
        );
      if ("sample" in msg && sampleWaiter) {
        const done = sampleWaiter;
        sampleWaiter = undefined;
        done(
          isPrint(msg.sample)
            ? { print: msg.sample, voiced: typeof msg.voiced === "number" ? msg.voiced : 0 }
            : { print: null, reason: typeof msg.reason === "string" ? msg.reason : "too_short" },
        );
      }
      if (typeof msg.error === "string") {
        failed = true;
        events.status("unavailable", reasons[msg.error] ?? "The wake word can't listen right now.");
      }
    }
  });
  // TANDRIX_WAKE_DEBUG=1 (development): what the recogniser heard, in this terminal only.
  if (process.env.TANDRIX_WAKE_DEBUG)
    child.stderr.on("data", (d: Buffer) => process.stderr.write(d));
  else child.stderr.resume();
  child.on("error", () => {
    failed = true;
    events.status("unavailable", "The wake word can't start on this Mac.");
  });
  child.on("exit", () => {
    if (helper === child) helper = undefined;
    // A crash while wanted: try again shortly. A reason it can't listen: stay off.
    if (wanted && !failed) retry = setTimeout(() => setWakeWord(true, events), 3000);
  });
}

/** Starts recording a voice setup phrase; false when the wake word isn't listening (it owns the mic). */
export function startSample(): boolean {
  if (!helper) return false;
  sampleWaiter?.({ print: null, reason: "restarted" });
  sampleWaiter = undefined;
  helper.stdin.write(`${JSON.stringify({ record: "start" })}\n`);
  return true;
}

/** Ends the phrase being recorded and gives its print. */
export function finishSample(): Promise<SampleResult> {
  const child = helper;
  if (!child) return Promise.resolve({ print: null, reason: "not_listening" });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sampleWaiter = undefined;
      resolve({ print: null, reason: "no_answer" });
    }, 4000);
    sampleWaiter = (r) => {
      clearTimeout(timer);
      resolve(r);
    };
    child.stdin.write(`${JSON.stringify({ record: "stop" })}\n`);
  });
}

export function stopWakeWord() {
  wanted = false;
  clearTimeout(retry);
  helper?.kill();
  helper = undefined;
}
