// Spoken replies in Tandrix's own voice (Kokoro, from the API), the same voice as on the Mac.
// Without it (offline, unavailable): an Apple Premium or Enhanced device voice (@tandrix/core
// pickVoice), which sounds completely natural. Never a compact or novelty robotic voice.
// One reply at a time: a new reply interrupts the last, and "stop" silences it.
import { pickVoice, speechPieces } from "@tandrix/core";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { api } from "@/lib/api";
import { takeReply } from "@/lib/timings";

const chosen = new Map<string, Promise<string | null>>();

/** The device's best voice for a language, looked up once; null when it has none. */
function deviceVoice(language: string): Promise<string | null> {
  let v = chosen.get(language);
  if (!v) {
    v = Speech.getAvailableVoicesAsync()
      .then((all) =>
        pickVoice(
          all.map((x) => ({
            id: x.identifier,
            name: x.name,
            lang: x.language,
            quality: x.quality,
          })),
          language,
        ),
      )
      .then((best) => best?.id ?? null)
      .catch(() => null);
    chosen.set(language, v);
  }
  return v;
}

let players: AudioPlayer[] = [];
let pending: AbortController | undefined;
let n = 0;

export function stopSpeaking() {
  pending?.abort();
  pending = undefined;
  for (const p of players) p.remove();
  players = [];
  Speech.stop();
}

/** A piece of Tandrix's voice as a file the player can open. */
function pieceFile(wav: Uint8Array): string {
  const file = new File(Paths.cache, `reply-${++n % 8}.wav`);
  if (file.exists) file.delete();
  file.create();
  file.write(wav);
  return file.uri;
}

/** Plays a loaded player through; resolves when it finishes, is stopped, or fails. */
function playThrough(player: AudioPlayer, ctl: AbortController): Promise<void> {
  return new Promise((resolve) => {
    const sub = player.addListener("playbackStatusUpdate", (st) => {
      if (st.didJustFinish) done();
    });
    const done = () => {
      sub.remove();
      ctl.signal.removeEventListener("abort", done);
      resolve();
    };
    ctl.signal.addEventListener("abort", done, { once: true });
    player.play();
  });
}

/**
 * Speaks a reply a piece at a time (@tandrix/core speechPieces): the first sentence alone so the
 * first sound comes as soon as it's made, each later piece made and loaded while the one before
 * plays.
 */
export function speak(text: string, language = "en") {
  const trimmed = text.trim();
  if (!trimmed) return;
  stopSpeaking();
  // The reply being timed, if any, is timed up to this voice's first sound.
  const watch = takeReply();
  const ctl = new AbortController();
  pending = ctl;
  // Tandrix's voice is English for now; other languages use the device's voice.
  const pieces = language.startsWith("en") ? speechPieces(trimmed) : [];
  void (async () => {
    let next: Promise<Uint8Array | null> | null = pieces.length
      ? api.speech(pieces[0]!, ctl.signal).catch(() => null)
      : null;
    let rest = trimmed;
    let started = false;
    let playing: Promise<void> = Promise.resolve();
    for (let i = 0; next && i < pieces.length; i++) {
      const wav = await next;
      if (i === 0) watch?.mark("voiced");
      if (ctl.signal.aborted) return watch?.end();
      next =
        i + 1 < pieces.length ? api.speech(pieces[i + 1]!, ctl.signal).catch(() => null) : null;
      if (!wav) break;
      let player: AudioPlayer;
      try {
        if (!started) await setAudioModeAsync({ playsInSilentMode: true });
        player = createAudioPlayer(pieceFile(wav));
      } catch {
        break;
      }
      players.push(player);
      // Loaded now; it starts the moment the piece before it ends.
      await playing;
      if (ctl.signal.aborted) return watch?.end();
      playing = playThrough(player, ctl).then(() => {
        player.remove();
        players = players.filter((p) => p !== player);
      });
      rest = pieces.slice(i + 1).join(" ");
      if (!started) {
        started = true;
        watch?.mark("sounding");
        watch?.end();
      }
    }
    await playing;
    if (ctl.signal.aborted || !rest) {
      if (pending === ctl) pending = undefined;
      return watch?.end();
    }
    // Heard even with the ringer switch off: the user asked for the answer. What couldn't be made in
    // Tandrix's voice is said in the device's best voice; with no natural voice it stays text only.
    const voice = await deviceVoice(language);
    if (!ctl.signal.aborted && voice && !started) watch?.mark("sounding");
    watch?.end();
    if (pending === ctl) pending = undefined;
    if (ctl.signal.aborted || !voice) return;
    Speech.speak(rest, { language, voice, rate: 1 });
  })();
}
