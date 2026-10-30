// Show me and Do it for me in the panel: listen (hotkey, held mic, or "Wake up Tandrix"), or take a
// typed goal; screenshot what the user is looking at; ask or act across apps; queue follow-up tasks
// given while Tandrix is already working; point at the answer and always voice the response.
import {
  acknowledge,
  acknowledgeBackground,
  acknowledgeQueued,
  acknowledgeRedirect,
  helpKind,
  whileBusy,
  isNo,
  isYes,
  offerToDo,
  parseWakePhrase,
  TAP_MS,
  wantsLesson,
} from "@tandrix/core";
import type { ControlMode, Evidence } from "@tandrix/contracts";
import type { VoiceTurn } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenCapture } from "../../shared/bridge";
import { createBoard, type AgentTask, type Board } from "./agents";
import { api } from "./api";
import { runScreenTask } from "./screen-task";
import { startRecording, type Recording } from "./recorder";
import { uploadScreenshot } from "./screenshot";
import { recentExchanges } from "./exchanges";
import { markTried } from "./setup";
import { present, presentAnswer, presenceState } from "./presence";
import { localNow, runBackgroundTask } from "./background-agent";
import { base64 } from "./bytes";
import { browseCall } from "./browse";
import { isSpeaking, speak, stopSpeaking } from "./speech";
import { TALK_KEYS, type Presence } from "../../shared/bridge";

export type ShowMePhase = "idle" | "listening" | "working";

const WAKE_KEY = "tandrix.wakeWord";

export const NOTHING_HEARD = "Didn't hear anything. Hold ⌥⌘ while you talk, or type your question.";

export const NO_MIC =
  "Tandrix can't use the microphone. Allow it in System Settings > Privacy & Security > Microphone, or type your question.";
/** What's asked about: inside a job the screenshot is job evidence; outside one it isn't kept. */
type Shot = { capture: ScreenCapture; evidence: Evidence | null };

