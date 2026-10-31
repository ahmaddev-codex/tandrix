/**
 * The Do it for me bench: runs the real task runner (screen-task.ts) and action runner (do-it.ts)
 * against the local API on the real models, on a synthetic Mac (fixtures/screens/desktop.html:
 * WhatsApp, Calendar, Spotlight, a dock) shown in an Electron window and driven with real input
 * events. Nothing touches this Mac's own apps. Each task is scored against what it should have done.
 * Start the API first (`pnpm --filter @tandrix/api dev`), then:
 *   pnpm --filter @tandrix/desktop task-bench [task id…] [--runs N]
 * About two to five cents a task.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import type { DoTurnResponse } from "@tandrix/contracts";
import { sketchOf } from "../src/main/capture";
import { runBatch } from "../src/main/do-it";
import type { DriverCommand, DriverReply } from "../src/main/input-driver";
import { runScreenTask } from "../src/renderer/lib/screen-task";
import type { ScreenCapture } from "../src/shared/bridge";

// Bundled into dist/ and run from apps/desktop (see package.json).
const root = join(process.cwd(), "../..");
const env: Record<string, string> = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1]!, m[2]!]),
);
const API = env.API_PUBLIC_URL ?? "http://localhost:8787";
const W = 1280;
const H = 800;

interface State {
  events: Array<{ title: string; date: string; start: string; end: string }>;
  sent: Array<{ to: string; text: string }>;
  front: string;
}
interface Task {
  id: string;
  ask: string;
  /** Empty when everything that should have happened did; else what's wrong. */
  score: (s: State) => string[];
}

/** "3pm", "3:00 PM", "15:00" and "09:00" as minutes after midnight. */
function minutes(t: string): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(t);
  if (!m) return null;
  let h = Number(m[1]) % (m[3] ? 12 : 24);
  if (m[3]?.toLowerCase() === "pm") h += 12;
  return h * 60 + Number(m[2] ?? 0);
}

const has = (s: State, title: RegExp, day: string, start: string) =>
  s.events.some(
    (e) =>
      title.test(e.title) &&
      new RegExp(`\\b${day}\\b`).test(e.date) &&
      minutes(e.start) === minutes(start),
  );

const TASKS: Task[] = [
  {
    id: "interviews",
    ask: "Go to my WhatsApp and grab the chat with the interview lineups and add them to my calendar",
    score: (s) => [
      ...(has(s, /acme/i, "3", "10:00") ? [] : ["Acme Tue 3 Nov 10:00 missing"]),
      ...(has(s, /globex/i, "4", "14:30") ? [] : ["Globex Wed 4 Nov 14:30 missing"]),
      ...(has(s, /initech/i, "6", "09:00") ? [] : ["Initech Fri 6 Nov 09:00 missing"]),
      ...(s.events.length > 3 ? [`${s.events.length} events, expected 3`] : []),
    ],
  },
  {
    id: "message",
    ask: "Text Sam on WhatsApp that I'm free for lunch tomorrow",
    score: (s) => {
      const toSam = s.sent.filter((m) => /sam/i.test(m.to));
      return [
        ...(toSam.length === 1 ? [] : [`${toSam.length} messages to Sam, expected 1`]),
        ...(toSam.some((m) => /lunch/i.test(m.text)) ? [] : ["message doesn't mention lunch"]),
        ...(s.sent.length > toSam.length ? ["messaged someone else"] : []),
      ];
    },
  },
  {
    id: "event",
    ask: "Add a dentist appointment to my calendar on Thursday 5 November from 3pm to 3:30pm",
    score: (s) => [
      ...(has(s, /dentist/i, "5", "15:00") ? [] : ["Dentist Thu 5 Nov 15:00 missing"]),
      ...(s.events.length > 1 ? [`${s.events.length} events, expected 1`] : []),
    ],
  },
];

const args = process.argv.slice(2);
const runsAt = args.indexOf("--runs");
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 1;
const verbose = args.includes("--verbose");
const only = args.filter((a, i) => !a.startsWith("--") && (runsAt < 0 || i !== runsAt + 1));
const tasks = TASKS.filter((t) => !only.length || only.includes(t.id));

async function token(): Promise<string> {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ email: env.DEV_USER_EMAIL, password: env.DEV_USER_PASSWORD }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Electron key codes for the names the model uses ("cmd", "space", "enter"). */
const MODIFIERS: Record<string, "meta" | "control" | "alt" | "shift"> = {
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  ctrl: "control",
  control: "control",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
};
const KEYS: Record<string, string> = {
  space: "Space",
  spacebar: "Space",
  " ": "Space",
  enter: "Return",
  return: "Return",
  esc: "Escape",
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Backspace",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
};

