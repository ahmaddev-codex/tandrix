// Talking to Tandrix: hold the mic and let go to send, or tap it once and talk; a pause ends the
// turn (or a second tap). Turns with no speech in them stay on the phone (voice/turn.ts). Records
// mono 16-bit PCM WAV at 16 kHz, the format Muse Voice Transcribe takes, so the API forwards it
// unchanged.
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { endReply, markReply, startReply } from "@/lib/timings";
import { stopSpeaking } from "./tts";
import {
  addLevel,
  endedTurn,
  startLevels,
  tappedTurn,
  TAP_MS,
  type TurnLevels,
  type TurnStep,
} from "@tandrix/core";

const WAV_16K: RecordingOptions = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
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
/** How the current turn ends: on letting go (hold) or on a pause or second tap (tap). */
export type PushToTalkMode = "hold" | "tap";

export const NOTHING_HEARD =
  "Didn't hear anything. Hold the mic while you talk, or tap it once and speak.";

const METER_MS = 100;

export function usePushToTalk(opts: {
  keywords: string[];
  onHeard: (transcript: string) => void;
  onProblem: (message: string) => void;
}) {
  const recorder = useAudioRecorder(WAV_16K);
  const [state, setState] = useState<PushToTalkState>("idle");
  const [mode, setMode] = useState<PushToTalkMode>("hold");
  // Starting is async (permission, audio session, prepare). The button may be released before it
  // finishes, so track the press separately.
  const held = useRef(false);
  const pressedAt = useRef(0);
  const recording = useRef(false);
  const starting = useRef(false);
  const tapping = useRef(false);
  const levels = useRef<TurnLevels>(startLevels());
  const meter = useRef<ReturnType<typeof setInterval>>(undefined);
  const latest = useRef(opts);
  latest.current = opts;

  const stopMeter = () => {
    if (meter.current) clearInterval(meter.current);
    meter.current = undefined;
  };
  useEffect(() => stopMeter, []);

  /** Ends the turn: transcribe it if the user spoke, otherwise say so without sending anything. */
  const end = async (step: Exclude<TurnStep, "listen">) => {
    if (!recording.current) return;
    recording.current = false;
    tapping.current = false;
    stopMeter();
    setState(step === "send" ? "working" : "idle");
    // Timed from letting go to the first sound of the answer.
    if (step === "send") startReply("voice");
    let heard = false;
    try {
      await recorder.stop();
      markReply("recorded");
      // Back to playback so the reply comes out of the speaker, not the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (step === "nothing_heard") return latest.current.onProblem(NOTHING_HEARD);
      if (!recorder.uri) throw new Error("The recording didn't save. Try again.");
      const r = await api.transcribe(recorder.uri, latest.current.keywords);
      markReply("transcribed");
      heard = r.status === "heard";
      if (r.status === "heard") latest.current.onHeard(r.transcript);
      else latest.current.onProblem(r.message);
    } catch (e) {
      latest.current.onProblem((e as Error).message);
    } finally {
      // Nothing was asked: the timing ends here (a problem said aloud is not an answer).
      if (!heard) endReply();
      setState("idle");
    }
  };

  const listen = () => {
    levels.current = startLevels();
    meter.current = setInterval(() => {
      if (!recording.current) return stopMeter();
      levels.current = addLevel(levels.current, recorder.getStatus().metering, METER_MS);
      // A tapped turn ends itself; a held one waits for the finger.
      if (tapping.current) {
        const step = tappedTurn(levels.current);
        if (step !== "listen") void end(step);
      }
    }, METER_MS);
  };

  /** The mic was pressed. During a tapped turn, a second tap ends it. */
  const start = async () => {
    if (tapping.current && recording.current) {
      held.current = false;
      return end(endedTurn(levels.current));
    }
    held.current = true;
    pressedAt.current = Date.now();
    if (starting.current || recording.current || state === "working") return;
    // Tandrix stops talking when the user does: otherwise the mic hears its own reply.
    stopSpeaking();
    starting.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        latest.current.onProblem(
          "Microphone access is off for Tandrix. Turn it on in Settings to talk.",
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      setMode("hold");
      setState("listening");
      listen();
      // Let go while we were getting ready: that was a tap, so keep listening.
      if (!held.current) {
        tapping.current = true;
        setMode("tap");
      }
    } catch {
      latest.current.onProblem("Tandrix couldn't start the microphone. Try again.");
      setState("idle");
    } finally {
      starting.current = false;
    }
  };

  /** The mic was let go: a hold ends the turn, a tap keeps listening. */
  const finish = async () => {
    if (!held.current) return;
    held.current = false;
    if (!recording.current) return;
    if (Date.now() - pressedAt.current < TAP_MS) {
      tapping.current = true;
      setMode("tap");
      return;
    }
    await end(endedTurn(levels.current));
  };

  return { state, mode, start, finish };
}
