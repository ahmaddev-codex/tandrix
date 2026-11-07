// How long each stage of a reply takes, from the moment the user finishes asking to the first
// sound, on the Mac and the phone alike. Numbers only: never the words, the audio or the screen.
export type ReplyStage =
  | "recorded"
  | "transcribed"
  | "acknowledged"
  | "captured"
  | "answered"
  | "pointed"
  | "voiced"
  | "sounding";

export const REPLY_STAGES: readonly ReplyStage[] = [
  "recorded",
  "transcribed",
  "acknowledged",
  "captured",
  "answered",
  "pointed",
  "voiced",
  "sounding",
];

export interface ReplyTiming {
  kind: "voice" | "typed";
  /** From the start of the reply to its end, in milliseconds. */
  total: number;
  /** When each stage finished, in milliseconds from the start. */
  stages: Partial<Record<ReplyStage, number>>;
}

export interface Stopwatch {
  /** The first mark of a stage counts; later ones are ignored. */
  mark(stage: ReplyStage): void;
  /** Reports once; later calls do nothing. */
  end(): void;
}

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function stopwatch(
  kind: ReplyTiming["kind"],
  report: (t: ReplyTiming) => void,
  now: () => number = clock,
): Stopwatch {
  const started = now();
  const stages: ReplyTiming["stages"] = {};
  let ended = false;
  const since = () => Math.round(now() - started);
  return {
    mark(stage) {
      if (!ended && stages[stage] === undefined) stages[stage] = since();
    },
    end() {
      if (ended) return;
      ended = true;
      report({ kind, total: since(), stages });
    },
  };
}

export interface ReplyClock {
  /** Starts timing a reply, ending the last one if it's still open. */
  start(kind: ReplyTiming["kind"], report?: (t: ReplyTiming) => void): void;
  mark(stage: ReplyStage): void;
  /** Ends the reply now, unless its voice has taken it over to time the first sound. */
  end(): void;
  /** The voice takes the reply's stopwatch, so the reply's work ending doesn't end it. */
  take(): Stopwatch | null;
}

/** One reply timed at a time, reported to `report` unless a start names another. */
export function replyClock(report: (t: ReplyTiming) => void): ReplyClock {
  let active: Stopwatch | null = null;
  return {
    start(kind, to = report) {
      active?.end();
      active = stopwatch(kind, to);
    },
    mark(stage) {
      active?.mark(stage);
    },
    end() {
      active?.end();
      active = null;
    },
    take() {
      const taken = active;
      active = null;
      return taken;
    },
  };
}

/** A Do it for me task: how long it took, in how many turns, and where the time went. */
export interface TaskTiming {
  kind: "task";
  total: number;
  turns: number;
  /** Milliseconds spent waiting on the model, acting on the screen, and taking screenshots. */
  model: number;
  acting: number;
  looking: number;
  status: "done" | "stopped" | "stuck" | "failed";
}

export interface TaskMeter {
  /** Times one piece of work under a heading; a model call counts as a turn unless `turn` is false. */
  time<T>(part: "model" | "acting" | "looking", work: () => Promise<T>, turn?: boolean): Promise<T>;
  end(status: TaskTiming["status"]): TaskTiming;
}

export function taskMeter(now: () => number = clock): TaskMeter {
  const started = now();
  const spent = { model: 0, acting: 0, looking: 0 };
  let turns = 0;
  return {
    async time(part, work, turn = part === "model") {
      if (turn) turns++;
      const t = now();
      try {
        return await work();
      } finally {
        spent[part] += now() - t;
      }
    },
    end(status) {
      return {
        kind: "task",
        total: Math.round(now() - started),
        turns,
        model: Math.round(spent.model),
        acting: Math.round(spent.acting),
        looking: Math.round(spent.looking),
        status,
      };
    },
  };
}

const ms = (v: unknown, most = 600_000): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= most;
const STAGE_SET = new Set<string>(REPLY_STAGES);
const STATUSES = new Set(["done", "stopped", "stuck", "failed"]);
/** A task can run for a while; half an hour is the most a timing claims. */
const TASK_MOST = 1_800_000;

/**
 * The log line for a timing, or null when it isn't one. Only a kind, a status and whole numbers
 * under known names get through, so nothing the user said or saw can end up in a log line.
 */
export function timingLine(raw: unknown): Record<string, string | number> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "task") {
    const { total, turns, model, acting, looking, status } = r;
    if (
      !ms(total, TASK_MOST) ||
      !ms(turns, 1000) ||
      !ms(model, TASK_MOST) ||
      !ms(acting, TASK_MOST) ||
      !ms(looking, TASK_MOST) ||
      typeof status !== "string" ||
      !STATUSES.has(status)
    )
      return null;
    return { event: "task_timing", status, total, turns, model, acting, looking };
  }
  const { kind, total, stages } = r;
  if ((kind !== "voice" && kind !== "typed") || !ms(total)) return null;
  const line: Record<string, string | number> = { event: "reply_timing", kind, total };
  if (typeof stages === "object" && stages !== null)
    for (const [stage, at] of Object.entries(stages))
      if (STAGE_SET.has(stage) && ms(at)) line[stage] = at;
  return line;
}
