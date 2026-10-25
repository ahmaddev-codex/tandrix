// Push-to-talk: hold the mic to record one turn, release to send it. Records mono 16-bit PCM WAV
// at 16 kHz, the format Muse Voice Transcribe takes, so the API forwards it unchanged.
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

const WAV_16K: RecordingOptions = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    extension: ".wav",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  // Android can't write WAV here; the API turns other formats down with a clear message.
  android: { extension: ".m4a", outputFormat: "mpeg4", audioEncoder: "aac" },
  web: {},
};

export type PushToTalkState = "idle" | "listening" | "working";

export function usePushToTalk(opts: {
  keywords: string[];
  onHeard: (transcript: string) => void;
  onProblem: (message: string) => void;
}) {
  const recorder = useAudioRecorder(WAV_16K);
  const [state, setState] = useState<PushToTalkState>("idle");
  // Starting is async (permission, audio session, prepare). The button may be released before it
  // finishes, so track the press separately and stop as soon as recording is ready.
  const held = useRef(false);
  const recording = useRef(false);
  const starting = useRef(false);

  const send = async () => {
    recording.current = false;
    setState("working");
    try {
      await recorder.stop();
      // Back to playback so the reply comes out of the speaker, not the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error("The recording didn't save. Try again.");
      const r = await api.transcribe(recorder.uri, opts.keywords);
      if (r.status === "heard") opts.onHeard(r.transcript);
      else opts.onProblem(r.message);
    } catch (e) {
      opts.onProblem((e as Error).message);
    } finally {
      setState("idle");
    }
  };

  const start = async () => {
    held.current = true;
    if (starting.current || recording.current || state === "working") return;
    starting.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        opts.onProblem("Microphone access is off for Tandrix. Turn it on in Settings to talk.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      setState("listening");
      // Released while we were getting ready: send what there is (a short turn reads as unclear).
      if (!held.current) await send();
    } catch {
      opts.onProblem("Tandrix couldn't start the microphone. Try again.");
      setState("idle");
    } finally {
      starting.current = false;
    }
  };

  const finish = async () => {
    held.current = false;
    if (recording.current) await send();
  };

  return { state, start, finish };
}
