/**
 * The wake-word test sets (VO1): synthetic, reproducible audio to measure misses and false wakes.
 * Voices: the Mac's natural English voices (`say`) and Kokoro's, at several speeds. Eight voices are
 * held out: the test streams use only them; the rest are for training a detector.
 *   pnpm --filter @tandrix/api exec tsx scripts/wake-sets.ts
 * Writes fixtures/wake/ (ignored by git; this script rebuilds it, same seed, same sets):
 *   train/pos/*.wav, train/neg/*.wav      clips for training (training voices only)
 *   quiet.wav + quiet.json                test voices saying the wake phrases among ordinary speech
 *   talk.wav + talk.json                  the same over background talk (four voices mixed, ~8 dB down)
 *   negatives.wav                         ~45 minutes of ordinary speech, no wake phrase, for false wakes
 * With --train-more, only a bigger training set for a wake-phrase classifier, training voices only:
 *   train2/wake/*.wav   the phrases at five speeds, also over background talk, at random offsets
 *   train2/other/*.wav  1.5 s slices of ordinary speech, near misses, background talk and silence
 * No model calls, nothing leaves the Mac.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(import.meta.dirname, "../../..");
const out = join(root, "fixtures/wake");
const RATE = 16_000;

/** A small seeded random, so the sets are the same every time. */
let seed = 20261106;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const SAY_TRAIN = [
  "Samantha",
  "Daniel",
  "Rishi",
  "Aman",
  "Kathy",
  "Fred",
  "Ralph",
  "Albert",
  "Junior",
  "Eddy (English (US))",
  "Flo (English (UK))",
  "Reed (English (UK))",
  "Sandy (English (US))",
  "Shelley (English (UK))",
  "Grandma (English (US))",
];
const SAY_TEST = [
  "Karen",
  "Moira",
  "Tessa",
  "Tara",
  "Grandpa (English (UK))",
  "Rocko (English (US))",
];
const KOKORO_TRAIN = ["af_heart", "af_bella", "am_adam", "bf_emma", "bm_george", "af_nicole"];
const KOKORO_TEST = ["bm_lewis", "am_michael"];

export const WAKE_PHRASES = [
  "Hey Tandrix",
  "Wake up Tandrix",
  "Hey Tandrix, what's on my calendar today?",
  "Wake up Tandrix, open Mail.",
];

