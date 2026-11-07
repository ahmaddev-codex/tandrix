/**
 * VO1 spike: runs each wake-word detector over the test streams (fixtures/wake, from
 * apps/api/scripts/wake-sets.ts) with `tandrix-wake --wake-eval`, and scores it: wakes caught,
 * false wakes per hour, and the delay from the end of the phrase to the wake. On this Mac only.
 *   pnpm --filter @tandrix/desktop exec tsx scripts/wake/score.ts [engine…] [--speed 4]
 * Engines: sf (today's), analyzer (SpeechTranscriber), kws (fixtures/wake/wake.mlmodelc).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentRule, soundAlikeRule } from "./match";

const root = join(import.meta.dirname, "../../../..");
const dir = join(root, "fixtures/wake");
const bin = join(root, "apps/desktop/dist/native/tandrix-wake");
const args = process.argv.slice(2);
const speedAt = args.indexOf("--speed");
const speed = speedAt >= 0 ? Number(args[speedAt + 1]) : 4;
const engines = args.filter((a, i) => !a.startsWith("--") && !(speedAt >= 0 && i === speedAt + 1));
const chosen = engines.length ? engines : ["sf", "analyzer", "kws"];
/** A wake this soon after a phrase starts, or up to this long after it ends, is that phrase's. */
const LATE = 2.5;
/** The classifier's score that counts as a wake, and how long it then waits before another. */
const THRESHOLDS = [0.5, 0.7, 0.8, 0.9, 0.95, 0.98];
const REFRACTORY = 2;

interface Label {
  phrase: string;
  start: number;
  end: number;
}
type Line = {
  wake?: boolean;
  score?: number;
  at?: number;
  done?: boolean;
  heard?: string;
  from?: number;
  final?: boolean;
};
/** --from-runs: score the saved runs (fixtures/wake/runs) again, without running anything. */
const fromRuns = args.includes("--from-runs");
const runsDir = join(dir, "runs");

function evalStream(
  file: string,
  engine: string,
): Promise<{ lines: Line[]; cpu: number; wall: number }> {
  const e = engine === "kws" ? `kws:${join(dir, "wake.mlmodelc")}` : engine;
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(bin, ["--wake-eval", file, e, String(speed)], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let buf = "";
    const lines: Line[] = [];
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      buf += c;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        try {
          lines.push(JSON.parse(buf.slice(0, i)) as Line);
        } catch {
          // ignore
        }
        buf = buf.slice(i + 1);
      }
    });
    // CPU time of the helper (and the child it relaunches as), from ps while it runs.
    let cpu = 0;
    const sample = setInterval(() => {
      const ps = spawn("ps", ["-A", "-o", "time=,command="]);
      let o = "";
      ps.stdout.on("data", (d) => (o += d));
      ps.on("close", () => {
        let t = 0;
        for (const l of o.split("\n"))
          if (l.includes("--wake-eval") && l.includes(file)) {
            const m = /(\d+):(\d+\.\d+)/.exec(l);
            if (m) t += Number(m[1]) * 60 + Number(m[2]);
          }
        cpu = Math.max(cpu, t);
      });
    }, 1000);
    child.on("error", reject);
    child.on("close", () => {
      clearInterval(sample);
      resolve({ lines, cpu, wall: Number(process.hrtime.bigint() - started) / 1e9 });
    });
  });
}

/** Wakes from a classifier's scores at a threshold: the first window over it, then a pause. */
function wakesAt(lines: Line[], threshold: number, inARow = 1): number[] {
  const out: number[] = [];
  let run = 0;
  for (const l of lines) {
    if (typeof l.score !== "number") continue;
    run = l.score >= threshold ? run + 1 : 0;
    if (run >= inARow && (out.at(-1) ?? -99) < l.at! - REFRACTORY) out.push(l.at!);
  }
  return out;
}

function score(wakes: number[], labels: Label[]) {
  const caught = new Set<number>();
  const delays: number[] = [];
  let falses = 0;
  let repeats = 0;
  for (const w of wakes) {
    const i = labels.findIndex((l, k) => !caught.has(k) && w >= l.start && w <= l.end + LATE);
    // The same phrase again (the recogniser revising what it heard) is a repeat, not a false wake.
    if (i < 0 && labels.some((l, k) => caught.has(k) && w >= l.start && w <= l.end + LATE + 2))
      repeats++;
    else if (i < 0) falses++;
    else {
      caught.add(i);
      delays.push(w - labels[i]!.end);
    }
  }
  delays.sort((a, b) => a - b);
  return {
    caught: caught.size,
    of: labels.length,
    falses,
    repeats,
    delay: delays[Math.floor(delays.length / 2)] ?? NaN,
  };
}

