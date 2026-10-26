/**
 * T0.1 smoke test: one live call to each Meta model Tandrix uses, with latency and token usage.
 *   pnpm smoke:meta
 * Reads META_* from .env. Generates its own test image and audio; sends nothing else.
 */
import { deflateSync } from "node:zlib";
import { z } from "zod";
import { join } from "node:path";
import { fileSpendMeter, readLedger } from "../apps/api/src/spend";
import {
  MetaClient,
  setSpendMeter,
  generateStructured,
  imageData,
  loadMetaConfig,
  segment,
  text,
  user,
} from "@tandrix/ai";

const cfg = loadMetaConfig();
// Charged to the same local ledger and cap as the API (pnpm --filter @tandrix/api spend).
const ledgerPath = join(import.meta.dirname, "..", "apps/api/.meta-spend.json");
const spentBefore = readLedger(ledgerPath).totalUsd;
setSpendMeter(
  fileSpendMeter(ledgerPath, Number(process.env.META_SPEND_LIMIT_USD ?? 10), () => undefined),
);
const client = new MetaClient({
  apiKey: cfg.apiKey,
  baseUrl: cfg.baseUrl,
  timeoutMs: cfg.timeoutMs,
});

// 320x240 white PNG with a red square at (100,60)-(220,180).
function testPng(): Uint8Array {
  const w = 320;
  const h = 240;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const inSquare = x >= 100 && x < 220 && y >= 60 && y < 180;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = 255;
      raw[o + 1] = inSquare ? 0 : 255;
      raw[o + 2] = inSquare ? 0 : 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// One second of silence: mono 16-bit PCM at 16 kHz.
function testWav(): Blob {
  const samples = 16_000;
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16_000, 24);
  b.writeUInt32LE(32_000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  return new Blob([b], { type: "audio/wav" });
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t = performance.now();
  try {
    const r = await fn();
    console.log(`✓ ${name} (${Math.round(performance.now() - t)} ms)`);
    return r;
  } catch (e) {
    console.log(`✗ ${name} (${Math.round(performance.now() - t)} ms): ${(e as Error).message}`);
    process.exitCode = 1;
    return undefined;
  }
}

const png = imageData(testPng(), "image/png");

console.log(`Base URL ${cfg.baseUrl}\n`);

// Rate-limit headers come from a raw call; the client doesn't surface headers.
await timed(`${cfg.models.reasoning}: text`, async () => {
  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.models.reasoning,
      input: "Reply with the single word: ready",
      store: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { usage?: unknown };
  const limits = [...res.headers].filter(([k]) => /ratelimit|retry-after/i.test(k));
  console.log("  usage", JSON.stringify(body.usage));
  console.log("  rate-limit headers", limits.length ? Object.fromEntries(limits) : "(none)");
});

await timed(`${cfg.models.reasoning}: image + structured output`, async () => {
  const r = await generateStructured(client, {
    model: cfg.models.reasoning,
    name: "shape",
    schema: z.strictObject({ colour: z.string(), shape: z.string() }),
    instructions: "Describe the single shape in the image.",
    input: [user(text("What colour and shape is the object?"), png)],
    effort: "low",
  });
  if (!r.ok) throw new Error(`invalid output: ${r.issues.join("; ")}`);
  console.log(
    "  output",
    JSON.stringify(r.data),
    r.repaired ? "(repaired)" : "",
    "usage",
    JSON.stringify(r.usage),
  );
});

await timed(`${cfg.models.segmentation}: "red square"`, async () => {
  const r = await segment(client, {
    model: cfg.models.segmentation,
    image: png,
    concept: "red square",
  });
  console.log(
    "  segments",
    JSON.stringify(r.segments.map((s) => ({ id: s.objectId, box: s.box, c: s.confidence }))),
  );
  console.log("  expected box ≈ { x: 100, y: 60, w: 120, h: 120 }");
  if (r.warnings.length) console.log("  warnings", r.warnings);
});

await timed(`${cfg.models.transcribe}: 1 s of silence`, async () => {
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "PUSH_TO_TALK",
          model: cfg.models.transcribe,
          audioEncoding: "WAV",
        }),
      ],
      {
        type: "application/json",
      },
    ),
  );
  form.append("audio", testWav(), "silence.wav");
  const res = await fetch(`${cfg.baseUrl}/asr/transcribe?sessionId=tandrix-smoke-${Date.now()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { transcript?: string; audioDurationMs?: number };
  console.log(
    "  transcript",
    JSON.stringify(body.transcript ?? ""),
    "duration",
    body.audioDurationMs,
    "ms",
  );
});

console.log(
  `\nThis run cost $${(readLedger(ledgerPath).totalUsd - spentBefore).toFixed(4)} (SAM and Spark; the raw transcription call is billed by audio length).`,
);
console.log(
  process.exitCode
    ? "\nSome checks failed. Record the output in docs/engineering/spikes.md."
    : "\nAll models reachable. Record the output in docs/engineering/spikes.md.",
);
