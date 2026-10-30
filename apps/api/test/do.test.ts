// Do it for me turns: sessions are bound to the user and count turns; nothing runs on the server.
import { DO_MAX_TURNS, DoTurnResponse } from "@tandrix/contracts";
import type { DoTurn } from "@tandrix/ai";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../src/auth";
import { HttpError } from "../src/errors";
import { DO_SESSION_MS, inlineScreenRoutes } from "../src/routes/screen";
import type { ScreenDoer } from "../src/screen-doer";
import { noModelScreenGuide } from "../src/screen-guide";
import { PNG } from "./fixtures";

const SECRET = "test-secret-test-secret-test-secret!";
const turn = (over: Partial<DoTurn> = {}): DoTurn => ({
  responseId: "resp_1",
  callId: "call_1",
  actions: [{ type: "click", x: 10, y: 20, button: "left" }],
  dropped: 0,
  safetyChecks: [],
  reply: "",
  ...over,
});

function setup(script: DoTurn[] = [turn()], planned: string | null = null) {
  let clock = Date.UTC(2026, 9, 27, 12);
  const seen: Array<Record<string, unknown>> = [];
  const doer: ScreenDoer = {
    async plan(i) {
      seen.push({ kind: "plan", apps: i.apps, frontApp: i.frontApp });
      return planned;
    },
    async start(i) {
      seen.push({ kind: "start", task: i.task, ...(i.memory?.length ? { memory: i.memory } : {}) });
      return { status: "turn", turn: script.shift() ?? turn({ callId: null, actions: [] }) };
    },
    async continue(i) {
      seen.push({ kind: "continue", ...i, screenshot: undefined });
      return { status: "turn", turn: script.shift() ?? turn({ callId: null, actions: [] }) };
    },
  };
  const app = (user: string) => {
    const a = new Hono<AuthEnv>();
    a.use(async (c, next) => {
      c.set("user", { id: user } as never);
      await next();
    });
    a.route(
      "/screen",
      inlineScreenRoutes({
        guide: noModelScreenGuide,
        doer,
        tokenSecret: SECRET,
        now: () => clock,
      }),
    );
    a.onError((e, c) => c.json({ error: e.message }, e instanceof HttpError ? e.status : 500));
    return a;
  };
  const geometry = {
    displayId: "1",
    imageWidth: 10,
    imageHeight: 10,
    originX: 0,
    originY: 0,
    displayWidth: 10,
    displayHeight: 10,
  };
  const screenshot = { mimeType: "image/png", data: Buffer.from(PNG).toString("base64") };
  const post = async (user: string, path: string, body: object) => {
    const res = await app(user).request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: res.ok ? DoTurnResponse.parse(await res.json()) : null };
  };
  const start = (user = "u1", extra: object = {}) =>
    post(user, "/screen/do", { screenshot, geometry, task: "Turn on notifications", ...extra });
  const next = (session: string, user = "u1", acknowledged: object[] = []) =>
    post(user, "/screen/do/continue", { session, screenshot, geometry, acknowledged });
  const background = async (body: object, withWorker = true) => {
    if (withWorker)
      doer.background = async (task) => ({
        status: "done",
        spoken: `Found it: ${task}`,
        detail: "All of it.",
        sources: [],
      });
    else delete doer.background;
    const res = await app("u1").request("/screen/background", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { start, next, seen, background, doer, app, advance: (ms: number) => (clock += ms) };
}

const act = (b: DoTurnResponse | null) => {
  if (b?.status !== "act") throw new Error(`expected act, got ${JSON.stringify(b)}`);
  return b;
};

describe("POST /screen/do", () => {
  it("returns the actions to run and a session to continue with", async () => {
    const s = setup();
    const r = act((await s.start()).body);
    expect(r).toMatchObject({ turn: 1, actions: [{ type: "click", x: 10, y: 20 }] });
    expect(r.session.startsWith("resp_1~call_1~1~")).toBe(true);
    expect(s.seen).toContainEqual({ kind: "start", task: "Turn on notifications" });
  });

  it("opens the app the task needs first, then starts once it's open", async () => {
    const apps = ["Calendar", "System Settings"];
    const s = setup([turn()], "system settings");
    const first = await s.start("u1", { apps, frontApp: "Finder" });
    expect(first.body).toEqual({ status: "open_app", app: "System Settings" });
    expect(s.seen.some((x) => x.kind === "start")).toBe(false);
    const again = act(
      (await s.start("u1", { apps, frontApp: "System Settings", planned: true })).body,
    );
    expect(again.turn).toBe(1);
  });

  it("never names an app the Mac didn't list, or the one already in front", async () => {
    expect(
      (await setup([turn()], "Terminal").start("u1", { apps: ["Calendar"] })).body?.status,
    ).toBe("act");
    expect(
      (await setup([turn()], "Calendar").start("u1", { apps: ["Calendar"], frontApp: "Calendar" }))
        .body?.status,
    ).toBe("act");
  });

  it("continues with the next screen and the checks the user accepted", async () => {
    // Real check ids run to about a thousand characters.
    const check = {
      id: `cu_sc_${"Q".repeat(1000)}`,
      code: "computer_action_requires_confirmation",
      message: "Review",
    };
    const s = setup([turn(), turn({ responseId: "resp_2", callId: "call_2" })]);
    const first = act((await s.start()).body);
    const second = act((await s.next(first.session, "u1", [check])).body);
    expect(second.turn).toBe(2);
    expect(s.seen.find((x) => x.kind === "continue")).toMatchObject({
      kind: "continue",
      previousResponseId: "resp_1",
      callId: "call_1",
      acknowledged: [check],
    });
  });

  it("is done when the model stops proposing actions", async () => {
    const s = setup([turn(), turn({ callId: null, actions: [], reply: "Notifications are on." })]);
    const first = act((await s.start()).body);
    expect((await s.next(first.session)).body).toEqual({
      status: "done",
      reply: "Notifications are on.",
    });
  });

  it("refuses another user's session, a forged one and an expired one", async () => {
    const s = setup([turn(), turn(), turn()]);
    const first = act((await s.start()).body);
    expect((await s.next(first.session, "u2")).status).toBe(400);
    expect((await s.next(first.session.replace("~1~", "~0~"))).status).toBe(400);
    s.advance(DO_SESSION_MS + 1);
    expect((await s.next(first.session)).status).toBe(400);
  });

  it("hands control back after the turn limit", async () => {
    const s = setup(Array.from({ length: DO_MAX_TURNS + 2 }, () => turn()));
    let r = act((await s.start()).body);
    for (let i = 1; i < DO_MAX_TURNS; i++) r = act((await s.next(r.session)).body);
    const last = (await s.next(r.session)).body;
    expect(last).toMatchObject({ status: "done", reply: expect.stringContaining("control back") });
  });

  it("says plainly when the model isn't available", async () => {
    const a = new Hono<AuthEnv>();
    a.use(async (c, next) => {
      c.set("user", { id: "u1" } as never);
      await next();
    });
    a.route("/screen", inlineScreenRoutes({ guide: noModelScreenGuide, tokenSecret: SECRET }));
    const res = await a.request("/screen/do", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        screenshot: { mimeType: "image/png", data: Buffer.from(PNG).toString("base64") },
        geometry: {
          displayId: "1",
          imageWidth: 1,
          imageHeight: 1,
          originX: 0,
          originY: 0,
          displayWidth: 1,
          displayHeight: 1,
        },
        task: "x",
      }),
    });
    expect(DoTurnResponse.parse(await res.json())).toMatchObject({ status: "unavailable" });
  });
});

