// Show me in the panel: listen (hotkey or held mic), or take a typed question; screenshot what the
// user is looking at; ask; point at the answer and say it.
import { TAP_MS } from "@tandrix/core";
import type { Evidence } from "@tandrix/contracts";
import type { VoiceTurn } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenCapture } from "../../shared/bridge";
import { api } from "./api";
import { startRecording, type Recording } from "./recorder";
import { uploadScreenshot } from "./screenshot";
import { recentExchanges } from "./exchanges";
import { markTried } from "./setup";
import { speak, stopSpeaking } from "./speech";
import { present, presentAnswer, presenceState } from "./presence";
import { TALK_KEYS } from "../../shared/bridge";

export type ShowMePhase = "idle" | "listening" | "working";

export const NOTHING_HEARD = "Didn't hear anything. Hold ⌥⌘ while you talk, or type your question.";

export const NO_MIC =
  "Tandrix can't use the microphone. Allow it in System Settings > Privacy & Security > Microphone, or type your question.";
/** What's asked about: inside a job the screenshot is job evidence; outside one it isn't kept. */
type Shot = { capture: ScreenCapture; evidence: Evidence | null };

/** Base64 for an inline screenshot, built in chunks so large images don't overflow the stack. */
function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export function useShowMe(jobId: string | undefined) {
  const [phase, setPhase] = useState<ShowMePhase>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [problem, setProblem] = useState<string>();
  const recording = useRef<Recording | undefined>(undefined);
  const held = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const add = (turn: VoiceTurn) => setTurns((t) => [...t, turn]);
  const reply = (text: string) => {
    add({ speaker: "tandrix", text });
    speak(text);
    presentAnswer(text);
  };
  /** A problem shows in the panel and, briefly, at the top of the screen. */
  const fail = (message: string) => {
    setProblem(message);
    presentAnswer(message);
  };

  const shoot = useCallback(async (job: string | undefined): Promise<Shot> => {
    const capture = await window.tandrix.screen.capture();
    return { capture, evidence: job ? await uploadScreenshot(job, capture) : null };
  }, []);

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const answer = useCallback(
    async (job: string | undefined, question: string, shot: Promise<Shot>) => {
      const { capture, evidence } = await shot;
      const r =
        job && evidence
          ? await api.screenAsk(job, {
              evidenceId: evidence.id,
              transcript: question,
              geometry: capture.geometry,
              mode: "show",
            })
          : await api.screenAskInline({
              screenshot: { mimeType: capture.mimeType, data: base64(capture.image) },
              transcript: question,
              geometry: capture.geometry,
              mode: "show",
              // The question just asked is already the last turn; send the ones before it.
              history: recentExchanges(turnsRef.current.slice(0, -1)),
            });
      if (r.status === "unavailable") return reply(r.message);
      if (r.target?.geometry.kind === "point")
        await window.tandrix.overlay.pointAt(capture.geometry, r.target.geometry.point, r.reply);
      reply(r.reply);
      markTried();
    },
    [],
  );

  const run = useCallback(async (work: () => Promise<void>) => {
    setPhase("working");
    present({ state: "looking", label: "Looking at your screen" });
    try {
      await work();
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setPhase("idle");
      // Work that ended without a reply leaves the screen clear.
      if (presenceState() === "looking") present(null);
    }
  }, []);

  /** A typed question. */
  const ask = useCallback(
    (question: string) => {
      if (phaseRef.current !== "idle" || !question.trim()) return;
      setProblem(undefined);
      stopSpeaking();
      add({ speaker: "you", text: question.trim() });
      void run(() => answer(jobId, question.trim(), shoot(jobId)));
    },
    [jobId, run, answer, shoot],
  );

  /** Ends the question: asks it if the user spoke; otherwise says so, sending nothing. */
  const finish = useCallback(
    async (step?: "send" | "nothing_heard") => {
      const rec = recording.current;
      recording.current = undefined;
      if (!rec) return;
      void window.tandrix.voice.setListening(false);
      if ((step ?? rec.ended()) === "nothing_heard") {
        rec.cancel();
        setPhase("idle");
        return reply(NOTHING_HEARD);
      }
      await run(async () => {
        const wav = await rec.stop();
        // Upload the screenshot while the question is transcribed.
        const shot = shoot(jobId);
        shot.catch(() => undefined);
        const heard = await api.transcribe(wav);
        if (heard.status !== "heard") return reply(heard.message);
        add({ speaker: "you", text: heard.transcript });
        await answer(jobId, heard.transcript, shot);
      });
    },
    [jobId, run, shoot, answer],
  );

  /**
   * Starts listening. "tap": the question ends itself after a pause, or the hotkey again (⌃⌥Space,
   * a wake word). "keys": ⌥⌘ held, letting go asks. "hold": the panel's mic button.
   */
  const listen = useCallback(
    async (how: "tap" | "keys" | "hold" = "hold") => {
      if (phaseRef.current !== "idle") return;
      setProblem(undefined);
      stopSpeaking();
      if (!(await window.tandrix.voice.micAccess())) return fail(NO_MIC);
      const shown = {
        state: "listening" as const,
        label: "Listening",
        ...(how === "keys"
          ? { keys: TALK_KEYS, keysHint: "Let go to ask" }
          : how === "tap"
            ? { keys: "⌃⌥Space", keysHint: "Pause, or press again to ask" }
            : {}),
      };
      try {
        recording.current = await startRecording(
          (step) => void finish(step),
          (level) => {
            if (recording.current) present({ ...shown, level });
          },
        );
        if (how === "tap") recording.current.tap();
      } catch {
        return fail("Tandrix couldn't start the microphone. Type your question instead.");
      }
      void window.tandrix.voice.setListening(true);
      setPhase("listening");
      present(shown);
    },
    [jobId, finish],
  );

  const cancel = useCallback(() => {
    recording.current?.cancel();
    recording.current = undefined;
    held.current = false;
    void window.tandrix.voice.setListening(false);
    setPhase("idle");
    present(null);
  }, []);

  // The hotkey: tap to listen; a pause asks (or tap again); Esc cancels.
  useEffect(() => {
    const offKey = window.tandrix.voice.onHotkey(() => {
      if (phaseRef.current === "idle") void listen("tap");
      else if (phaseRef.current === "listening") void finish();
    });
    // ⌥⌘: held to talk, let go to ask.
    const offTalk = window.tandrix.voice.onTalkStart(() => void listen("keys"));
    const offTalkEnd = window.tandrix.voice.onTalkEnd(() => {
      if (recording.current) void finish();
    });
    const offCancel = window.tandrix.voice.onCancel(cancel);
    return () => {
      offKey();
      offTalk();
      offTalkEnd();
      offCancel();
    };
  }, [listen, finish, cancel]);

  /**
   * The panel's mic button, as on the phone: hold to talk and let go to ask; or click it once and
   * talk, and a pause asks (or click again).
   */
  const pressedAt = useRef(0);
  const press = useCallback(async () => {
    if (phaseRef.current === "listening" && !held.current) return void finish();
    held.current = true;
    pressedAt.current = Date.now();
    await listen();
    // Let go while the microphone was starting: that was a click, so keep listening.
    if (!held.current) recording.current?.tap();
  }, [listen, finish]);
  const release = useCallback(() => {
    if (!held.current) return;
    held.current = false;
    if (!recording.current) return;
    if (Date.now() - pressedAt.current < TAP_MS) recording.current.tap();
    else void finish();
  }, [finish]);

  return { phase, turns, problem, ask, press, release, cancel };
}
