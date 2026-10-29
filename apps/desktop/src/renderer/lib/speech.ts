// Replies are spoken as well as shown, in Tandrix's own voice (Kokoro, from the API) so the Mac
// and the phone sound the same. Without it: a Premium or Enhanced macOS voice through `say` in the
// main process (@tandrix/core pickVoice). Without one of those, the reply is text only: Tandrix
// never speaks in a robotic voice.
import { api } from "./api";

let playing: HTMLAudioElement | undefined;
let pending: AbortController | undefined;
let speakingUntil = 0;

export function isSpeaking(): boolean {
  return Boolean(playing || pending || Date.now() < speakingUntil);
}

export function stopSpeaking() {
  pending?.abort();
  pending = undefined;
  speakingUntil = 0;
  if (playing) {
    playing.pause();
    URL.revokeObjectURL(playing.src);
    playing = undefined;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors.
    }
  }
  void window.tandrix.voice.stopSpeaking().catch(() => undefined);
}

export function speak(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  stopSpeaking();
  const ctl = new AbortController();
  pending = ctl;
  // Estimate duration so the wake-word listener ignores Tandrix's own voice while speaking.
  const estMs = Math.max(1800, Math.min(12_000, 900 + trimmed.split(/\s+/).length * 360));
  speakingUntil = Date.now() + estMs;
  void (async () => {
    const wav = await api.speech(trimmed, ctl.signal);
    // Interrupted (a newer reply, Esc, or the user talking) while the voice was being made.
    if (ctl.signal.aborted) return;
    pending = undefined;
    if (wav) {
      const audio = new Audio(URL.createObjectURL(wav));
      playing = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        if (playing === audio) {
          playing = undefined;
          speakingUntil = Date.now() + 300;
        }
      };
      if (
        await audio.play().then(
          () => true,
          () => false,
        )
      )
        return;
    }
    if (ctl.signal.aborted) return;
    speakingUntil = Date.now() + estMs;
    // Fall back to a natural Apple Premium/Enhanced voice on macOS. Never use compact robotic voices.
    await window.tandrix.voice.speak(trimmed).catch(() => false);
  })();
}