export function useShowMe(jobId: string | undefined) {
  const [phase, setPhase] = useState<ShowMePhase>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [problem, setProblem] = useState<string>();
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

  /** After Tandrix finishes saying something, listen for the answer (a yes to an offer). */
  const listenAfterSpeaking = async () => {
    const until = Date.now() + 12_000;
    // Speech starts a beat after it's asked for; then wait for it to end.
    await new Promise((r) => setTimeout(r, 400));
    while (isSpeaking() && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
    if (offerRef.current && phaseRef.current !== "listening") void listenRef.current("tap");
  };

  const shoot = useCallback(async (job: string | undefined): Promise<Shot> => {
    const capture = await window.tandrix.screen.capture();
    return { capture, evidence: job ? await uploadScreenshot(job, capture) : null };
  }, []);

  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  // Every task handed over: screen tasks one at a time, background ones alongside.
  const [agents, setAgents] = useState<AgentTask[]>([]);
  const boardRef = useRef<Board | null>(null);
  const board = (boardRef.current ??= createBoard({
    runScreen: async (task, io) => {
      // Acting needs Do it for me in the main process (and Accessibility); it's switched on for the
      // task and back afterwards unless the user keeps it on.
      const mode = await window.tandrix.doing.setMode("do");
      if (mode !== "do")
        return {
          status: "failed",
          reply:
            "To do things for you I need Accessibility access. Allow Tandrix in System Settings > Privacy & Security > Accessibility, then ask me again.",
        };
      await window.tandrix.doing.begin();
      try {
        return await runScreenTask(task, {
          capture: () => window.tandrix.screen.capture(),
          apps: () => window.tandrix.doing.apps(),
          openApp: (name) => window.tandrix.doing.openApp(name),
          turn: (req) => api.doStart(req),
          next: (req) => api.doContinue(req),
          run: (batch) => window.tandrix.doing.run(batch),
          say: (line) => {
            speak(line);
            present({
              state: "doing",
              label: line.slice(0, 120),
              keys: "Esc",
              keysHint: "to stop",
            });
          },
          steer: io.steer,
          stopped: io.stopped,
          settle: (ms) => new Promise((r) => setTimeout(r, ms)),
          base64,
        });
      } finally {
        await window.tandrix.doing.end();
        if (modeRef.current !== "do") await window.tandrix.doing.setMode("show");
      }
    },
    background: (task) =>
      runBackgroundTask(task, {
        ask: (body) => api.background(body),
        // Browsing needs the model, so it runs here; everything else runs on the Mac.
        runTool: (call) =>
          call.name === "browse" ? browseCall(call.arguments) : window.tandrix.agent.runTool(call),
        now: () => localNow(),
      }),
    onChange: setAgents,
    onFinish: (t) => {
      if (!t.result) return;
      if (t.kind === "background") {
        add({ speaker: "tandrix", text: t.detail ? `${t.result}\n\n${t.detail}` : t.result });
        void window.tandrix.panel.notify("Tandrix finished a task", t.result);
        // Not over the user while they're talking.
        if (phaseRef.current !== "listening") speak(t.result);
        return;
      }
      reply(t.result);
      markTried();
    },
  }));

  /** Tandrix's offer to do something, waiting for a yes. */
  const [offer, setOffer] = useState<string | null>(null);
  const offerRef = useRef<string | null>(null);
  const setPendingOffer = (task: string | null) => {
    offerRef.current = task;
    setOffer(task);
  };

  const startScreenTask = useCallback((task: string) => {
    reply(acknowledge(task));
    present({ state: "doing", label: "Starting", keys: "Esc", keysHint: "to stop" });
    board.addScreen(task);
  }, []);

  /** Show me: look at the screen, point at the answer, say it. */
  const showAnswer = useCallback(
    async (job: string | undefined, question: string, shot: Promise<Shot>, point = true) => {
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
      // While a task has the pointer, answer in words and leave the pointer to it.
      if (!point) return reply(r.reply);
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
    [],
  );

  /**
   * Everything said or typed goes through here. While a screen task runs, a remark stops it,
   * steers it, or becomes the next task; otherwise Tandrix shows the way, offers to do it, does
   * it, or works on it in the background.
   */
  const answer = useCallback(
    async (job: string | undefined, said: string, shot: Promise<Shot>, spoken = false) => {
      const pending = offerRef.current;
      if (pending) {
        setPendingOffer(null);
        if (isYes(said)) return startScreenTask(pending);
        if (isNo(said)) {
          reply("No problem, I'll show you instead.");
          return showAnswer(job, pending, shot);
        }
      }
      const kind = helpKind(said);
      if (board.screenBusy()) {
        // Only another job on the screen waits its turn; everything else starts now.
        const how = whileBusy(said);
        if (how === "stop") {
          board.stopScreen();
          await window.tandrix.doing.stop();
          return;
        }
        if (how === "redirect" && board.steer(said)) return reply(acknowledgeRedirect());
        if (how === "background") {
          board.addBackground(said);
          return reply(acknowledgeBackground());
        }
        if (how === "look") return showAnswer(job, said, shot, false);
        board.addScreen(said);
        return reply(acknowledgeQueued());
      }
      if (kind === "background") {
        board.addBackground(said);
        return reply(acknowledgeBackground());
      }
      if (kind === "do" || (kind === "offer" && modeRef.current === "do"))
        return startScreenTask(said);
      if (kind === "offer") {
        setPendingOffer(said);
        reply(offerToDo(said));
        // Spoken asks get a spoken answer: listen for the yes once the offer has been said.
        if (spoken) void listenAfterSpeaking();
        return;
      }
      return showAnswer(job, said, shot);
    },
    [showAnswer, startScreenTask],
  );

  /** Accept or decline the offer from the panel's buttons. */
  const acceptOffer = useCallback(() => {
    const task = offerRef.current;
    if (!task) return;
    setPendingOffer(null);
    startScreenTask(task);
  }, [startScreenTask]);
  const declineOffer = useCallback(() => {
    const task = offerRef.current;
    if (!task) return;
    setPendingOffer(null);
    reply("No problem, I'll show you instead.");
    void run(() => showAnswer(jobId, task, shoot(jobId)), {
      state: "looking",
      label: "Looking at your screen",
    });
  }, [jobId, showAnswer, shoot]);

  /** Does the work with the presence bar showing it's busy from the start. */
  const run = useCallback(async (work: () => Promise<void>, busy: Presence) => {
    setPhase("working");
    phaseRef.current = "working";
    workingRef.current = true;
    busyRef.current = busy;
    present(busy);
    try {
      await work();
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
  }, []);

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
      // Remarks while a task runs, and answers to an offer, are handled straight away.
      if (board.screenBusy() || offerRef.current || helpKind(effective) === "background") {
        void answer(jobId, effective, shoot(jobId));
        return;
      }
      // Still answering the last one: answer this alongside it rather than dropping it.
      if (phaseRef.current !== "idle") {
        void answer(jobId, effective, shoot(jobId));
        return;
      }
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
          present({ state: "thinking", label: "Thinking" });
          await answer(jobId, effective, shot, true);
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
    agents,
    offer,
    acceptOffer,
    declineOffer,
    clearFinished: () => board.clearFinished(),
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
