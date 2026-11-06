/**
 * The reply latency bench (SP1): where the time goes between finishing an ask on the Mac and
 * hearing the answer. Each ask from fixtures/screens is spoken once in Tandrix's voice (kept in a
 * temporary folder), then sent as a real reply is: transcribe the audio, ask about the synthetic
 * screen, voice the answer. Client time and server time (Server-Timing) are both recorded, so the
 * network shows up as the difference. Real models: about a cent an ask.
 *   pnpm --filter @tandrix/api latency-bench            shows the plan and its cost
 *   pnpm --filter @tandrix/api latency-bench --go [--asks 10] [--save]
 * --save appends the results to docs/engineering/latency.md. --mac hears each ask on this Mac
 * (the desktop's tandrix-wake --hear, as the panel does) instead of the server: build the desktop
 * app's native helpers first. Start the API first.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { speechPieces } from "@tandrix/core";
import { readLedger } from "../src/spend";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const root = join(import.meta.dirname, "../../..");
const screensDir = join(root, "fixtures/screens");
const ledger = join(import.meta.dirname, "..", ".meta-spend.json");
const voices = join(tmpdir(), "tandrix-latency-bench");
/** What one ask costs, from the meter's history: a Spark call and a few seconds of transcription. */
const USD_PER_ASK = 0.01;

const args = process.argv.slice(2);
const go = args.includes("--go");
const save = args.includes("--save");
const onMac = args.includes("--mac");
const count = Number(args[args.indexOf("--asks") + 1]) || 10;

interface Screen {
  screen: string;
  file: string;
  width: number;
  height: number;
  targets: Array<{ id: string; ask: string }>;
}
const screens = JSON.parse(readFileSync(join(screensDir, "targets.json"), "utf8")) as Screen[];
/** Round the screens, one target each in turn, so every screen is in the run. */
const asks: Array<{ screen: Screen; ask: string }> = [];
for (let i = 0; asks.length < count && i < 50; i++)
  for (const s of screens) {
    const t = s.targets[i];
    if (t && asks.length < count) asks.push({ screen: s, ask: t.ask });
  }

console.log(
  `${asks.length} asks against ${api}${onMac ? ", heard on this Mac" : ""}, about $${(asks.length * USD_PER_ASK).toFixed(2)} in model calls.`,
);
if (!go) {
  console.log("Add --go to run it.");
  process.exit(0);
}

