// Show me and Do it for me in the panel: listen (hotkey, held mic, or "Wake up Tandrix"), or take a
// typed goal; screenshot what the user is looking at; ask or act across apps; queue follow-up tasks
// given while Tandrix is already working; point at the answer and always voice the response.
import {
  acknowledge,
  acknowledgeBackground,
  acknowledgeAdded,
  acknowledgeQueued,
  acknowledgeRedirect,
  helpKind,
  whileBusy,
  isNo,
  isYes,
  LOOK_ACKS,
  parseWakePhrase,
  TAP_MS,
  FOLLOW_UP_MS,
  wantsExplanation,
  wantsLesson,
} from "@tandrix/core";
import type { ControlMode, Evidence } from "@tandrix/contracts";
import type { VoiceTurn } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenCapture } from "../../shared/bridge";
import { createBoard, type AgentTask, type Board } from "./agents";
import { api, locateParts } from "./api";
import { runScreenTask, STOPPED_REPLY, type ScreenTaskResult } from "./screen-task";
import { startRecording, type Recording } from "./recorder";
import { startHearing, type Hearing } from "./hear";
import { markFor, nearestInk, readPixels } from "./ink";
import { placeQuote } from "./text-place";
import type { ScreenLocated } from "@tandrix/contracts";
import { loadWords } from "./words";
import { uploadScreenshot } from "./screenshot";
import { recentExchanges } from "./exchanges";
import { markTried } from "./setup";
import { present, presentAction, presentAnswer, presenceState } from "./presence";
import { localNow, runBackgroundTask } from "./background-agent";
import { base64 } from "./bytes";
import { browseCall } from "./browse";
import {
  acknowledgeNow,
  answerName,
  speakAndWait,
  loadMhm,
  isSpeaking,
  preloadVoice,
  sayingName,
  speak,
  stopSpeaking,
} from "./speech";
import { endReply, markReply, reportTask, startReply, taskMeter } from "./timings";
import { TALK_KEYS, type Presence } from "../../shared/bridge";

export type ShowMePhase = "idle" | "listening" | "working";
/**
 * How listening started. "tap": the question ends itself after a pause, or the hotkey again
 * (⌃⌥Space, a wake word). "keys": ⌥⌘ held, letting go asks. "hold": the panel's mic button.
 * "follow": after an answer, a few seconds for a follow-up without the wake word. "wake": the
 * wake word, ending like "tap"; it shows just "Listening", as the moment it was heard did, so the
 * island doesn't change as recording starts.
 */
type ListenHow = "tap" | "keys" | "hold" | "follow" | "wake";

const WAKE_KEY = "tandrix.wakeWord";
const WAKE_NAME_KEY = "tandrix.wakeName";
/** One word of letters, 3 to 20 long, as the helper takes it; null when it isn't one. */
export const wakeNameOf = (raw: string) => (/^\p{L}{3,20}$/u.test(raw.trim()) ? raw.trim() : null);

/** Said as an app command starts; already in Tandrix's voice on this Mac. */
const APP_ACK = "On it.";

/** How long an annotation stays: long enough to look, longer to follow a lesson or working. */
const ANSWER_HOLD_MS = 8000;
const TEACHING_HOLD_MS = 20_000;
/**
 * How long a part waits for its click before it's drawn where it was first placed. Clicks land
 * about six to nine seconds after the answer, while the intro is said; later parts are ready.
 */
const LOCATE_WAIT_MS = 6000;