/** Ordinary speech, with near misses ("Hey Hendrix") that must not wake it. */
const SENTENCES = [
  "Hey Hendrix, can you pass me the salt?",
  "That was a great hand trick.",
  "He threw a tantrum in the shop.",
  "Ten tricks for a cleaner kitchen.",
  "Hey Siri, set a timer for ten minutes.",
  "Wake up, honey, it's nearly eight.",
  "Sandra fixed the trendy sandbox.",
  "I bought a new Tandy radio at the market.",
  "Hey there, how was your day?",
  "Okay Google, what's the weather like?",
  "Alexa, play the news.",
  "Can you hand me the tricks book?",
  "The tandem bike needs new tyres.",
  "Let's meet at the candle shop on Friday.",
  "Hey, Andrew, wake up, we're here.",
  "The trend this year is tan and green.",
  "My brother Hendricks is coming over.",
  "Did you see the ten new tracks on the album?",
  "I need to send the invoice before lunch.",
  "Could you open the window? It's warm in here.",
  "The meeting moved to three o'clock tomorrow.",
  "Remember to water the plants on Sunday.",
  "What time does the train leave?",
  "I think the printer is out of paper again.",
  "Let's order pizza tonight.",
  "The kids have football practice at five.",
  "Have you finished the report yet?",
  "Turn the music down a little, please.",
  "My phone battery is almost empty.",
  "We should book the flights soon.",
  "The doctor said to rest for a week.",
  "Can you pick up some milk on the way home?",
  "I left my keys on the kitchen table.",
  "The new episode comes out on Thursday.",
  "Traffic was terrible this morning.",
  "Please send me the slides after the call.",
  "The coffee machine is making a strange noise.",
  "Let's go for a walk after dinner.",
  "I can't find the charger anywhere.",
  "She's starting a new job next month.",
  "The garden looks lovely this time of year.",
  "Do you want tea or coffee?",
  "We need to update the budget spreadsheet.",
  "The password reset email never arrived.",
  "I'll call you back in five minutes.",
  "Can you share your screen?",
  "You're on mute.",
  "Next slide, please.",
  "Let's take a ten minute break.",
  "Who's taking notes today?",
  "The deadline is the end of the week.",
  "I'm running a few minutes late.",
  "Let me check my calendar.",
  "Open the pod bay doors.",
  "The weather forecast says rain all weekend.",
  "Can you help me with my homework?",
  "Dinner is ready, come and eat.",
  "The dog needs to go out.",
  "I'm going to the gym after work.",
  "Have you seen my glasses?",
  "We're out of bread and eggs.",
  "The plumber is coming on Tuesday.",
  "That film was much better than I expected.",
  "Let's play a board game tonight.",
  "Can you turn the lights off upstairs?",
  "The parcel was left with a neighbour.",
  "I'm thinking of learning Spanish.",
  "My sister lives in Manchester now.",
  "The car needs an oil change.",
  "Please close the door behind you.",
  "It's my turn to cook tomorrow.",
  "The bus was twenty minutes late.",
  "Do you know a good dentist?",
  "I'll be working from home on Friday.",
  "The shop closes at six on Sundays.",
  "Can we move the call to the afternoon?",
  "I've got a headache, I'm going to lie down.",
  "The baby finally fell asleep.",
  "Let's paint the spare room blue.",
  "Have a good weekend, see you Monday.",
  "Grab a jacket, it's cold out.",
  "The quarterly numbers look strong.",
  "Ask the team if anyone is free on Wednesday.",
  "Our flight lands at half past nine.",
  "The tickets sold out in minutes.",
  "Put the chicken in the oven at seven.",
  "The Wi-Fi keeps dropping in the bedroom.",
  "I'll send you the address.",
  "Could you repeat that, please?",
  "What do you want for your birthday?",
  "The concert starts at eight.",
  "He's been training for the marathon.",
  "Let's rename the folder to archive.",
  "The new update broke my email settings.",
  "Text me when you get there.",
  "Could you read that back to me?",
  "We're having friends over on Saturday.",
  "The washing machine finished an hour ago.",
  "The library books are due back today.",
  "I'm not sure that's the right answer.",
  "Hey, can you hear me now?",
  "Wake me up at seven tomorrow.",
  "Tandoori chicken sounds good for dinner.",
  "The band played until midnight.",
  "Trixie the cat is asleep on the sofa.",
  "Handrails were installed on the stairs.",
  "Hey Trent, did you get my message?",
  "That's a neat trick with the sandwich.",
  "They chanted and danced all night.",
  "Wake up and smell the coffee.",
  "Say hi to your mum for me.",
  "The candidate answered every question well.",
  "Matrix multiplication is on the exam.",
  "Hendrix played the guitar upside down.",
  "Tantric music was playing in the spa.",
  "We drank tonic water with lime.",
  "My friend Patrick is a dentist.",
  "Hey, can you tidy your room?",
  "Wake up Tom, the taxi is outside.",
  "Hey Dad, can I borrow the car?",
  "Fantastic, thanks for letting me know.",
  "The tennis match went to five sets.",
  "Ten to six is when the shop shuts.",
  "Sandra and Rick are getting married.",
  "Hey Tanya, nice to see you.",
  "Wake up Sandy, we're going to be late.",
  "The tango class starts next week.",
  "Can you pause the video for a second?",
];

/** Mono 16-bit PCM WAV at RATE. */
function wav(samples: Int16Array): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength).copy(b, 44);
  return b;
}

/** The samples of a 16 kHz mono 16-bit WAV (the "data" chunk, wherever it is). */
function samplesOf(file: Buffer): Int16Array {
  let at = 12;
  while (at < file.length - 8) {
    const id = file.toString("ascii", at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (id === "data")
      return new Int16Array(
        file.buffer.slice(file.byteOffset + at + 8, file.byteOffset + at + 8 + size),
      );
    at += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

const tmp = join(tmpdir(), "tandrix-wake-sets");

async function sayClip(voice: string, rate: number, text: string): Promise<Int16Array> {
  const f = join(tmp, `${Math.floor(rand() * 1e12)}.wav`);
  await run("say", [
    "-v",
    voice,
    "-r",
    String(rate),
    "--file-format=WAVE",
    "--data-format=LEI16@16000",
    "-o",
    f,
    text,
  ]);
  const s = samplesOf(readFileSync(f));
  rmSync(f);
  return s;
}

type Kokoro = {
  generate(
    t: string,
    o: { voice: string; speed?: number },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
};
let kokoro: Promise<Kokoro> | undefined;
async function kokoroClip(voice: string, speed: number, text: string): Promise<Int16Array> {
  kokoro ??= import("kokoro-js").then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "cpu",
    }),
  ) as Promise<Kokoro>;
  const r = await (await kokoro).generate(text, { voice, speed });
  // To 16 kHz, linearly.
  const n = Math.floor((r.audio.length * RATE) / r.sampling_rate);
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i * r.sampling_rate) / RATE;
    const j = Math.floor(p);
    const x = (r.audio[j] ?? 0) + ((r.audio[j + 1] ?? 0) - (r.audio[j] ?? 0)) * (p - j);
    s[i] = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  }
  return s;
}

