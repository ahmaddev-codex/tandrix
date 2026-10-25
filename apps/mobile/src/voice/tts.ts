// Spoken replies, on the device (Meta has no speech synthesis). One voice at a time: a new reply
// interrupts the last, and "stop" silences it.
import * as Speech from "expo-speech";

export function speak(text: string, language = "en") {
  Speech.stop();
  Speech.speak(text, { language, rate: 1 });
}

export function stopSpeaking() {
  Speech.stop();
}
