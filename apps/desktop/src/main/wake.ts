// The wake word ("Hey Tandrix", "Wake up Tandrix"), heard on this Mac only. The tandrix-wake
// helper (native/wake/main.swift) uses Apple's on-device speech recognition; no audio or text
// leaves the Mac until the user has said Tandrix's name, and then only what they asked. It runs
// only while the user has the wake word switched on.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

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
let wanted = false;
let retry: ReturnType<typeof setTimeout> | undefined;

function helperPath(): string {
  const packaged = join(process.resourcesPath ?? "", "native", "tandrix-wake");
  return existsSync(packaged) ? packaged : join(app.getAppPath(), "dist", "native", "tandrix-wake");
}

export interface WakeEvents {
  status(status: WakeStatus, message?: string): void;
  /** The wake phrase was heard; `rest` is anything said after it in the same breath. */
  wake(rest: string): void;
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
      let msg: { ready?: boolean; wake?: boolean; rest?: unknown; error?: unknown };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (msg.ready) events.status("listening");
      if (msg.wake) events.wake(typeof msg.rest === "string" ? msg.rest.slice(0, 2000) : "");
      if (typeof msg.error === "string") {
        failed = true;
        events.status("unavailable", reasons[msg.error] ?? "The wake word can't listen right now.");
      }
    }
  });
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

export function stopWakeWord() {
  wanted = false;
  clearTimeout(retry);
  helper?.kill();
  helper = undefined;
}