async function bench(win: BrowserWindow, task: Task, bearer: string) {
  await win.loadFile(join(root, "fixtures/screens/desktop.html"));
  const wc = win.webContents;
  const send = (e: Parameters<typeof wc.sendInputEvent>[0]) => wc.sendInputEvent(e);
  const pause = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));
  const drive = async (cmd: DriverCommand): Promise<DriverReply> => {
    switch (cmd.op) {
      case "move":
        send({ type: "mouseMove", x: cmd.x, y: cmd.y });
        break;
      case "click": {
        const button = cmd.button === "right" ? "right" : "left";
        send({ type: "mouseMove", x: cmd.x, y: cmd.y });
        for (let i = 1; i <= (cmd.count ?? 1); i++) {
          send({ type: "mouseDown", x: cmd.x, y: cmd.y, button, clickCount: i });
          send({ type: "mouseUp", x: cmd.x, y: cmd.y, button, clickCount: i });
        }
        break;
      }
      case "drag": {
        const [first, ...rest] = cmd.path;
        send({ type: "mouseDown", x: first!.x, y: first!.y, button: "left", clickCount: 1 });
        for (const p of rest) send({ type: "mouseMove", x: p.x, y: p.y });
        const last = cmd.path.at(-1)!;
        send({ type: "mouseUp", x: last.x, y: last.y, button: "left", clickCount: 1 });
        break;
      }
      case "scroll":
        send({ type: "mouseWheel", x: cmd.x, y: cmd.y, deltaX: -cmd.dx, deltaY: -cmd.dy });
        break;
      case "type":
        for (const ch of cmd.text) {
          // A tab moves to the next field, as on a real keyboard.
          if (ch === "\t") {
            send({ type: "keyDown", keyCode: "Tab" });
            send({ type: "keyUp", keyCode: "Tab" });
          } else if (ch === "\n") {
            send({ type: "keyDown", keyCode: "Return" });
            send({ type: "char", keyCode: "\r" });
            send({ type: "keyUp", keyCode: "Return" });
          } else send({ type: "char", keyCode: ch });
        }
        break;
      case "keys": {
        const names = cmd.keys.map((k) => k.toLowerCase());
        const modifiers = names.flatMap((k) => (MODIFIERS[k] ? [MODIFIERS[k]] : []));
        const key = names.find((k) => !MODIFIERS[k]);
        if (key) {
          const keyCode = KEYS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
          send({ type: "keyDown", keyCode, modifiers });
          if (keyCode === "Return" && !modifiers.length) send({ type: "char", keyCode: "\r" });
          send({ type: "keyUp", keyCode, modifiers });
        }
        break;
      }
      case "focus":
        return { ok: true, secure: false };
      case "front":
        return { ok: true, app: await wc.executeJavaScript("__state.front") };
    }
    await pause(60);
    return { ok: true };
  };

  const capture = async (): Promise<ScreenCapture> => {
    const img = (await wc.capturePage()).resize({ width: W, quality: "best" });
    return {
      sketch: sketchOf(img),
      image: new Uint8Array(img.toJPEG(80)),
      mimeType: "image/jpeg",
      capturedAt: new Date().toISOString(),
      geometry: {
        displayId: "1",
        imageWidth: W,
        imageHeight: img.getSize().height,
        originX: 0,
        originY: 0,
        displayWidth: W,
        displayHeight: H,
      },
    };
  };
  const call = async <T>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await r.json()) as T;
  };

  const history: number[] = [];
  let turns = 0;
  const started = Date.now();
  const result = await runScreenTask(task.ask, {
    capture,
    apps: async () => ({ apps: ["WhatsApp", "Calendar", "Notes", "Finder"], front: "Finder" }),
    openApp: async (name) => wc.executeJavaScript(`__openApp(${JSON.stringify(name)})`),
    turn: async (req) => {
      turns++;
      return call<DoTurnResponse>("/screen/do", req);
    },
    next: async (req) => {
      turns++;
      return call<DoTurnResponse>("/screen/do/continue", req);
    },
    note: async (req) => {
      const r = await call<{ status: string; note?: string }>("/screen/do/notes", req);
      return r.status === "done" ? (r.note ?? null) : null;
    },
    front: async () => wc.executeJavaScript("__state.front"),
    run: (batch) => (
      verbose &&
        console.log(
          `    does: ${batch.actions.map((a) => JSON.stringify(a).replace(/"type":/, "")).join(" ")}`.slice(
            0,
            400,
          ),
        ),
      runBatch(batch, {
        mode: () => "do",
        drive,
        confirm: async () => true,
        announce: () => undefined,
        waitOrStop: async (ms) => (await pause(Math.min(ms, 120)), false),
        stopped: () => false,
        now: Date.now,
        history,
      })
    ),
    say: (line) => console.log(`    says: ${line}`),
    steer: () => [],
    stopped: () => false,
    settle: pause,
    base64: (b) => Buffer.from(b).toString("base64"),
  });
  const state = (await wc.executeJavaScript("__state")) as State;
  const wrong = task.score(state);
  return { result, wrong, turns, seconds: Math.round((Date.now() - started) / 1000), state };
}

app.dock?.hide();
app.on("window-all-closed", () => undefined);
app.whenReady().then(async () => {
  const bearer = await token();
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true });
  let passed = 0;
  let total = 0;
  for (const task of tasks)
    for (let run = 1; run <= runs; run++) {
      total++;
      console.log(`\n${task.id} (run ${run}): ${task.ask}`);
      const r = await bench(win, task, bearer).catch((e: Error) => ({
        result: { status: "failed", reply: e.message },
        wrong: ["crashed"],
        turns: 0,
        seconds: 0,
        state: null,
      }));
      if (!r.wrong.length && r.result.status === "done") passed++;
      console.log(
        `  ${!r.wrong.length && r.result.status === "done" ? "PASS" : "FAIL"} ${r.result.status} in ${r.turns} turns, ${r.seconds} s: ${r.result.reply.slice(0, 120)}`,
      );
      for (const w of r.wrong) console.log(`    wrong: ${w}`);
      if (r.wrong.length && r.state)
        console.log(`    state: ${JSON.stringify(r.state).slice(0, 400)}`);
    }
  console.log(`\n${passed} of ${total} tasks done right.`);
  app.quit();
});
