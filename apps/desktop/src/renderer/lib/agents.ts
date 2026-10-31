// Tandrix's agents: every task the user hands over, tracked from asked to finished. Tasks on the
// screen share one pair of hands (one mouse, one keyboard), so they run one after another; tasks
// that need no screen (look this up, draft that) run in the background, several at once, while
// the screen work carries on.
import type { BackgroundResult } from "./background-agent";
import type { ScreenTaskResult } from "./screen-task";

export type AgentStatus = "queued" | "running" | "done" | "stopped" | "stuck" | "failed";

export interface AgentTask {
  id: number;
  task: string;
  kind: "screen" | "background";
  status: AgentStatus;
  /** What Tandrix said when it finished. */
  result?: string;
  /** Background answers: the full text to read, and where it came from. */
  detail?: string;
  sources?: string[];
}

export interface BoardDeps {
  runScreen: (
    task: string,
    io: { steer: () => string[]; stopped: () => boolean },
  ) => Promise<ScreenTaskResult>;
  background: (task: string) => Promise<BackgroundResult>;
  /** The list changed. */
  onChange: (tasks: AgentTask[]) => void;
  /** A task finished (any way); say and show its result. */
  onFinish: (task: AgentTask) => void;
  /** Background tasks at once. */
  parallel?: number;
}

export interface Board {
  addScreen(task: string): AgentTask;
  addBackground(task: string): AgentTask;
  /** A correction for the screen task running now; false when none is running. */
  steer(text: string): boolean;
  /** Stops the screen task running now and drops the screen tasks waiting. */
  stopScreen(): void;
  /** A screen task is running. */
  screenBusy(): boolean;
  list(): AgentTask[];
  /** Clears finished tasks from the list. */
  clearFinished(): void;
}

export function createBoard(d: BoardDeps): Board {
  const parallel = d.parallel ?? 3;
  let tasks: AgentTask[] = [];
  let nextId = 1;
  let screenRunning: AgentTask | null = null;
  let steering: string[] = [];
  let stopRequested = false;
  let backgroundRunning = 0;

  const changed = () => d.onChange(tasks.map((t) => ({ ...t })));
  const update = (t: AgentTask, patch: Partial<AgentTask>) => {
    Object.assign(t, patch);
    changed();
  };
  const finish = (t: AgentTask, patch: Partial<AgentTask>) => {
    update(t, patch);
    d.onFinish({ ...t });
  };

  const pumpScreen = async () => {
    if (screenRunning) return;
    const t = tasks.find((x) => x.kind === "screen" && x.status === "queued");
    if (!t) return;
    screenRunning = t;
    steering = [];
    stopRequested = false;
    update(t, { status: "running" });
    try {
      const r = await d.runScreen(t.task, {
        steer: () => steering.splice(0),
        stopped: () => stopRequested,
      });
      finish(t, { status: r.status, result: r.reply });
    } catch (e) {
      finish(t, { status: "failed", result: (e as Error).message });
    } finally {
      screenRunning = null;
      // A stop ends only the task it was meant for; the next one starts clean.
      if (!stopRequested) void pumpScreen();
    }
  };

  const pumpBackground = () => {
    while (backgroundRunning < parallel) {
      const t = tasks.find((x) => x.kind === "background" && x.status === "queued");
      if (!t) return;
      backgroundRunning++;
      update(t, { status: "running" });
      void d
        .background(t.task)
        .then((r) =>
          r.status === "done"
            ? finish(t, { status: "done", result: r.spoken, detail: r.detail, sources: r.sources })
            : finish(t, { status: "failed", result: r.message }),
        )
        .catch((e: Error) => finish(t, { status: "failed", result: e.message }))
        .finally(() => {
          backgroundRunning--;
          pumpBackground();
        });
    }
  };

  const add = (task: string, kind: AgentTask["kind"]) => {
    const t: AgentTask = { id: nextId++, task, kind, status: "queued" };
    tasks = [...tasks, t];
    changed();
    if (kind === "screen") void pumpScreen();
    else pumpBackground();
    return t;
  };

  return {
    addScreen: (task) => add(task, "screen"),
    addBackground: (task) => add(task, "background"),
    steer(text) {
      if (!screenRunning) return false;
      steering.push(text);
      return true;
    },
    stopScreen() {
      stopRequested = true;
      for (const t of tasks) if (t.kind === "screen" && t.status === "queued") t.status = "stopped";
      changed();
    },
    screenBusy: () => screenRunning !== null,
    list: () => tasks.map((t) => ({ ...t })),
    clearFinished() {
      tasks = tasks.filter((t) => t.status === "queued" || t.status === "running");
      changed();
    },
  };
}
