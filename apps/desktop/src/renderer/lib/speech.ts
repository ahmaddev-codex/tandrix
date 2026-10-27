// Replies are spoken as well as shown, in Tandrix's own voice (Kokoro, from the API) so the Mac
// and the phone sound the same. Without it: a Premium or Enhanced macOS voice through `say` in the
// main process (@tandrix/core pickVoice). Without one of those, the reply is text only: Tandrix
// never speaks in a robotic voice.
import { api } from "./api";

let playing: HTMLAudioElement | undefined;
let pending: AbortController | undefined;

export function stopSpeaking() {
  pending?.abort();
  pending = undefined;
  if (playing) {
    playing.pause();
    URL.revokeObjectURL(playing.src);
    playing = undefined;
  }
  void window.tandrix.voice.stopSpeaking().catch(() => undefined);
}

export function speak(text: string) {
  stopSpeaking();
  const ctl = new AbortController();
  pending = ctl;
  void (async () => {
    const wav = await api.speech(text, ctl.signal);
    // Interrupted (a newer reply, Esc, or the user talking) while the voice was being made.
    if (ctl.signal.aborted) return;
    pending = undefined;
    if (wav) {
      const audio = new Audio(URL.createObjectURL(wav));
      playing = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        if (playing === audio) playing = undefined;
      };
      if (
        await audio.play().then(
          () => true,
          () => false,
        )
      )
        return;
    }
    await window.tandrix.voice.speak(text).catch(() => false);
  })();
}
