// Replies are spoken as well as shown, in Tandrix's own voice (Kokoro, from the API) so the Mac
// and the phone sound the same. A reply is voiced a piece at a time (@tandrix/core speechPieces):
// the first sentence alone, so the first sound comes as soon as it's made, then the rest, each
// piece made while the one before plays and scheduled to start the moment it ends, with no gap.
// Without Tandrix's voice: a Premium or Enhanced macOS voice through `say` in the main process
// (@tandrix/core pickVoice). Without one of those, the reply is text only: Tandrix never speaks in
// a robotic voice.
import { LOOK_ACKS, lookAck, speechPieces } from "@tandrix/core";
import { api } from "./api";
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

export function isSpeaking(): boolean {
  return Boolean(pending || Date.now() < speakingUntil);
}

const audioContext = () => (ctx ??= new AudioContext());

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
  source.connect(audio.destination);
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

export function stopSpeaking() {
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
  Math.max(1800, Math.min(12_000, 900 + text.split(/\s+/).length * 360));

export function speak(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  halt();
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
        watch?.end();
        speakingUntil = Date.now() + estimateMs(rest);
        await window.tandrix.voice.speak(rest).catch(() => false);
        return;
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
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
        watch?.end();
      }
    }
    if (pending === ctl) pending = undefined;
  })();
}