/** Wakes from what a recogniser heard, by a rule: once per stretch of speech, at the first hint. */
function wakesHeard(lines: Line[], rule: (heard: string) => boolean): number[] {
  const out: number[] = [];
  const done: number[] = [];
  for (const l of lines) {
    if (typeof l.heard !== "string" || !rule(l.heard)) continue;
    if (done.some((f) => Math.abs(f - l.from!) < 1)) continue;
    done.push(l.from!);
    out.push(l.at!);
  }
  return out;
}

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
const streamSeconds = (f: string) => (readFileSync(f).length - 44) / 2 / 16000;

const rows: string[] = [];
for (const engine of chosen) {
  if (engine === "kws" && !existsSync(join(dir, "wake.mlmodelc"))) {
    console.log("kws: train it first (scripts/wake/train.swift)");
    continue;
  }
  const res: Record<string, { lines: Line[]; cpu: number; wall: number }> = {};
  for (const s of ["quiet", "talk", "negatives"]) {
    const saved = join(runsDir, `${engine}-${s}.json`);
    if (fromRuns && existsSync(saved)) {
      res[s] = JSON.parse(readFileSync(saved, "utf8")) as (typeof res)[string];
      continue;
    }
    res[s] = await evalStream(join(dir, `${s}.wav`), engine);
    mkdirSync(runsDir, { recursive: true });
    writeFileSync(saved, JSON.stringify(res[s]));
    console.log(`${engine} ${s}: ${res[s]!.lines.length} lines in ${Math.round(res[s]!.wall)} s`);
  }
  // A phrase `say` failed to voice (now and then it writes an empty file) can't be heard by any.
  const all = JSON.parse(readFileSync(join(dir, "quiet.json"), "utf8")) as Label[];
  const quietL = all.filter((l) => l.end - l.start >= 0.4);
  if (quietL.length < all.length)
    console.log(`  (${all.length - quietL.length} empty phrases left out)`);
  const hours = streamSeconds(join(dir, "negatives.wav")) / 3600;
  const audio = streamSeconds(join(dir, "quiet.wav"));
  // CPU per second of audio, as a share of one core in real time.
  const cpu = `${((res.quiet!.cpu / audio) * 100).toFixed(1)}%`;
  type Setting = { label: string; wakes: (lines: Line[]) => number[] };
  const settings: Setting[] =
    engine === "kws"
      ? THRESHOLDS.flatMap((th) => [
          { label: `kws ≥ ${th}`, wakes: (l: Line[]) => wakesAt(l, th) },
          { label: `kws ≥ ${th}, two windows`, wakes: (l: Line[]) => wakesAt(l, th, 2) },
        ])
      : engine === "analyzer"
        ? [
            { label: "analyzer, today's spellings", wakes: (l) => wakesHeard(l, currentRule) },
            {
              label: "analyzer, sound-alike ±1",
              wakes: (l) => wakesHeard(l, (h) => soundAlikeRule(h, 1)),
            },
            {
              label: "analyzer, sound-alike ±2 (chosen)",
              wakes: (l) => wakesHeard(l, (h) => soundAlikeRule(h, 2)),
            },
          ]
        : engine === "sflm"
          ? [
              {
                label: "sflm, today's spellings",
                wakes: (l) => l.filter((x) => x.wake).map((x) => x.at!),
              },
              {
                label: "sflm, sound-alike ±2",
                wakes: (l) => wakesHeard(l, (h) => soundAlikeRule(h, 2)),
              },
            ]
          : [{ label: engine, wakes: (l) => l.filter((x) => x.wake).map((x) => x.at!) }];
  for (const { label, wakes } of settings) {
    const w = (s: string) => wakes(res[s]!.lines);
    const q = score(w("quiet"), quietL);
    const t = score(w("talk"), quietL);
    const n = w("negatives").length;
    rows.push(
      `| ${label} | ${q.caught}/${q.of} (${pct(q.caught, q.of)}) | ${t.caught}/${t.of} (${pct(t.caught, t.of)}) | ${((n + q.falses + t.falses) / (hours + (2 * audio) / 3600)).toFixed(1)} | ${q.delay.toFixed(2)} s | ${cpu} |`,
    );
  }
}
console.log(
  `\n| Detector | Caught, quiet | Caught, background talk | False wakes per hour | Delay after the phrase (median) | CPU (one core) |\n|---|---|---|---|---|---|\n${rows.join("\n")}`,
);
