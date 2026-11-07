// Replies are spoken as well as shown, in Tandrix's own voice (Kokoro, from the API) so the Mac
// and the phone sound the same. A reply is voiced a piece at a time (@tandrix/core speechPieces):
// the first sentence alone, so the first sound comes as soon as it's made, then the rest, each
// piece made while the one before plays and scheduled to start the moment it ends, with no gap.
// Without Tandrix's voice: a Premium or Enhanced macOS voice through `say` in the main process
// (@tandrix/core pickVoice). Without one of those, the reply is text only: Tandrix never speaks in
// a robotic voice.
import { LOOK_ACKS, lookAck, speechPieces } from "@tandrix/core";
// A real "Mhm", recorded: a speech model can only spell it out.
import mhmUrl from "../assets/mhm.wav?url";
import { api } from "./api";
import { voiceVolume } from "./loudness";
import { takeReply } from "./timings";

let ctx: AudioContext | undefined;
let sources: AudioBufferSourceNode[] = [];
let pending: AbortController | undefined;
let speakingUntil = 0;
/** Lines already in Tandrix's voice on this Mac, played without asking the server (SP7). */
const clips = new Map<string, AudioBuffer>();
let ack: AudioBufferSourceNode | undefined;
/** When the acknowledgement playing now ends, on the audio clock; a reply starts after it. */
let ackEndsAt = 0;
let lastAck: string | undefined;

/** What Tandrix is saying now, so a wake word can be told from its own voice saying the name. */
let saying = "";

/** Whether what Tandrix is saying now could be heard as its own name. */
export function sayingName(name = "Tandrix"): boolean {
  if (!isSpeaking()) return false;
  const key = name.toLowerCase().slice(0, 4);
  return saying.toLowerCase().includes(key);
}

export function isSpeaking(): boolean {
  return Boolean(pending || Date.now() < speakingUntil);
}

const audioContext = () => (ctx ??= new AudioContext());
let master: GainNode | undefined;
/** Where every sound goes: one volume, set from quiet and night modes (VO7) as each one starts. */
function output(): GainNode {
  const audio = audioContext();
  if (!master) {
    master = audio.createGain();
    master.connect(audio.destination);
  }
  master.gain.setValueAtTime(voiceVolume(), audio.currentTime);
  return master;
}

/** Fetches lines in Tandrix's voice once and keeps them, one at a time; failures are tried later. */
export async function preloadVoice(lines: readonly string[] = LOOK_ACKS) {
  const audio = audioContext();
  for (const line of lines) {
    if (clips.has(line)) continue;
    const wav = await api.speech(line, new AbortController().signal).catch(() => null);
    const buffer = wav
      ? await wav
          .arrayBuffer()
          .then((b) => audio.decodeAudioData(b))
          .catch(() => null)
      : null;
    if (buffer) clips.set(line, buffer);
  }
}

/**
 * Says a short acknowledgement now, from audio already on this Mac, while the answer is worked
 * out: never the same one twice in a row, and nothing when none is loaded (it's never fetched).
 */
export function acknowledgeNow(): boolean {
  const line = lookAck(
    lastAck,
    LOOK_ACKS.filter((l) => clips.has(l)),
  );
  if (!line || pending) return false;
  const audio = audioContext();
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  const source = audio.createBufferSource();
  source.buffer = clips.get(line)!;
  source.connect(output());
  source.start();
  ack = source;
  lastAck = line;
  ackEndsAt = audio.currentTime + source.buffer.duration;
  speakingUntil = Math.max(speakingUntil, Date.now() + source.buffer.duration * 1000 + 300);
  source.onended = () => {
    if (ack === source) ack = undefined;
  };
  return true;
}

/**
 * A soft two-note chime: Tandrix heard its name and is listening. Made on the spot, so it plays the
 * instant it's asked for.
 */
export function chime() {
  const audio = audioContext();
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  const t = audio.currentTime + 0.01;
  [880, 1318.5].forEach((hz, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    const at = t + i * 0.09;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.07, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(gain).connect(output());
    osc.start(at);
    osc.stop(at + 0.24);
  });
}

let mhm: AudioBuffer | undefined;
/** Loads the "Mhm" once, at start, so answering the name is instant. */
export async function loadMhm() {
  if (mhm) return;
  const audio = audioContext();
  mhm = await fetch(mhmUrl)
    .then((r) => r.arrayBuffer())
    .then((b) => audio.decodeAudioData(b))
    .catch(() => undefined);
}

/**
 * Tandrix heard its name: "Mhm", as a person would, from audio already on this Mac; the chime if
 * that isn't loaded yet.
 */