interface Voice {
  name: string;
  kind: "say" | "kokoro";
}
const voices = (say: string[], k: string[]): Voice[] => [
  ...say.map((name) => ({ name, kind: "say" as const })),
  ...k.map((name) => ({ name, kind: "kokoro" as const })),
];
const TRAIN = voices(SAY_TRAIN, KOKORO_TRAIN);
const TEST = voices(SAY_TEST, KOKORO_TEST);

/** One clip at a speed: say's words per minute, or Kokoro's speed. */
const clip = (v: Voice, pace: number, text: string) =>
  v.kind === "say" ? sayClip(v.name, Math.round(175 * pace), text) : kokoroClip(v.name, pace, text);

/** Runs at most `n` at a time, in order. */
async function limited<T>(items: Array<() => Promise<T>>, n: number): Promise<T[]> {
  const res: T[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        res[i] = await items[i]!();
      }
    }),
  );
  return res;
}

const silence = (seconds: number) => new Int16Array(Math.round(seconds * RATE));
const join16 = (parts: Int16Array[]) => {
  const all = new Int16Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
};
/** Mixes `under` beneath `over`, `db` quieter, looping it. */
function mix(over: Int16Array, under: Int16Array, db: number): Int16Array {
  const g = 10 ** (-db / 20);
  const out = new Int16Array(over.length);
  for (let i = 0; i < over.length; i++)
    out[i] = Math.max(-32768, Math.min(32767, over[i]! + Math.round(under[i % under.length]! * g)));
  return out;
}

/** 1.5 s windows, the classifier's size. */
const WINDOW = Math.round(1.5 * RATE);
/** A clip placed in a window at a random offset (or its middle, when longer than the window). */
function inWindow(s: Int16Array, length = WINDOW + RATE): Int16Array {
  const out = new Int16Array(Math.max(length, s.length));
  out.set(s, Math.floor(rand() * Math.max(0, out.length - s.length)));
  return out;
}

const NEAR_MISSES = [
  "Hey Hendrix",
  "Wake up Tom",
  "Hey Trent",
  "Hey Tanya",
  "Wake up honey",
  "Hey Sandra",
  "Hey Patrick",
  "Hey Siri",
  "Hey Kendrick",
  "Wake up Andrew",
  "Hey Dad",
  "Hey Adrian",
  "Hand tricks",
  "Ten tricks",
  "Tantrum",
  "Hey there",
  "Okay Google",
  "Wake up, it's ten",
];

/**
 * --model-set: clips for the dedicated wake-word model (apps/desktop/scripts/wake/model), every
 * English voice except the eight held out for testing. Written whole, unmixed; the trainer adds
 * the noise, room and level. Each wake clip ends as "Tandrix" ends, where the model must fire.
 *   model/pos/*.wav     the name, alone and after a lead ("Hey", "Okay", "Wake up"…)
 *   model/near/*.wav    words that sound close ("Hendrix", "tantrum", "hand tricks")
 *   model/speech/*.wav  ordinary sentences
 */
const MODEL_SAY = [
  ...SAY_TRAIN,
  "Flo (English (US))",
  "Eddy (English (UK))",
  "Reed (English (US))",
  "Sandy (English (UK))",
  "Shelley (English (US))",
  "Grandma (English (UK))",
  "Aman (English (India))",
  "Whisper",
];
const MODEL_KOKORO = [
  "af_alloy",
  "af_aoede",
  "af_bella",
  "af_heart",
  "af_jessica",
  "af_kore",
  "af_nicole",
  "af_nova",
  "af_river",
  "af_sarah",
  "af_sky",
  "am_adam",
  "am_echo",
  "am_eric",
  "am_fenrir",
  "am_liam",
  "am_onyx",
  "am_puck",
  "am_santa",
  "bf_alice",
  "bf_emma",
  "bf_isabella",
  "bf_lily",
  "bm_daniel",
  "bm_fable",
  "bm_george",
].filter((v) => !KOKORO_TEST.includes(v));
const MODEL_WAKES = [
  "Tandrix",
  "Tandrix.",
  "Tandrix?",
  "Hey Tandrix",
  "Hey, Tandrix.",
  "Hi Tandrix",
  "Okay Tandrix",
  "Wake up Tandrix",
  "Hey Tandrix!",
];
const MODEL_NEAR = [
  ...NEAR_MISSES,
  "Hendrix",
  "Tandy",
  "Tantrum",
  "Sandra",
  "Andrex",
  "Kendrick",
  "Cedric",
  "Patrick",
  "Tenderness",
  "Hey Tandy",
  "Hey Sandra",
  "Hey Rick",
  "Hey Hendricks",
  "Hand drills",
  "Ten drinks",
  "Tan trucks",
  "Matrix",
  "Hey Trixie",
  "Wake up Patrick",
  "Okay then",
  "Tundra",
  "Tandem",
  "Fantastic",
];

