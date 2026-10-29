// Show me and Do it for me in the panel: listen (hotkey, held mic, or "Wake up Tandrix"), or take a
// typed goal; screenshot what the user is looking at; ask or act across apps; queue follow-up tasks
// given while Tandrix is already working; point at the answer and always voice the response.
import { parseWakePhrase, TAP_MS, wantsDesktopExecution, wantsLesson } from "@tandrix/core";
import type { ControlMode, Evidence } from "@tandrix/contracts";
import type { VoiceTurn } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenCapture } from "../../shared/bridge";
import { api } from "./api";
import { startRecording, type Recording } from "./recorder";
import { uploadScreenshot } from "./screenshot";
import { recentExchanges } from "./exchanges";
import { markTried } from "./setup";
import { present, presentAnswer, presenceState } from "./presence";
import { isSpeaking, speak, stopSpeaking } from "./speech";
import { TALK_KEYS, type Presence } from "../../shared/bridge";

export type ShowMePhase = "idle" | "listening" | "working";

/** How long the screen gets to settle after a batch before the next screenshot. */
const SETTLE_MS = 350;

const WAKE_KEY = "tandrix.wakeWord";

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
  const [queued, setQueued] = useState<string[]>([]);
  // The wake word is off until the user switches it on; it's remembered on this Mac.
  const [wakeWord, setWakeWordState] = useState(() => {
    try {
      return localStorage.getItem(WAKE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [wakeStatus, setWakeStatus] = useState<{ status: string; message?: string }>({
    status: "off",
  });
  const setWakeWord = useCallback((on: boolean) => {
    setWakeWordState(on);
    try {
      localStorage.setItem(WAKE_KEY, on ? "1" : "0");
    } catch {
      // Without storage it's just not remembered.
    }
  }, []);
  // How Tandrix helps; held by the main process, which alone can act.
  const [mode, setModeState] = useState<ControlMode>("show");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    void window.tandrix.doing.mode().then(setModeState);
  }, []);
  /** Returns the mode in force: Do it for me needs Accessibility, so it may stay Show me. */
  const setMode = useCallback(
    async (next: ControlMode) => {
      const now = await window.tandrix.doing.setMode(next);
      setModeState(now);
      if (next === "do" && now !== "do")
        setProblem(
          "Do it for me needs Tandrix allowed under Accessibility in System Settings. Allow it, then switch again.",
        );
      // Mirror the mode onto the active job for the timeline; the switch itself never waits on it.
      if (jobId) api.setControlMode(jobId, now).catch(() => undefined);
      return now;
    },
    [jobId],
  );
  // What Tandrix calls the user, if they have said; the model uses it rarely.
  const userNameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        userNameRef.current = p.displayName ?? undefined;
      })
      .catch(() => undefined);
  }, []);
  const recording = useRef<Recording | undefined>(undefined);
  const held = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const queueRef = useRef<string[]>([]);
  /** Background work is running, even while the panel listens for a follow-up. */
  const workingRef = useRef(false);
  /** The presence the background work last showed, restored after listening. */
  const busyRef = useRef<Presence | null>(null);

  /** Back to whatever was happening before listening started. */
  const restorePhase = () => {
    if (workingRef.current) {
      setPhase("working");
      phaseRef.current = "working";
      if (busyRef.current) present(busyRef.current);
    } else {
      setPhase("idle");
      phaseRef.current = "idle";
    }
  };

  const add = (turn: VoiceTurn) => setTurns((t) => [...t, turn]);
  const reply = (text: string) => {
    add({ speaker: "tandrix", text });
    speak(text);
    presentAnswer(text);
  };
  /** A problem shows in the panel, is spoken aloud, and briefly shows status at the top of screen. */
  const fail = (message: string) => {
    setProblem(message);
    speak(message);
    presentAnswer(message);
  };

  const shoot = useCallback(async (job: string | undefined): Promise<Shot> => {
    const capture = await window.tandrix.screen.capture();
    return { capture, evidence: job ? await uploadScreenshot(job, capture) : null };
  }, []);

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  /**
   * Do it for me: the task runs turn by turn across whatever apps are needed. The API says what to
   * do on the screen shown; the main process checks each action with the guard, asks the user
   * where needed, and runs it; then a fresh screenshot goes back.
   */
  const doTask = useCallback(async (task: string, shot: Promise<Shot>) => {
    await window.tandrix.doing.begin();
    reply("On it.");
    try {
      let { capture } = await shot;
      const inline = (c: ScreenCapture) => ({
        mimeType: c.mimeType,
        data: base64(c.image),
      });
      const { apps, front } = await window.tandrix.doing.apps();
      let r = await api.doStart({
        screenshot: inline(capture),
        task,
        geometry: capture.geometry,
        apps,
        ...(front ? { frontApp: front } : {}),
      });
      let appSwitches = 0;
      for (;;) {
        if (r.status === "open_app") {
          if (++appSwitches > 6 || !(await window.tandrix.doing.openApp(r.app)))
            return reply(`Tandrix couldn't open ${r.app}. Open it yourself, then ask again.`);
          // If the goal was simply to open or launch that app, it is completed.
          const onlyOpen = new RegExp(
            `^(?:please\\s+)?(?:open|launch|start|switch to)\\s+${r.app.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?:\\s+for\\s+me)?[.!]*$`,
            "i",
          ).test(task.trim());
          if (onlyOpen) return reply(`Opened ${r.app}.`);

          await new Promise((res) => setTimeout(res, SETTLE_MS));
          capture = await window.tandrix.screen.capture();
          r = await api.doStart({
            screenshot: inline(capture),
            task,
            geometry: capture.geometry,
            apps,
            frontApp: r.app,
            planned: true,
          });
          continue;
        }
        if (r.status === "unavailable") return reply(r.message);
        if (r.status === "done") return reply(r.reply || "Done.");
        // Narrate the work as it happens: the model's few words about this turn.
        if (r.reply) {
          speak(r.reply);
          present({ state: "doing", label: r.reply.slice(0, 120) });
        }
        const ran = await window.tandrix.doing.run({
          actions: r.actions,
          geometry: capture.geometry,
          intent: r.reply,
          safetyChecks: r.safetyChecks,
        });
        if (ran.status !== "ran") return reply(ran.message);
        // Let the app react (menus open, pages load) before looking again.
        await new Promise((res) => setTimeout(res, SETTLE_MS));
        capture = await window.tandrix.screen.capture();
        r = await api.doContinue({
          session: r.session,
          screenshot: inline(capture),
          geometry: capture.geometry,
          acknowledged: ran.acknowledged,
        });
      }
    } finally {
      await window.tandrix.doing.end();
    }
  }, []);

  const answer = useCallback(
    async (job: string | undefined, question: string, shot: Promise<Shot>) => {
      if (modeRef.current === "do") return doTask(question, shot);
      if (wantsDesktopExecution(question)) {
        const switched = await setMode("do");
        if (switched === "do") return doTask(question, shot);
      }
      const { capture, evidence } = await shot;
      const lesson = wantsLesson(question);
      const named = userNameRef.current ? { userName: userNameRef.current } : {};
      const r =
        job && evidence
          ? await api.screenAsk(job, {
              evidenceId: evidence.id,
              transcript: question,
              geometry: capture.geometry,
              mode: "show",
              lesson,
              ...named,
            })
          : await api.screenAskInline({
              screenshot: { mimeType: capture.mimeType, data: base64(capture.image) },
              transcript: question,
              geometry: capture.geometry,
              mode: "show",
              // The question just asked is already the last turn; send the ones before it.
              history: recentExchanges(turnsRef.current.slice(0, -1)),
              lesson,
              ...named,
            });
      if (r.status === "unavailable") return reply(r.message);
      if (r.target?.geometry.kind === "box") {
        const b = r.target.geometry.box;
        const center = { x: b.x + Math.round(b.w / 2), y: b.y + Math.round(b.h / 2) };
        const box = {
          width: Math.round((b.w * capture.geometry.displayWidth) / capture.geometry.imageWidth),
          height: Math.round((b.h * capture.geometry.displayHeight) / capture.geometry.imageHeight),
        };
        await window.tandrix.overlay.pointAt(capture.geometry, center, "", box);
      } else if (r.target?.geometry.kind === "point") {
        await window.tandrix.overlay.pointAt(capture.geometry, r.target.geometry.point, "");
      }
      reply(r.reply);
      markTried();
    },
    [doTask, setMode],
  );

  /** Does the work with the presence bar showing it's busy from the start, then drains queued tasks. */
  const run = useCallback(
    async (work: () => Promise<void>, busy: Presence) => {
      setPhase("working");
      phaseRef.current = "working";
      workingRef.current = true;
      busyRef.current = busy;
      present(busy);
      try {
        await work();
        while (queueRef.current.length > 0) {
          const nextTask = queueRef.current.shift()!;
          setQueued([...queueRef.current]);
          busyRef.current = { state: "looking", label: "Working on your next task" };
          present(busyRef.current);
          reply("On to your next task.");
          await answer(jobId, nextTask, shoot(jobId));
        }
      } catch (e) {
        fail((e as Error).message);
      } finally {
        workingRef.current = false;
        busyRef.current = null;
        setPhase("idle");
        phaseRef.current = "idle";
        // Work that ended without a reply leaves the screen clear.
        const shown = presenceState();
        if (shown === "thinking" || shown === "looking") present(null);
      }
    },
    [jobId, answer, shoot],
  );

  /** A typed or wake-triggered question. Can be called even while another task is working. */
  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const wake = parseWakePhrase(trimmed);
      const effective = wake.woke ? wake.remainder : trimmed;
      if (wake.woke && !effective) {
        reply("I'm here. What would you like to do?");
        return;
      }
      setProblem(undefined);
      add({ speaker: "you", text: effective });
      if (workingRef.current) {
        queueRef.current.push(effective);
        setQueued([...queueRef.current]);
        reply("Got it — I'll do that next.");
        restorePhase();
        return;
      }
      if (phaseRef.current !== "idle") return;
      stopSpeaking();
      void run(() => answer(jobId, effective, shoot(jobId)), {
        state: "looking",
        label: "Looking at your screen",
      });
    },
    [jobId, run, answer, shoot],
  );

  /**
   * Starts listening. "tap": the question ends itself after a pause, or the hotkey again (⌃⌥Space,
   * a wake word). "keys": ⌥⌘ held, letting go asks. "hold": the panel's mic button.
   */
  const listenRef = useRef<(how?: "tap" | "keys" | "hold") => Promise<void>>(async () => undefined);

  /** Ends the question: asks it if the user spoke; otherwise says so, sending nothing. */
  const finish = useCallback(
    async (step?: "send" | "nothing_heard") => {
      const rec = recording.current;
      recording.current = undefined;
      if (!rec) return;
      void window.tandrix.voice.setListening(false);
      if ((step ?? rec.ended()) === "nothing_heard") {
        rec.cancel();
        restorePhase();
        add({ speaker: "tandrix", text: NOTHING_HEARD });
        speak(NOTHING_HEARD);
        if (!workingRef.current) return presentAnswer(NOTHING_HEARD);
        return;
      }
      await run(
        async () => {
          const wav = await rec.stop();
          // Upload the screenshot while the question is transcribed.
          const shot = shoot(jobId);
          shot.catch(() => undefined);
          const heard = await api.transcribe(wav);
          if (heard.status !== "heard") return reply(heard.message);
          const wake = parseWakePhrase(heard.transcript);
          if (wake.woke && !wake.remainder) {
            setTimeout(() => void listenRef.current("tap"), 50);
            return;
          }
          const effective = wake.woke ? wake.remainder : heard.transcript;
          add({ speaker: "you", text: effective });
          present({ state: "looking", label: "Looking at your screen" });
          await answer(jobId, effective, shot);
        },
        { state: "thinking", label: "Thinking" },
      );
    },
    [jobId, run, shoot, answer],
  );

  const listen = useCallback(
    async (how: "tap" | "keys" | "hold" = "hold") => {
      // Listening barges in: allowed idle or while work runs in the background. stopSpeaking
      // below also keeps the mic from hearing Tandrix's own voice.
      if (phaseRef.current === "listening") return;
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
      phaseRef.current = "listening";
      present(shown);
    },
    [finish],
  );
  listenRef.current = listen;

  const cancel = useCallback(() => {
    recording.current?.cancel();
    recording.current = undefined;
    held.current = false;
    queueRef.current = [];
    setQueued([]);
    void window.tandrix.voice.setListening(false);
    setPhase("idle");
    phaseRef.current = "idle";
    present(null);
  }, []);

  // "Hey Tandrix" / "Wake up Tandrix", heard on this Mac only (Apple's on-device recognition in
  // the main process): nothing leaves the Mac until the user has said Tandrix's name.
  useEffect(() => window.tandrix.voice.onWakeStatus(setWakeStatus), []);
  useEffect(() => {
    void window.tandrix.voice.setWakeWord(wakeWord);
  }, [wakeWord]);
  useEffect(
    () =>
      window.tandrix.voice.onWake((rest) => {
        // Tandrix saying its own name, or already listening, isn't a wake.
        if (isSpeaking() || phaseRef.current === "listening") return;
        if (rest) ask(rest);
        else void listen("tap");
      }),
    [ask, listen],
  );

  // The hotkey: tap to listen; a pause asks (or tap again); Esc cancels.
  useEffect(() => {
    const offKey = window.tandrix.voice.onHotkey(() => {
      if (phaseRef.current === "listening") void finish();
      else void listen("tap");
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

  return {
    phase,
    turns,
    problem,
    queued,
    wakeWord,
    setWakeWord,
    wakeStatus,
    ask,
    press,
    release,
    cancel,
    mode,
    setMode,
  };
}