export function answerName() {
  const clip = mhm;
  if (!clip) return chime();
  const audio = audioContext();
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  const source = audio.createBufferSource();
  source.buffer = clip;
  source.connect(output());
  source.start();
}

/** Changes whenever speech is stopped on purpose (Esc, a new question, the wake word). */
let stops = 0;
export const speechStops = () => stops;

/** Says it and waits until it's been said (or stopped); false when it was stopped. */
export async function speakAndWait(text: string): Promise<boolean> {
  const before = stops;
  await speak(text);
  while (isSpeaking() && stops === before) await new Promise((r) => setTimeout(r, 100));
  return stops === before;
}

export function stopSpeaking() {
  stops++;
  halt();
  try {
    ack?.stop();
  } catch {
    // Already ended.
  }
  ack = undefined;
  ackEndsAt = 0;
}

/** Stops the reply being said, but lets an acknowledgement finish: the reply follows it. */
function halt() {
  pending?.abort();
  pending = undefined;
  speakingUntil = ack ? speakingUntil : 0;
  for (const s of sources) {
    try {
      s.stop();
    } catch {
      // Not started yet, or already ended.
    }
  }
  sources = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors.
    }
  }
  void window.tandrix.voice.stopSpeaking().catch(() => undefined);
}

/** A rough length for text in the device's voice, so the wake word ignores Tandrix saying it. */
const estimateMs = (text: string) =>
  Math.max(1800, Math.min(180_000, 900 + text.split(/\s+/).length * 360));

/**
 * `stale`: a progress line that may be out of date by the time its voice is ready; it's checked
 * then, and the line is dropped rather than said late.
 */
/**
 * Says something; the promise settles when its sound starts, or when it won't (dropped,
 * interrupted, no voice), so a task can say what it's about to do before it does it.
 */
export function speak(text: string, opts: { stale?: () => boolean } = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();
  let begun!: () => void;
  const began = new Promise<void>((r) => (begun = r));
  halt();
  saying = trimmed;
  // The reply being timed, if any, is timed up to this voice's first sound.
  const watch = takeReply();
  const ctl = new AbortController();
  pending = ctl;
  speakingUntil = Date.now() + estimateMs(trimmed);
  const pieces = speechPieces(trimmed);
  void (async () => {
    const audio = audioContext();
    if (audio.state === "suspended") await audio.resume().catch(() => undefined);
    /** When the last scheduled piece ends, on the audio clock. */
    let endsAt = 0;
    let started = false;
    // Each piece is asked for as the one before arrives, so the server makes them in order while
    // the earlier ones play.
    /** A piece's voice: already on this Mac, or asked for. */
    const voiceOf = (piece: string): Promise<Blob | AudioBuffer | null> =>
      clips.get(piece)
        ? Promise.resolve(clips.get(piece)!)
        : api.speech(piece, ctl.signal).catch(() => null);
    let next = voiceOf(pieces[0]!);
    for (let i = 0; i < pieces.length; i++) {
      const wav = await next;
      if (i === 0) watch?.mark("voiced");
      if (ctl.signal.aborted) return watch?.end();
      if (i === 0 && opts.stale?.()) {
        if (pending === ctl) pending = undefined;
        speakingUntil = 0;
        return watch?.end();
      }
      if (i + 1 < pieces.length) next = voiceOf(pieces[i + 1]!);
      const buffer =
        wav instanceof AudioBuffer
          ? wav
          : wav
            ? await wav
                .arrayBuffer()
                .then((b) => audio.decodeAudioData(b))
                .catch(() => null)
            : null;
      if (ctl.signal.aborted) return watch?.end();
      if (!buffer) {
        // The voice couldn't be made: the rest in the device's voice, once what's queued ends.
        const rest = pieces.slice(i).join(" ");
        const wait = Math.max(0, (Math.max(endsAt, ackEndsAt) - audio.currentTime) * 1000);
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (ctl.signal.aborted) return watch?.end();
        pending = undefined;
        if (!started) watch?.mark("sounding");
        begun();
        watch?.end();
        speakingUntil = Date.now() + estimateMs(rest);
        await window.tandrix.voice.speak(rest, voiceVolume()).catch(() => false);
        return;
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(output());
      const at = Math.max(audio.currentTime + 0.02, endsAt, ackEndsAt);
      source.start(at);
      sources.push(source);
      source.onended = () => {
        sources = sources.filter((s) => s !== source);
      };
      endsAt = at + buffer.duration;
      speakingUntil = Date.now() + (endsAt - audio.currentTime) * 1000 + 300;
      if (!started) {
        started = true;
        watch?.mark("sounding");
        begun();
        watch?.end();
      }
    }
    if (pending === ctl) pending = undefined;
  })().finally(() => begun());
  return began;
}