async function modelSet() {
  const dir = join(out, "model");
  rmSync(dir, { recursive: true, force: true });
  for (const d of ["pos", "near", "speech"]) mkdirSync(join(dir, d), { recursive: true });
  mkdirSync(tmp, { recursive: true });
  const all = voices(MODEL_SAY, MODEL_KOKORO);
  const paces = [0.8, 1, 1.2];
  const write = async (label: string, jobs: Array<{ v: Voice; pace: number; text: string }>) => {
    let n = 0;
    await limited(
      jobs.map((j) => async () => {
        const s = await clip(j.v, j.pace, j.text);
        if (s.length < RATE * 0.25) return;
        const name = `${j.v.name.replace(/\W+/g, "_")}-${j.pace}-${n++}.wav`;
        writeFileSync(join(dir, label, name), wav(s));
      }),
      8,
    );
    console.log(label, n);
  };
  await write(
    "pos",
    all.flatMap((v) => MODEL_WAKES.flatMap((text) => paces.map((pace) => ({ v, pace, text })))),
  );
  await write(
    "near",
    all.flatMap((v) => MODEL_NEAR.map((text) => ({ v, pace: pick(paces), text }))),
  );
  await write(
    "speech",
    all.flatMap((v) =>
      Array.from({ length: 24 }, () => ({ v, pace: pick(paces), text: pick(SENTENCES) })),
    ),
  );
}

async function trainMore() {
  const dir = join(out, "train2");
  rmSync(dir, { recursive: true, force: true });
  for (const d of ["wake", "other"]) mkdirSync(join(dir, d), { recursive: true });
  mkdirSync(tmp, { recursive: true });
  const paces = [0.8, 0.9, 1, 1.15, 1.3];
  const wake = (
    await limited(
      TRAIN.flatMap((v) =>
        WAKE_PHRASES.slice(0, 2).flatMap((p) => paces.map((pace) => () => clip(v, pace, p))),
      ),
      8,
    )
  ).filter((s) => s.length > RATE * 0.4);
  // Background talk from training voices only.
  const talk = await limited(
    Array.from({ length: 60 }, () => () => clip(pick(TRAIN), pick(paces), pick(SENTENCES))),
    8,
  );
  const babble = new Int16Array(RATE * 120);
  for (let k = 0; k < 4; k++) {
    const seq = join16(Array.from({ length: 30 }, () => pick(talk)));
    for (let i = 0; i < babble.length; i++)
      babble[i] = Math.max(
        -32768,
        Math.min(32767, babble[i]! + Math.round(seq[(i + k * 7919) % seq.length]! / 2)),
      );
  }
  const under = (s: Int16Array, db: number) => {
    const at = Math.floor(rand() * (babble.length - s.length));
    return mix(s, babble.subarray(at, at + s.length), db);
  };
  let n = 0;
  const put = (label: string, s: Int16Array) =>
    writeFileSync(join(dir, label, `${n++}.wav`), wav(s));
  for (const s of wake) {
    put("wake", inWindow(s));
    put("wake", under(inWindow(s), 15));
    put("wake", under(inWindow(s), 8));
  }
  // Ordinary speech in 1.5 s slices, near misses whole, talk alone, quiet.
  const speech = await limited(
    Array.from({ length: 700 }, () => () => clip(pick(TRAIN), pick(paces), pick(SENTENCES))),
    8,
  );
  const stream = join16(speech.flatMap((s) => [s, silence(0.2 + rand() * 0.5)]));
  for (let at = 0; at + WINDOW <= stream.length; at += RATE) {
    const w = stream.slice(at, at + WINDOW);
    put("other", rand() < 0.3 ? under(w, 10) : w);
  }
  const near = await limited(
    TRAIN.flatMap((v) => NEAR_MISSES.map((p) => () => clip(v, pick(paces), p))),
    8,
  );
  for (const s of near) put("other", rand() < 0.4 ? under(inWindow(s), 12) : inWindow(s));
  for (let i = 0; i < 150; i++) {
    const at = Math.floor(rand() * (babble.length - WINDOW));
    put("other", babble.slice(at, at + WINDOW));
  }
  for (let i = 0; i < 60; i++) {
    const q = new Int16Array(WINDOW);
    for (let j = 0; j < q.length; j++) q[j] = Math.round((rand() - 0.5) * 60);
    put("other", q);
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`train2: ${wake.length * 3} wake, ${n - wake.length * 3} other`);
}