const auth = (await (
  await fetch(`${env("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ email: env("DEV_USER_EMAIL"), password: env("DEV_USER_PASSWORD") }),
  })
).json()) as { access_token: string };
const bearer = { authorization: `Bearer ${auth.access_token}` };

/** Client and server milliseconds for one request. */
async function timed(path: string, init: RequestInit) {
  const started = performance.now();
  const res = await fetch(`${api}${path}`, { ...init, headers: { ...bearer, ...init.headers } });
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : new Uint8Array(await res.arrayBuffer());
  const client = Math.round(performance.now() - started);
  const server = Number(/app;dur=(\d+)/.exec(res.headers.get("server-timing") ?? "")?.[1] ?? NaN);
  return { status: res.status, body, client, server };
}

/** Tandrix's voice saying the ask, made once and kept between runs. */
async function spoken(ask: string): Promise<Uint8Array> {
  mkdirSync(voices, { recursive: true });
  const file = join(voices, `${Buffer.from(ask).toString("base64url").slice(0, 80)}.wav`);
  if (existsSync(file)) return readFileSync(file);
  const r = await timed("/voice/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: ask }),
  });
  if (r.status !== 200) throw new Error(`Couldn't voice "${ask}": ${r.status}`);
  writeFileSync(file, r.body as Uint8Array);
  return r.body as Uint8Array;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
/** The share of the ask's words that the transcript has. */
const heardRight = (ask: string, transcript: string) => {
  const want = words(ask);
  const got = words(transcript);
  let n = 0;
  for (const w of want) if (got.has(w)) n++;
  return want.size ? n / want.size : 1;
};

/** The panel's on-device hearing: the ask streamed in at the pace it was said, then its text. */
function macHearer() {
  const bin = join(root, "apps/desktop/dist/native/tandrix-wake");
  if (!existsSync(bin)) throw new Error("Build the desktop app's native helpers first.");
  const child = spawn(bin, ["--hear"], { stdio: ["pipe", "pipe", "ignore"] });
  const waiting = new Map<number | "ready", (m: { text?: string }) => void>();
  let buf = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (c: string) => {
    buf += c;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const m = JSON.parse(buf.slice(0, i)) as { ready?: boolean; heard?: number; text?: string };
      buf = buf.slice(i + 1);
      if (m.ready) waiting.get("ready")?.(m);
      if (typeof m.heard === "number") waiting.get(m.heard)?.(m);
    }
  });
  const send = (o: unknown) => child.stdin.write(`${JSON.stringify(o)}\n`);
  const ready = new Promise((r) => waiting.set("ready", r));
  let id = 0;
  return {
    async hear(wav: Uint8Array) {
      await ready;
      const b = Buffer.from(wav);
      const rate = b.readUInt32LE(24);
      const data = b.subarray(44);
      const n = Math.floor(((data.length / 2) * 16000) / rate);
      const pcm = Buffer.alloc(n * 2);
      for (let i = 0; i < n; i++)
        pcm.writeInt16LE(data.readInt16LE(Math.floor((i * rate) / 16000) * 2), i * 2);
      const me = ++id;
      send({ begin: me, words: ["Tandrix", "Hey Tandrix", "Wake up Tandrix"] });
      for (let at = 0; at < pcm.length; at += 3200) {
        send({ audio: pcm.subarray(at, at + 3200).toString("base64") });
        await new Promise((r) => setTimeout(r, 100));
      }
      const started = performance.now();
      const got = new Promise<{ text?: string }>((r) => waiting.set(me, r));
      send({ end: me });
      const m = await got;
      return { text: m.text ?? "", client: Math.round(performance.now() - started) };
    },
    close: () => child.stdin.end(),
  };
}
const mac = onMac ? macHearer() : null;

type Stage = "transcribe" | "ask" | "voice";
const runs: Array<Record<Stage, { client: number; server: number }> & { heard: number }> = [];
const spentBefore = readLedger(ledger).totalUsd;

for (const { screen, ask } of asks) {
  const wav = await spoken(ask);
  let transcribe: { client: number; server: number };
  let transcript: string;
  if (mac) {
    const h = await mac.hear(wav);
    transcribe = { client: h.client, server: NaN };
    transcript = h.text || ask;
  } else {
    const form = new FormData();
    form.append("audio", new Blob([wav as BlobPart], { type: "audio/wav" }), "question.wav");
    form.append("keywords", JSON.stringify(["Tandrix", "Hey Tandrix", "Wake up Tandrix"]));
    const t = await timed("/voice/transcribe", { method: "POST", body: form });
    const tb = t.body as { status: string; transcript?: string };
    transcribe = t;
    transcript = tb.status === "heard" && tb.transcript ? tb.transcript : ask;
  }

  const asked = await timed("/screen/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      screenshot: {
        mimeType: "image/jpeg",
        data: readFileSync(join(screensDir, screen.file)).toString("base64"),
      },
      transcript,
      geometry: {
        displayId: "1",
        imageWidth: screen.width,
        imageHeight: screen.height,
        originX: 0,
        originY: 0,
        displayWidth: 1440,
        displayHeight: 900,
      },
      mode: "show",
      history: [],
    }),
  });
  const reply = (asked.body as { reply?: string; message?: string }).reply ?? "";

  // The first piece of the reply, as the apps voice it: what stands between the answer and the
  // first sound (the rest is made while it plays).
  const voice = reply
    ? await timed("/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: speechPieces(reply.slice(0, 600))[0] }),
      })
    : { client: NaN, server: NaN, status: 0, body: null };

  const row = {
    transcribe: { client: transcribe.client, server: transcribe.server },
    ask: { client: asked.client, server: asked.server },
    voice: { client: voice.client, server: voice.server },
    heard: heardRight(ask, transcript),
  };
  runs.push(row);
  console.log(
    `${screen.screen.padEnd(9)} transcribe ${String(row.transcribe.client).padStart(5)} ms · ask ${String(row.ask.client).padStart(5)} ms · voice ${String(row.voice.client).padStart(5)} ms · heard ${Math.round(row.heard * 100)}%  "${ask}"`,
  );
}

mac?.close();

const pick = (xs: number[], q: number) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]! : NaN;
};
const shown = (n: number) => (Number.isFinite(n) ? String(n) : "–");
const stat = (xs: number[]) => `${shown(pick(xs, 0.5))} | ${shown(pick(xs, 0.9))}`;
const totals = runs.map((r) => r.transcribe.client + r.ask.client + r.voice.client);
const spent = readLedger(ledger).totalUsd - spentBefore;
const table = [
  "| Stage | Client median | Client p90 | Server median | Server p90 |",
  "|---|---|---|---|---|",
  ...(["transcribe", "ask", "voice"] as Stage[]).map(
    (s) =>
      `| ${s} | ${stat(runs.map((r) => r[s].client))} | ${stat(runs.map((r) => r[s].server))} |`,
  ),
  `| **end of ask to first sound ready** | ${stat(totals)} | | |`,
].join("\n");
const summary = `${table}\n\nWords heard right: ${Math.round((runs.reduce((a, r) => a + r.heard, 0) / runs.length) * 100)}% on average. ${runs.length} asks, $${spent.toFixed(3)} in model calls. Times in milliseconds; the Mac's own stages (recording, screenshot, first sound) are in its \`reply_timing\` log lines.`;
console.log(`\n${summary}`);

if (save) {
  const doc = join(root, "docs/engineering/latency.md");
  if (!existsSync(doc))
    writeFileSync(
      doc,
      "# Reply latency\n\nResults of `pnpm --filter @tandrix/api latency-bench`, newest last. Each run times a spoken ask on the Mac against synthetic screens: transcription, the model's answer and Tandrix's voice.\n",
    );
  appendFileSync(
    doc,
    `\n## ${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${api}${onMac ? " · heard on the Mac" : ""}\n\n${summary}\n`,
  );
  console.log(`Saved to ${doc}.`);
}
