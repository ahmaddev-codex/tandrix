/**
 * The wake word through the air: wake phrases and near misses played on this Mac's speakers, in
 * Kokoro's voices and the Mac's own, and heard through its microphone by the real wake listener
 * (apps/desktop/dist/native/tandrix-wake). Scores what woke it and how fast. Recognition is on the
 * device; nothing is sent anywhere. Quit the Tandrix app first, or it will answer the phrases too.
 *   pnpm --filter @tandrix/api exec tsx scripts/wake-live.ts [--quick]
 */
import { execFile, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pcm16Wav } from "../src/speech";

const run = promisify(execFile);
const root = join(import.meta.dirname, "../../..");
const bin = join(root, "apps/desktop/dist/native/tandrix-wake");
const dir = join(tmpdir(), "tandrix-wake-live");
mkdirSync(dir, { recursive: true });
const quick = process.argv.includes("--quick");

const KOKORO = quick
  ? ["af_heart", "bm_george"]
  : ["af_heart", "am_adam", "bf_emma", "bm_george", "af_bella", "am_michael"];
const SAY = quick
  ? ["Samantha", "Daniel"]
  : ["Samantha", "Daniel", "Karen", "Moira", "Rishi", "Tessa"];
const WAKES = ["Hey Tandrix", "Tandrix", "Wake up Tandrix", "Hey Tandrix, open Mail."];
const MISSES = [
  "Hey Hendrix, can you pass the salt?",
  "My brother Hendricks is coming over.",
  "Wake up Tom, the taxi is here.",
  "Let's order pizza tonight.",
  "That was a neat hand trick.",
  "Hey Siri, set a timer.",
  "He threw a tantrum in the shop.",
  "Okay, see you tomorrow.",
];

type Kokoro = {
  generate(
    t: string,
    o: { voice: string },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
};
const kokoro = (async () => {
  const { KokoroTTS } = await import("kokoro-js");
  return (await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "cpu",
  })) as unknown as Kokoro;
})();

let n = 0;
async function clip(voice: string, text: string): Promise<string> {
  const f = join(dir, `${n++}.wav`);
  if (SAY.includes(voice))
    await run("say", [
      "-v",
      voice,
      "-o",
      f,
      "--file-format=WAVE",
      "--data-format=LEI16@22050",
      text,
    ]);
  else {
    const a = await (await kokoro).generate(text, { voice });
    writeFileSync(f, pcm16Wav(a.audio, a.sampling_rate));
  }
  return f;
}

interface Item {
  voice: string;
  text: string;
  wake: boolean;
  file: string;
}
const items: Item[] = [];
for (const voice of [...KOKORO, ...SAY])
  for (const text of WAKES) items.push({ voice, text, wake: true, file: "" });
MISSES.forEach((text, i) =>
  items.push({
    voice: [...KOKORO, ...SAY][i % (KOKORO.length + SAY.length)]!,
    text,
    wake: false,
    file: "",
  }),
);
// Shuffled the same way every time, so wakes and misses mix.
let seed = 7;
items.sort(() => (seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5);
console.log(`Making ${items.length} clips…`);
for (const it of items) it.file = await clip(it.voice, it.text);

const events: Array<{ at: number; kind: "heard" | "wake"; rest?: string }> = [];
// What the recogniser heard, timestamped, to show beside each miss.
const heardLines: Array<{ at: number; text: string }> = [];
const helper = spawn(bin, [], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, TANDRIX_WAKE_DEBUG: "1" },
});
let errBuf = "";
helper.stderr.setEncoding("utf8");
helper.stderr.on("data", (c: string) => {
  errBuf += c;
  let i: number;
  while ((i = errBuf.indexOf("\n")) >= 0) {
    const line = errBuf.slice(0, i);
    errBuf = errBuf.slice(i + 1);
    if (line.startsWith("heard:")) heardLines.push({ at: Date.now(), text: line.slice(6).trim() });
    else if (line.startsWith("mic restart")) console.log(`  (${line})`);
  }
});
let ready!: () => void;
const isReady = new Promise<void>((r) => (ready = r));
let buf = "";
helper.stdout.setEncoding("utf8");
helper.stdout.on("data", (c: string) => {
  buf += c;
  let i: number;
  while ((i = buf.indexOf("\n")) >= 0) {
    const m = JSON.parse(buf.slice(0, i)) as {
      ready?: boolean;
      heard?: boolean;
      wake?: boolean;
      rest?: string;
      error?: string;
    };
    buf = buf.slice(i + 1);
    if (m.ready) ready();
    if (m.error) throw new Error(`wake listener: ${m.error}`);
    if (m.heard) events.push({ at: Date.now(), kind: "heard" });
    if (m.wake) events.push({ at: Date.now(), kind: "wake", rest: m.rest });
  }
});
await isReady;
await new Promise((r) => setTimeout(r, 2000));
console.log("Playing…");

const rows: Array<Item & { start: number; end: number }> = [];
for (const it of items) {
  const start = Date.now();
  await run("afplay", [it.file]);
  const end = Date.now();
  rows.push({ ...it, start, end });
  // Time for the wake (it waits for the phrase's final result) before the next clip.
  await new Promise((r) => setTimeout(r, 4000));
}
helper.stdin.end();
helper.kill();

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};
let caught = 0;
let falses = 0;
const heardDelay: number[] = [];
const wakeDelay: number[] = [];
for (const r of rows) {
  const within = events.filter((e) => e.at >= r.start && e.at <= r.end + 3800);
  const woke = within.find((e) => e.kind === "wake");
  const heard = within.find((e) => e.kind === "heard");
  if (r.wake && woke) {
    caught++;
    wakeDelay.push(woke.at - r.end);
    if (heard) heardDelay.push(heard.at - r.end);
  }
  if (!r.wake && woke) falses++;
  if (r.wake && !woke) {
    const seen = [
      ...new Set(
        heardLines.filter((h) => h.at >= r.start - 500 && h.at <= r.end + 3800).map((h) => h.text),
      ),
    ];
    console.log(`    heard: ${seen.slice(-3).join(" | ") || "(nothing)"}`);
  }
  console.log(
    `${r.wake ? (woke ? "CAUGHT " : "MISSED ") : woke ? "FALSE  " : "quiet  "} ${r.voice.padEnd(10)} "${r.text}"${woke ? `  wake +${woke.at - r.end} ms${woke.rest ? ` rest "${woke.rest}"` : ""}` : ""}${heard ? `  heard +${heard.at - r.end} ms` : ""}`,
  );
}
const wakes = rows.filter((r) => r.wake).length;
console.log(
  `\nCaught ${caught} of ${wakes} (${Math.round((caught / wakes) * 100)}%); woke on ${falses} of ${rows.length - wakes} near misses. From the end of the phrase: "heard" median ${median(heardDelay)} ms, wake median ${median(wakeDelay)} ms.`,
);
for (const text of WAKES) {
  const of = rows.filter((r) => r.text === text);
  const got = of.filter((r) =>
    events.some((e) => e.kind === "wake" && e.at >= r.start && e.at <= r.end + 3800),
  );
  console.log(`  "${text}": ${got.length}/${of.length}`);
}