async function main() {
  if (process.argv.includes("--model-set")) return modelSet();
  if (process.argv.includes("--train-more")) return trainMore();
  rmSync(out, { recursive: true, force: true });
  for (const d of ["train/pos", "train/neg"]) mkdirSync(join(out, d), { recursive: true });
  mkdirSync(tmp, { recursive: true });
  const PACES = [0.85, 1, 1.2];

  // Training clips: every training voice says every wake phrase at every pace; negatives at random.
  console.log("Training clips…");
  const posJobs = TRAIN.flatMap((v) =>
    WAKE_PHRASES.slice(0, 2).flatMap((p) => PACES.map((pace) => () => clip(v, pace, p))),
  );
  const pos = await limited(posJobs, 6);
  pos.forEach((s, i) => writeFileSync(join(out, "train/pos", `${i}.wav`), wav(s)));
  const negJobs = SENTENCES.flatMap((t) =>
    [pick(TRAIN), pick(TRAIN)].map((v) => () => clip(v, pick(PACES), t)),
  );
  const neg = await limited(negJobs, 6);
  neg.forEach((s, i) => writeFileSync(join(out, "train/neg", `${i}.wav`), wav(s)));
  console.log(`  ${pos.length} wake, ${neg.length} other`);

  // Test streams: held-out voices only.
  console.log("Test streams…");
  const testPos = await limited(
    TEST.flatMap((v) =>
      WAKE_PHRASES.flatMap((p) =>
        [0.9, 1.15].map((pace) => async () => ({ p, s: await clip(v, pace, p) })),
      ),
    ),
    6,
  );
  const fillers = await limited(
    Array.from({ length: 80 }, () => () => clip(pick(TEST), pick(PACES), pick(SENTENCES))),
    6,
  );
  const parts: Int16Array[] = [silence(2)];
  const labels: Array<{ phrase: string; start: number; end: number }> = [];
  let t = 2;
  for (const { p, s } of testPos.sort(() => rand() - 0.5)) {
    const before = pick(fillers);
    parts.push(before, silence(0.6 + rand() * 1.2));
    t += before.length / RATE;
    t += parts.at(-1)!.length / RATE;
    labels.push({ phrase: p, start: +t.toFixed(3), end: +(t + s.length / RATE).toFixed(3) });
    parts.push(s, silence(3.5));
    t += s.length / RATE + 3.5;
  }
  const quiet = join16(parts);
  writeFileSync(join(out, "quiet.wav"), wav(quiet));
  writeFileSync(join(out, "quiet.json"), JSON.stringify(labels, null, 1));
  // Background talk: four held-out-voice fillers, overlapped, looped under the quiet stream.
  const babble = new Int16Array(RATE * 60);
  for (let k = 0; k < 4; k++) {
    const seq = join16(Array.from({ length: 12 }, () => pick(fillers)));
    for (let i = 0; i < babble.length; i++)
      babble[i] = Math.max(
        -32768,
        Math.min(32767, babble[i]! + Math.round(seq[(i + k * 7919) % seq.length]! / 2)),
      );
  }
  writeFileSync(join(out, "talk.wav"), wav(mix(quiet, babble, 8)));
  writeFileSync(join(out, "talk.json"), JSON.stringify(labels, null, 1));

  // ~45 minutes of ordinary speech, every voice, no wake phrase.
  console.log("Negatives…");
  const all = [...TRAIN, ...TEST];
  const negParts = await limited(
    Array.from({ length: 900 }, () => () => clip(pick(all), pick(PACES), pick(SENTENCES))),
    8,
  );
  const negStream = join16(negParts.flatMap((s) => [s, silence(0.3 + rand() * 0.8)]));
  writeFileSync(join(out, "negatives.wav"), wav(negStream));
  console.log(
    `  quiet ${(quiet.length / RATE / 60).toFixed(1)} min with ${labels.length} wakes; negatives ${(negStream.length / RATE / 60).toFixed(1)} min`,
  );
  rmSync(tmp, { recursive: true, force: true });
}

await main();
