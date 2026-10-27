// Spoken replies in Tandrix's own voice (Kokoro, from the API), the same voice as on the Mac.
// Without it (offline, unavailable): a Premium or Enhanced device voice (@tandrix/core
// pickVoice). Without one of those, the reply is text only: Tandrix never speaks in a robotic
// voice. One reply at a time: a new reply interrupts the last, and "stop" silences it.
import { pickVoice } from "@tandrix/core";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { api } from "@/lib/api";

const chosen = new Map<string, Promise<string | null>>();

/** The device's natural voice for a language, looked up once; null when it has none. */
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

let player: AudioPlayer | undefined;
let pending: AbortController | undefined;
let n = 0;

export function stopSpeaking() {
  pending?.abort();
  pending = undefined;
  player?.remove();
  player = undefined;
  Speech.stop();
}

export function speak(text: string, language = "en") {
  stopSpeaking();
  const ctl = new AbortController();
  pending = ctl;
  void (async () => {
    // Tandrix's voice is English for now; other languages use the device's natural voice.
    const wav = language.startsWith("en") ? await api.speech(text, ctl.signal) : null;
    if (ctl.signal.aborted) return;
    pending = undefined;
    if (wav) {
      try {
        const file = new File(Paths.cache, `reply-${++n % 4}.wav`);
        if (file.exists) file.delete();
        file.create();
        file.write(wav);
        // Heard even with the ringer switch off: the user asked for the answer.
        await setAudioModeAsync({ playsInSilentMode: true });
        if (ctl.signal.aborted) return;
        player = createAudioPlayer(file.uri);
        player.play();
        return;
      } catch {
        // Fall through to the device's voice.
      }
    }
    const voice = await deviceVoice(language);
    if (ctl.signal.aborted || !voice) return;
    Speech.speak(text, { language, voice, rate: 1 });
  })();
}
