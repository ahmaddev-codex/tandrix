// The fallback voice on macOS, when Tandrix's own voice (from the API) can't be reached: `say`
// with a Premium or Enhanced system voice (@tandrix/core pickVoice), which Chromium's Web Speech
// may not list. No such voice installed: nothing is spoken (no robotic voices). The text goes in
// on stdin, never on a command line. One reply at a time.
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { pickVoice, type DeviceVoice } from "@tandrix/core";

const LANGUAGE = "en-US";
const MAX_CHARS = 2000;

/** One line of `say -v '?'`: "Ava (Premium)       en_US    # Hello! My name is Ava." */
export function parseSayVoices(out: string): DeviceVoice[] {
  const voices: DeviceVoice[] = [];
  for (const line of out.split("\n")) {
    const m = /^(.+?)\s+([a-z]{2,3}_[A-Za-z0-9]+)\s+#/.exec(line);
    if (m) voices.push({ id: m[1]!.trim(), name: m[1]!.trim(), lang: m[2]!.replace("_", "-") });
  }
  return voices;
}

let voice: Promise<string | null> | undefined;
/** The voice to speak with, chosen once; null when `say` isn't there. */
function chosenVoice(): Promise<string | null> {
  voice ??= new Promise((resolve) => {
    if (process.platform !== "darwin") return resolve(null);
    execFile("/usr/bin/say", ["-v", "?"], { timeout: 5000 }, (err, out) =>
      resolve(err ? null : (pickVoice(parseSayVoices(out), LANGUAGE)?.name ?? null)),
    );
  });
  return voice;
}

let current: ChildProcess | undefined;

export function stopSpeaking() {
  current?.kill();
  current = undefined;
}

/** Speaks the reply; false when there's no natural voice installed (the reply stays text only). */
export async function speak(text: string): Promise<boolean> {
  stopSpeaking();
  const name = await chosenVoice();
  if (!name) return false;
  const child = spawn("/usr/bin/say", ["-v", name], { stdio: ["pipe", "ignore", "ignore"] });
  current = child;
  child.on("exit", () => {
    if (current === child) current = undefined;
  });
  child.stdin.end(text.slice(0, MAX_CHARS));
  return true;
}

/** The voice in use, so the panel can suggest a better one when it's a compact default. */
export async function voiceName(): Promise<string | null> {
  return chosenVoice();
}