/** Asked to do something while in Show me: said before showing the way. */
export const DO_IT_FOR_ME_OFF =
  "Do it for me is off, so here's how. To have me do it, turn on Do it for me in Settings.";

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
  // The name the wake word listens for (VO6): Tandrix unless the user chose another.
  const [wakeName, setWakeNameState] = useState(() => {
    try {
      return wakeNameOf(localStorage.getItem(WAKE_NAME_KEY) ?? "") ?? "Tandrix";
    } catch {
      return "Tandrix";
    }
  });
  const setWakeName = useCallback((raw: string) => {
    const name = wakeNameOf(raw);
    if (!name) return false;
    setWakeNameState(name);
    try {
      localStorage.setItem(WAKE_NAME_KEY, name);
    } catch {
      // Without storage it's just not remembered.
    }
    return true;
  }, []);
  const wakeNameRef = useRef(wakeName);
  wakeNameRef.current = wakeName;
  useEffect(() => {
    void window.tandrix.voice.setWakeName(wakeName);
  }, [wakeName]);
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
      .catch(() => undefined)
      // Signed in: the acknowledgements in Tandrix's voice, ready to play at once.
      .finally(() => void preloadVoice([...LOOK_ACKS, APP_ACK]).catch(() => undefined));
    void loadMhm();
  }, []);
  const recording = useRef<Recording | undefined>(undefined);
  /** The same question, heard on this Mac as it's said. */
  const hearing = useRef<Hearing | undefined>(undefined);
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

  /**
   * Esc stops an answer (VO): while Tandrix works one out, speaks or tours, Esc is claimed; once
   * it's quiet, Esc is let go. An answer still on its way when Esc came is dropped (answerEpoch).
   */
  const answerEpoch = useRef(0);
  /** The question whose answer is still being worked out, if one is. */
  const askingRef = useRef<{ question: string; epoch: number } | null>(null);
  const answeringRef = useRef(false);
  const quietWatch = useRef<ReturnType<typeof setInterval>>(undefined);
  const markAnswering = () => {
    if (!answeringRef.current) {
      answeringRef.current = true;
      void window.tandrix.voice.setAnswering(true).catch(() => undefined);
    }
    quietWatch.current ??= setInterval(() => {
      if (workingRef.current || isSpeaking() || touringRef.current) return;
      clearInterval(quietWatch.current);
      quietWatch.current = undefined;
      answeringRef.current = false;
      void window.tandrix.voice.setAnswering(false).catch(() => undefined);
    }, 400);
  };

  const add = (turn: VoiceTurn) => setTurns((t) => [...t, turn]);
  const reply = (text: string) => {
    markAnswering();
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

  // Every task handed over: screen tasks one at a time, background ones alongside.
  const [agents, setAgents] = useState<AgentTask[]>([]);
  /** App commands (SP6): done in a moment, so their result is said, not also notified. */
  const quickRef = useRef(new Set<number>());
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
      // A stop ends the task now. A model call still under way is left to finish and ignored: the
      // task sees it was stopped as soon as the call returns, and goes no further.
      const stopped = io.whenStopped.then((): ScreenTaskResult => ({
        status: "stopped",
        reply: STOPPED_REPLY,
      }));
      // Where the task's time goes, for the log: the model, acting, and looking at the screen.
      const meter = taskMeter();
      let outcome: ScreenTaskResult["status"] = "failed";
      try {
        const working = runScreenTask(task, {
          capture: () => meter.time("looking", () => window.tandrix.screen.capture()),
          apps: () => window.tandrix.doing.apps(),
          openApp: (name) => meter.time("acting", () => window.tandrix.doing.openApp(name)),
          turn: (req) => meter.time("model", () => api.doStart(req)),
          next: (req) => meter.time("model", () => api.doContinue(req)),
          front: () => window.tandrix.doing.front(),
          controls: () => meter.time("looking", () => window.tandrix.doing.controls()),
          note: async (req) => {
            const r = await meter.time("model", () => api.doNotes(req), false);
            return r.status === "done" ? r.note : null;
          },
          run: (batch) => meter.time("acting", () => window.tandrix.doing.run(batch)),
          // A progress line is dropped if the task has moved on by the time it could be said.
          say: (line, current) =>
            // Never over the user: while they're talking to it, progress goes unsaid.
            phaseRef.current !== "listening" ? speak(line, { stale: () => !current() }) : undefined,
          // The bar carries the user along: what it's doing now.
          doing: presentAction,
          steer: io.steer,
          stopped: io.stopped,
          settle: (ms) => new Promise((r) => setTimeout(r, ms)),
          base64,
        });
        const result = await Promise.race([working, stopped]);
        outcome = result.status;
        return result;
      } finally {
        reportTask(meter.end(outcome));
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
        if (!quickRef.current.delete(t.id))
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
    presentAction("Looking at your screen");
    board.addScreen(task);
  }, []);

  /** Show me: look at the screen, point at the answer, say it. */
  const showAnswer = useCallback(
    async (
      job: string | undefined,
      question: string,
      shot: Promise<Shot>,
      point = true,
      /** Said first, in the same breath ("Do it for me is off, so…"). */
      intro = "",
    ) => {
      // Said while the last answer is still being worked out: almost always an update to it ("and
      // label the arm too", "no, the cosine"). One answer to both, the earlier one dropped.
      const before = askingRef.current;
      if (before && before.epoch === answerEpoch.current) {
        answerEpoch.current++;
        question = `${before.question}\nThen I added: ${question}`.slice(-2000);
      }
      const epoch = answerEpoch.current;
      askingRef.current = { question, epoch };
      // Something heard straight away while the answer is worked out (SP7).
      if (acknowledgeNow()) markReply("acknowledged");
      const { capture, evidence } = await shot;
      markReply("captured");
      // Understanding something on screen is explained; learning an app is a lesson; the rest is
      // where to click.
      const explain = wantsExplanation(question);
      const lesson = !explain && wantsLesson(question);
      const named = userNameRef.current ? { userName: userNameRef.current } : {};
      const r =
        job && evidence
          ? await api.screenAsk(job, {
              evidenceId: evidence.id,
              transcript: question,
              geometry: capture.geometry,
              mode: "show",
              history: recentExchanges(turnsRef.current.slice(0, -1)),
              lesson,
              explain,
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
              explain,
              ...named,
            });
      markReply("answered");
      if (askingRef.current?.epoch === epoch) askingRef.current = null;
      // Stopped with Esc, or updated, while it was being worked out: nothing more from this one.
      if (epoch !== answerEpoch.current) return;
      if (r.status === "unavailable") return reply(r.message);
      answeredRef.current = true;
      // While a task has the pointer, answer in words and leave the pointer to it.
      const said = intro ? `${intro} ${r.reply}` : r.reply;
      if (!point) return reply(said);
      // What it wrote to show beside the frame; it stays longer while teaching or explaining, and
      // longer again with each part it labels.
      const annotation = {
        hold: (lesson || explain ? TEACHING_HOLD_MS : ANSWER_HOLD_MS) + r.regions.length * 2500,
        ...(r.note ? { note: r.note } : {}),
      };
      if (r.regions.length >= 2) {
        // Several parts: a tour, one at a time. Each is marked and named while Tandrix talks
        // about it, then fades as the next is marked; the whole explanation stays in the panel.
        const g = capture.geometry;
        const sx = g.displayWidth / g.imageWidth;
        const sy = g.displayHeight / g.imageHeight;
        add({ speaker: "tandrix", text: said });
        presentAnswer(said);
        markReply("pointed");
        markTried();
        // What it's about, with anything to say first ("Do it for me is off…").
        const about = r.intro ?? r.reply.split(/(?<=[.!?])\s/)[0] ?? "";
        const opening = [intro, about].filter(Boolean).join(" ");
        // The screenshot's pixels, so each touch lands on what's actually drawn there.
        // And its text, read on this Mac, so quoted words, code or a formula are marked exactly.
        const read = r.regions.some((p) => p.quote)
          ? window.tandrix.screen.text(capture.image, capture.mimeType).catch(() => [])
          : Promise.resolve([]);
        // Each drawn part clicked while Tandrix speaks (POST /screen/locate), so its mark lands on
        // it: drawn the moment its click is in, else after a short wait where it was first placed.
        const clicked = r.regions.map(() => {
          let done!: (v: ScreenLocated | null) => void;
          const wait = new Promise<ScreenLocated | null>((res) => (done = res));
          return { wait, done };
        });
        const toClick = r.regions.flatMap((p, i) => (p.quote ? [] : [i]));
        if (toClick.length)
          void locateParts(
            {
              screenshot: { mimeType: capture.mimeType, data: base64(capture.image) },
              geometry: capture.geometry,
              parts: toClick.map((i) => {
                const p = r.regions[i]!;
                return { label: p.label, detail: p.detail ?? null, box: p.box };
              }),
            },
            (l) => clicked[toClick[l.i]!]?.done(l),
          ).finally(() => clicked.forEach((c) => c.done(null)));
        else clicked.forEach((c) => c.done(null));
        const pixels = await readPixels(capture.image, capture.mimeType);
        touringRef.current = true;
        try {
          // Stopped (Esc, a new question, the wake word): the tour ends and its mark goes.
          if (opening && !(await speakAndWait(opening))) return void window.tandrix.overlay.clear();
          for (const [k, first] of r.regions.entries()) {
            const found = first.quote
              ? null
              : await Promise.race([
                  clicked[k]!.wait,
                  new Promise<null>((res) => setTimeout(() => res(null), LOCATE_WAIT_MS)),
                ]);
            const given = found
              ? { ...first, box: found.box, ...(found.point ? { point: found.point } : {}) }
              : first;
            const placed = given.quote ? placeQuote(await read, given.quote) : null;
            const part = placed
              ? {
                  ...given,
                  box: {
                    x: Math.round(placed.x),
                    y: Math.round(placed.y),
                    w: Math.max(1, Math.round(placed.w)),
                    h: Math.max(1, Math.round(placed.h)),
                  },
                  point: {
                    x: Math.round(placed.x + placed.w / 2),
                    y: Math.round(placed.y + placed.h / 2),
                  },
                }
              : given;
            const c = { x: part.box.x + part.box.w / 2, y: part.box.y + part.box.h / 2 };
            await window.tandrix.overlay.pointAt(
              g,
              { x: Math.round(c.x), y: Math.round(c.y) },
              "",
              {
                hold: 60_000,
                regions: [
                  {
                    dx: 0,
                    dy: 0,
                    width: Math.round(part.box.w * sx),
                    height: Math.round(part.box.h * sy),
                    label: part.label,
                    ...(part.detail ? { detail: part.detail } : {}),
                    // Where the pen touches it: the model's spot on the part, moved onto the nearest
                    // thing actually drawn there (a thin bone or line can be missed by 30 px);
                    // and the mark itself, from what's really on screen: along the curve, round
                    // the group, under the words.
                    ...(() => {
                      const want = part.point ?? c;
                      const on = pixels ? nearestInk(pixels, want) : want;
                      const strokes = pixels ? markFor(pixels, part.mark, part.box, want) : [];
                      return {
                        ax: Math.round((on.x - c.x) * sx),
                        ay: Math.round((on.y - c.y) * sy),
                        mark: {
                          kind: part.mark,
                          strokes: strokes.map((st) =>
                            st.flatMap(([x, y]) => [
                              Math.round((x - c.x) * sx),
                              Math.round((y - c.y) * sy),
                            ]),
                          ),
                        },
                      };
                    })(),
                  },
                ],
              },
            );
            const words =
              part.say ?? (part.detail ? `${part.label}: ${part.detail}.` : `${part.label}.`);
            if (!(await speakAndWait(words))) return void window.tandrix.overlay.clear();
            await new Promise((res) => setTimeout(res, 350));
          }
          // Done: the last mark fades.
          await window.tandrix.overlay.clear();
        } finally {
          touringRef.current = false;
        }
        return;
      }
      if (r.target?.geometry.kind === "box") {
        // One quoted thing (a formula, an error message): exactly where its text is.
        const quote = r.regions[0]?.quote;
        const placed = quote
          ? placeQuote(
              await window.tandrix.screen.text(capture.image, capture.mimeType).catch(() => []),
              quote,
            )
          : null;
        const b = placed
          ? {
              x: Math.round(placed.x) - 4,
              y: Math.round(placed.y) - 4,
              w: Math.round(placed.w) + 8,
              h: Math.round(placed.h) + 8,
            }
          : r.target.geometry.box;
        const center = { x: b.x + Math.round(b.w / 2), y: b.y + Math.round(b.h / 2) };
        const box = {
          width: Math.round((b.w * capture.geometry.displayWidth) / capture.geometry.imageWidth),
          height: Math.round((b.h * capture.geometry.displayHeight) / capture.geometry.imageHeight),
        };
        await window.tandrix.overlay.pointAt(capture.geometry, center, "", {
          box,
          ...annotation,
          ...(r.target.label && r.target.label !== "Here" ? { label: r.target.label } : {}),
        });
      } else if (r.target?.geometry.kind === "point") {
        await window.tandrix.overlay.pointAt(
          capture.geometry,
          r.target.geometry.point,
          "",
          annotation,
        );
      }
      markReply("pointed");
      reply(said);
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
    async (job: string | undefined, said: string, shot: Promise<Shot>) => {
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
        // Mostly an update to the task it's doing: the task takes it in as it works.
        if ((how === "redirect" || how === "add") && board.steer(said))
          return reply(how === "redirect" ? acknowledgeRedirect() : acknowledgeAdded());
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
      // Show me never acts, whatever was asked: it says Do it for me is off and shows the way.
      if ((kind === "do" || kind === "offer" || kind === "app") && modeRef.current !== "do")
        return showAnswer(job, said, shot, true, DO_IT_FOR_ME_OFF);
      // Calendar, Reminders, Notes, Music, Finder, Safari: done through the app, without the
      // pointer, and said when it's done.
      if (kind === "app") {
        quickRef.current.add(board.addBackground(said).id);
        return reply(APP_ACK);
      }
      if (kind === "do" || kind === "offer") return startScreenTask(said);
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

  /** How many runs are under way. */
  const runsRef = useRef(0);
  /** Does the work with the presence bar showing it's busy from the start. */
  const run = useCallback(async (work: () => Promise<void>, busy: Presence) => {
    runsRef.current++;
    markAnswering();
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
      // An update said mid-answer runs alongside the one it replaces: only the last to end, and
      // never while the user is talking, puts Tandrix back to idle.
      if (--runsRef.current === 0) {
        endReply();
        workingRef.current = false;
        busyRef.current = null;
        // The phase can have moved on while the work ran: the user may be talking now.
        if ((phaseRef.current as string) !== "listening") {
          setPhase("idle");
          phaseRef.current = "idle";
          // Work that ended without a reply leaves the screen clear.
          const shown = presenceState();
          if (shown === "thinking" || shown === "looking") present(null);
        }
      }
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
      const kindNow = helpKind(effective);
      if (board.screenBusy() || offerRef.current || kindNow === "background" || kindNow === "app") {
        void answer(jobId, effective, shoot(jobId));
        return;
      }
      // Still answering the last one: this is folded into it (an update) or answered after it.
      if (phaseRef.current !== "idle") {
        void answer(jobId, effective, shoot(jobId));
        return;
      }
      stopSpeaking();
      startReply("typed");
      void run(() => answer(jobId, effective, shoot(jobId)), {
        state: "looking",
        label: "Looking at your screen",
      });
    },
    [jobId, run, answer, shoot],
  );

  const listenRef = useRef<(how?: ListenHow) => Promise<void>>(async () => undefined);
  /** The listening now is a follow-up: silence ends it quietly. */
  const followingRef = useRef(false);
  /** The question being answered got a spoken answer, so a follow-up may come. */
  const answeredRef = useRef(false);
  /** Going through the parts of something one by one: no follow-up listening until it's over. */
  const touringRef = useRef(false);

  /** Once Tandrix has finished saying its answer, listen a few seconds for a follow-up (VO3). */
  const followUp = async () => {
    // However long the answer is: an explanation can run a minute or more. (Waiting only 30 s cut
    // explanations off mid-sentence, as listening stops speech.)
    const until = Date.now() + 180_000;
    await new Promise((r) => setTimeout(r, 300));
    while ((isSpeaking() || touringRef.current) && Date.now() < until)
      await new Promise((r) => setTimeout(r, 120));
    // A beat after its own voice ends, so the microphone never takes it for the user; and never
    // over it, if it's somehow still talking.
    await new Promise((r) => setTimeout(r, 250));
    if (isSpeaking()) return;
    if (phaseRef.current === "idle" && !recording.current && !offerRef.current)
      void listenRef.current("follow");
  };

  /** Ends the question: asks it if the user spoke; otherwise says so, sending nothing. */
  const finish = useCallback(
    async (step?: "send" | "nothing_heard") => {
      const rec = recording.current;
      recording.current = undefined;
      const local = hearing.current;
      hearing.current = undefined;
      if (!rec) return local?.cancel();
      void window.tandrix.voice.setListening(false);
      const following = followingRef.current;
      followingRef.current = false;
      if ((step ?? rec.ended()) === "nothing_heard") {
        rec.cancel();
        local?.cancel();
        restorePhase();
        // No follow-up came: the conversation ends quietly.
        if (following) {
          if (!workingRef.current) present(null);
          return;
        }
        add({ speaker: "tandrix", text: NOTHING_HEARD });
        speak(NOTHING_HEARD);
        if (!workingRef.current) return presentAnswer(NOTHING_HEARD);
        return;
      }
      // Timed from letting go to the first sound of the answer.
      startReply("voice");
      answeredRef.current = false;
      const epoch = answerEpoch.current;
      await run(
        async () => {
          const wav = await rec.stop();
          markReply("recorded");
          // Upload the screenshot while the question is transcribed.
          const shot = shoot(jobId);
          shot.catch(() => undefined);
          // Heard on this Mac as it was said; the server only when the Mac couldn't hear it.
          const said = await local?.end();
          const heard = said
            ? { status: "heard" as const, transcript: said }
            : await api.transcribe(wav, loadWords());
          markReply("transcribed");
          if (epoch !== answerEpoch.current) return;
          if (heard.status !== "heard") return reply(heard.message);
          const wake = parseWakePhrase(heard.transcript);
          if (wake.woke && !wake.remainder) {
            setTimeout(() => void listenRef.current("tap"), 50);
            return;
          }
          // Tandrix's own "mm-hm" can be caught at the start of the recording.
          const effective = (wake.woke ? wake.remainder : heard.transcript)
            .replace(/^\s*(?:m+[\s-]*h+m+|mhm+|hmm+|uh[\s-]*huh)[\s,.!?]*/i, "")
            .trim();
          if (!effective) return reply("I'm here. What would you like to do?");
          add({ speaker: "you", text: effective });
          present({ state: "looking", label: "Looking at your screen" });
          await answer(jobId, effective, shot);
        },
        { state: "thinking", label: "Working out what you said" },
      );
      if (answeredRef.current) void followUp();
    },
    [jobId, run, shoot, answer],
  );

  const listen = useCallback(
    async (how: ListenHow = "hold") => {
      // Listening barges in: allowed idle or while work runs in the background. stopSpeaking
      // below also keeps the mic from hearing Tandrix's own voice.
      if (phaseRef.current === "listening") return;
      setProblem(undefined);
      stopSpeaking();
      if (!(await window.tandrix.voice.micAccess())) return fail(NO_MIC);
      followingRef.current = how === "follow";
      const shown = {
        state: "listening" as const,
        label: how === "follow" ? "Still listening" : "Listening",
        ...(how === "keys"
          ? { keys: TALK_KEYS, keysHint: "Let go to ask" }
          : how === "tap"
            ? { keys: "⌃⌥Space", keysHint: "Pause, or press again to ask" }
            : {}),
      };
      try {
        hearing.current?.cancel();
        const heard = startHearing(undefined, loadWords());
        hearing.current = heard;
        recording.current = await startRecording(
          (step) => void finish(step),
          (level) => {
            if (recording.current) present({ ...shown, level });
          },
          (samples) => heard.push(samples),
        );
        if (how === "tap" || how === "wake") recording.current.tap();
        if (how === "follow") recording.current.tap(FOLLOW_UP_MS);
      } catch {
        hearing.current?.cancel();
        hearing.current = undefined;
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
    hearing.current?.cancel();
    hearing.current = undefined;
    followingRef.current = false;
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
  /** When the name was last chimed for, so the wake that follows doesn't chime again. */
  const chimedAt = useRef(0);
  useEffect(
    () =>
      window.tandrix.voice.onWakeHeard(() => {
        // Its own voice saying its name isn't a wake; the user saying it while it talks is.
        if (sayingName(wakeNameRef.current) || phaseRef.current === "listening") return;
        stopSpeaking();
        // Heard: "mm-hm" at once, while the user is still talking.
        answerName();
        chimedAt.current = Date.now();
        present({ state: "listening", label: "Listening" });
      }),
    [],
  );
  useEffect(
    () =>
      window.tandrix.voice.onWake((rest) => {
        // Tandrix saying its own name, or already listening, isn't a wake. Anything else is, even
        // mid-task or while it talks: the user is giving it something new, or changing what it's
        // doing. It stops talking and listens.
        if (sayingName(wakeNameRef.current) || phaseRef.current === "listening") return;
        stopSpeaking();
        if (Date.now() - chimedAt.current > 4000) answerName();
        if (rest) ask(rest);
        else void listen("wake");
      }),
    [ask, listen],
  );

  // Esc while answering: stop talking, end the tour, clear the marks and the island, and drop
  // whatever answer is still on its way.
  useEffect(
    () =>
      window.tandrix.voice.onAnswerStop(() => {
        answerEpoch.current++;
        touringRef.current = false;
        stopSpeaking();
        void window.tandrix.overlay.clear();
        present(null);
        if (phaseRef.current === "working") {
          workingRef.current = false;
          setPhase("idle");
          phaseRef.current = "idle";
        }
      }),
    [],
  );

  // Esc or the hotkey during a task: stop talking and end it now.
  useEffect(
    () =>
      window.tandrix.doing.onStopped(() => {
        stopSpeaking();
        board.stopScreen();
      }),
    [],
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
    wakeName,
    setWakeName,
    wakeStatus,
    ask,
    press,
    release,
    cancel,
    mode,
    setMode,
  };
}
