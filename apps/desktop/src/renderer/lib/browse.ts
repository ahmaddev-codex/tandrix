// A background agent using a website: a hidden tab in Tandrix's own browser, worked by the same
// computer-use loop as the screen, but out of sight, so the user's screen, mouse and keyboard
// stay theirs. The tab is closed when it's done.
import type { DoBatch, DoBatchResult, ScreenCapture } from "../../shared/bridge";
import { api } from "./api";
import { base64 } from "./bytes";
import { runScreenTask, type ScreenTaskDeps } from "./screen-task";

export interface BrowseDeps {
  tabs: {
    open(url: string): Promise<number>;
    capture(id: number): Promise<ScreenCapture & { url: string }>;
    run(id: number, batch: DoBatch): Promise<DoBatchResult>;
    close(id: number): Promise<void> | void;
  };
  turn: ScreenTaskDeps["turn"];
  next: ScreenTaskDeps["next"];
}

const panelDeps = (): BrowseDeps => ({
  tabs: window.tandrix.browser,
  turn: (req) => api.doStart(req),
  next: (req) => api.doContinue(req),
});

const ABOUT = (goal: string) =>
  `You're working in a web browser window of your own, out of the user's sight; only this browser is on screen. To go to an address, press Cmd+L, type it, and press Return. Cmd+[ goes back. Goal: ${goal}\nWhen it's done, say in a sentence or two what you did and anything you found that the user would want.`;

export async function browse(
  goal: string,
  url: string,
  d: BrowseDeps = panelDeps(),
): Promise<string> {
  const { tabs } = d;
  const id = await tabs.open(url);
  let at = url;
  try {
    const r = await runScreenTask(ABOUT(goal), {
      capture: async () => {
        const shot = await tabs.capture(id);
        at = shot.url;
        return shot;
      },
      apps: async () => ({ apps: [] }),
      openApp: async () => false,
      // Each turn knows which page it's on (the page itself shows no address bar).
      turn: (req) =>
        d.turn({
          ...req,
          memory: [...req.memory, `The browser is at ${at.slice(0, 260)}`].slice(-40),
        }),
      next: (req) => d.next(req),
      run: (batch) => tabs.run(id, batch),
      say: () => undefined,
      steer: () => [],
      stopped: () => false,
      settle: (ms) => new Promise((r) => setTimeout(r, ms + 400)),
      base64,
    });
    return `${r.reply}\n(${r.status === "done" ? "Finished" : "Stopped"} at ${at})`;
  } finally {
    await tabs.close(id);
  }
}

/** The `browse` tool, from the model's JSON arguments. */
export async function browseCall(args: string, d?: BrowseDeps): Promise<string> {
  let a: { goal?: unknown; url?: unknown } = {};
  try {
    a = JSON.parse(args) as typeof a;
  } catch {
    return "The arguments weren't valid JSON.";
  }
  if (typeof a.goal !== "string" || typeof a.url !== "string" || !/^https:\/\//i.test(a.url))
    return "Needs a goal and an https URL.";
  return browse(a.goal.slice(0, 600), a.url.slice(0, 2000), d);
}