describe("fresh turns with memory", () => {
  it("passes what's been done to the model and keeps the turn count", async () => {
    const s = setup();
    const r = act(
      (
        await s.start("u1", {
          planned: true,
          turn: 7,
          memory: ["Opened Notes", "Clicked Shopping"],
        })
      ).body,
    );
    expect(r.turn).toBe(7);
    expect(s.seen).toContainEqual({
      kind: "start",
      task: "Turn on notifications",
      memory: ["Opened Notes", "Clicked Shopping"],
    });
  });

  it("hands control back at the ceiling instead of running forever", async () => {
    const s = setup();
    const r = (await s.start("u1", { planned: true, turn: DO_MAX_TURNS })).body;
    expect(r?.status).toBe("act");
    expect(DO_MAX_TURNS).toBeGreaterThanOrEqual(100);
  });
});

describe("POST /screen/do/notes", () => {
  it("writes down what the screen holds for the task, or says it's unavailable", async () => {
    const s = setup();
    const ask = (body: object) =>
      s.app("u1").request("/screen/do/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const shot = { mimeType: "image/png", data: Buffer.from("png").toString("base64") };
    expect((await (await ask({ screenshot: shot, task: "x" })).json()).status).toBe("unavailable");
    s.doer.notes = async ({ task }) => ({ note: `Acme Tue 10:00 (for ${task})` });
    expect(await (await ask({ screenshot: shot, task: "add it" })).json()).toEqual({
      status: "done",
      note: "Acme Tue 10:00 (for add it)",
    });
    expect((await ask({ task: "no screenshot" })).status).toBe(400);
  });
});

describe("POST /screen/background", () => {
  it("does a task with no screen and answers what to say and what to read", async () => {
    const s = setup();
    const r = await s.background({ task: "When does the store close?" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      status: "done",
      spoken: "Found it: When does the store close?",
      detail: "All of it.",
      sources: [],
    });
  });

  it("asks the Mac to run tools, then answers once their outputs come back", async () => {
    const s = setup();
    const seen: object[] = [];
    const steps = [
      { id: "c1", name: "reminders_add", arguments: '{"title":"Call Sam"}', output: '{"ok":true}' },
    ];
    s.doer.background = async (task, opts) => {
      seen.push({ task, ...opts });
      return opts?.steps?.length
        ? { status: "done", spoken: "Added it.", detail: "Reminder: Call Sam.", sources: [] }
        : {
            status: "call",
            calls: [{ id: "c1", name: "reminders_add", arguments: '{"title":"Call Sam"}' }],
          };
    };
    const ask = (body: object) =>
      s.app("u1").request("/screen/background", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const first = await (
      await ask({ task: "Remind me to call Sam", tools: true, now: "2026-10-30T09:00+01:00" })
    ).json();
    expect(first).toEqual({
      status: "call",
      calls: [{ id: "c1", name: "reminders_add", arguments: '{"title":"Call Sam"}' }],
    });
    const second = await (await ask({ task: "Remind me to call Sam", tools: true, steps })).json();
    expect(second.status).toBe("done");
    expect(seen[0]).toMatchObject({ tools: true, steps: [], now: "2026-10-30T09:00+01:00" });
    expect(seen[1]).toMatchObject({ steps });
  });

  it("refuses a tool the Mac doesn't have", async () => {
    const s = setup();
    const r = await s.background({
      task: "x",
      tools: true,
      steps: [{ id: "c", name: "shell_run", arguments: "{}", output: "" }],
    });
    expect(r.status).toBe(400);
  });

  it("says it's unavailable without a model, and refuses an empty task", async () => {
    const s = setup();
    expect((await s.background({ task: "x" }, false)).body.status).toBe("unavailable");
    expect((await s.background({ task: "" })).status).toBe(400);
  });
});
