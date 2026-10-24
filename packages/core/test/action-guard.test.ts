import type { DesktopAction } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { guardAction, guardLimits, type GuardContext } from "../src";

const NOW = 1_000_000;
const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({
  mode: "do",
  intent: "Turn on dry-run protection.",
  targetLabel: "Dry-run protection",
  actionsThisRequest: 0,
  recentActionTimes: [],
  now: NOW,
  ...over,
});
const click: DesktopAction = { type: "click", x: 400, y: 300, button: "left" };

describe("mode", () => {
  it("never acts in Show me mode", () => {
    const r = guardAction(click, ctx({ mode: "show" }));
    expect(r).toMatchObject({ decision: "deny", code: "show_mode" });
  });
});

describe("ordinary actions", () => {
  it("allows a plain click, scroll and typing a value", () => {
    expect(guardAction(click, ctx()).decision).toBe("allow");
    expect(
      guardAction({ type: "scroll", x: 1, y: 1, scroll_x: 0, scroll_y: 300 }, ctx()).decision,
    ).toBe("allow");
    expect(
      guardAction(
        { type: "type", text: "6.0" },
        ctx({ intent: "Set the pressure limit to 6.0 bar." }),
      ).decision,
    ).toBe("allow");
  });

  it("always allows passive actions, even at the limit", () => {
    const busy = ctx({ actionsThisRequest: 999, recentActionTimes: [NOW - 1] });
    for (const a of [
      { type: "move", x: 1, y: 1 },
      { type: "screenshot" },
      { type: "wait" },
    ] as DesktopAction[]) {
      expect(guardAction(a, busy).decision).toBe("allow");
    }
  });
});

describe("sensitive actions ask first", () => {
  const cases: Array<[string, Partial<GuardContext>, string]> = [
    ["payment", { intent: "Click Place order to finish.", targetLabel: "Place order" }, "payment"],
    ["send", { intent: "Send the report to your manager.", targetLabel: "Send" }, "send"],
    ["delete", { intent: "Remove the old schedule.", targetLabel: "Delete" }, "delete"],
    [
      "credentials",
      { intent: "Sign in to the controller.", targetLabel: "Sign in" },
      "credentials",
    ],
    [
      "security",
      { intent: "Open Privacy & Security.", targetLabel: "Privacy & Security" },
      "security_settings",
    ],
    ["install", { intent: "Install the firmware update.", targetLabel: "Install" }, "install"],
    [
      "text on target",
      { intent: "Click the button.", targetLabel: undefined, targetText: "Delete all data" },
      "delete",
    ],
  ];
  for (const [name, over, category] of cases) {
    it(name, () => {
      const r = guardAction(click, ctx(over));
      expect(r).toMatchObject({ decision: "confirm", category });
      if (r.decision === "confirm") expect(r.prompt).toMatch(/^Tandrix wants to /);
    });
  }

  it("names the control in the prompt", () => {
    const r = guardAction(click, ctx({ intent: "Send it.", targetLabel: "Send" }));
    expect(r.decision === "confirm" && r.prompt).toContain("click Send");
  });
});

describe("credentials and secrets", () => {
  it("never types into a password field", () => {
    const r = guardAction({ type: "type", text: "hunter2" }, ctx({ focusedFieldIsSecure: true }));
    expect(r).toMatchObject({ decision: "deny", code: "secure_field" });
  });
  it("never types text that looks like a key", () => {
    for (const text of [
      "sk-abcdefghijklmnopqrstuv",
      "ghp_abcdefghijklmnopqrstuvwxyz12",
      "AKIAABCDEFGHIJKLMNOP",
    ]) {
      expect(guardAction({ type: "type", text }, ctx())).toMatchObject({
        decision: "deny",
        code: "secret_text",
      });
    }
  });
});

describe("shortcuts", () => {
  it("blocks quit, force quit and lock, in any key order or alias", () => {
    for (const keys of [
      ["cmd", "q"],
      ["Q", "Command"],
      ["escape", "alt", "meta"],
      ["ctrl", "cmd", "q"],
    ]) {
      expect(guardAction({ type: "keypress", keys }, ctx())).toMatchObject({
        decision: "deny",
        code: "system_shortcut",
      });
    }
  });
  it("asks before closing windows or switching apps", () => {
    expect(guardAction({ type: "keypress", keys: ["cmd", "w"] }, ctx()).decision).toBe("confirm");
    expect(guardAction({ type: "keypress", keys: ["cmd", "tab"] }, ctx()).decision).toBe("confirm");
  });
  it("allows plain keys", () => {
    expect(guardAction({ type: "keypress", keys: ["tab"] }, ctx()).decision).toBe("allow");
  });
});

describe("unusual input", () => {
  it("asks before drags and unusual mouse buttons", () => {
    expect(
      guardAction(
        {
          type: "drag",
          path: [
            { x: 1, y: 1 },
            { x: 50, y: 50 },
          ],
        },
        ctx(),
      ).decision,
    ).toBe("confirm");
    expect(guardAction({ ...click, button: "back" }, ctx()).decision).toBe("confirm");
    expect(guardAction({ ...click, button: "right" }, ctx()).decision).toBe("allow");
  });
});

describe("limits", () => {
  it("stops after too many actions for one request", () => {
    const r = guardAction(click, ctx({ actionsThisRequest: guardLimits.maxActionsPerRequest }));
    expect(r).toMatchObject({ decision: "deny", code: "action_limit" });
  });
  it("enforces a gap between actions", () => {
    expect(guardAction(click, ctx({ recentActionTimes: [NOW - 100] }))).toMatchObject({
      code: "rate_limit",
    });
    expect(
      guardAction(click, ctx({ recentActionTimes: [NOW - guardLimits.minGapMs] })).decision,
    ).toBe("allow");
  });
  it("caps actions per minute", () => {
    const times = Array.from(
      { length: guardLimits.maxPerMinute },
      (_, i) => NOW - 59_000 + i * 900,
    );
    expect(
      guardAction(click, ctx({ recentActionTimes: times.map((t) => Math.min(t, NOW - 1000)) })),
    ).toMatchObject({
      code: "rate_limit",
    });
  });
});
