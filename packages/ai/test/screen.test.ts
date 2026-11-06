import { describe, expect, it } from "vitest";
import {
  askScreen,
  imageUrl,
  MetaClient,
  prompts,
  REPLY_RULE,
  TEACH_REPLY_RULE,
  unnarrate,
} from "../src";
import { json, noSleep, scriptedFetch, sse } from "./helpers";

const screenshot = imageUrl("data:image/jpeg;base64,AAAA");

const response = (output: unknown[]) =>
  json(200, {
    id: "resp_1",
    object: "response",
    status: "completed",
    model: "muse-spark-1.3",
    output,
  });

/** The same answer streamed, as Show me asks for it: each item, then the whole response. */
const streamed = (output: unknown[]) =>
  sse([
    { type: "response.created", response: { id: "resp_1", status: "in_progress" } },
    ...output.map((item) => ({ type: "response.output_item.done", item })),
    {
      type: "response.completed",
      response: { id: "resp_1", status: "completed", model: "muse-spark-1.3", output },
    },
  ]);

const message = (text: string) => ({
  type: "message",
  role: "assistant",
  content: [{ type: "output_text", text }],
});

function clientWith(reply: Response) {
  const s = scriptedFetch([reply]);
  return {
    client: new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep }),
    calls: s.calls,
  };
}

describe("askScreen", () => {
  it("sends the screenshot with the computer tool and the Show me rules", async () => {
    const { client, calls } = clientWith(streamed([message("Click Save.")]));
    await askScreen(client, "muse-spark-1.3", {
      screenshot,
      question: "How do I save this?",
      context: ["Step: Save the drive settings", ""],
    });
    const body = calls[0]!.body;
    expect(body.model).toBe("muse-spark-1.3");
    expect(body.tools).toEqual([{ type: "computer" }]);
    expect(body.instructions).toBe(prompts.showMe);
    expect(body.store).toBe(false);
    const input = body.input as Array<{ content: Array<Record<string, unknown>> }>;
    expect(input[0]!.content[0]!.text).toBe(
      `Step: Save the drive settings\n\nThe user asks: How do I save this?\n\n${REPLY_RULE}`,
    );
    expect(input[0]!.content[1]).toEqual(screenshot);
  });

  it("returns the reply and the proposed actions, rounding coordinates", async () => {
    const { client } = clientWith(
      streamed([
        message("Click Ramp time, then enter 10 seconds."),
        {
          type: "computer_call",
          id: "cu_1",
          call_id: "call_1",
          status: "completed",
          pending_safety_checks: [],
          actions: [{ type: "click", button: "left", x: 412.6, y: 315.2 }],
        },
      ]),
    );
    const r = await askScreen(client, "m", { screenshot, question: "ramp time?" });
    expect(r).toEqual({
      reply: "Click Ramp time, then enter 10 seconds.",
      actions: [{ type: "click", button: "left", x: 413, y: 315 }],
      dropped: 0,
      safetyChecks: 0,
    });
  });

  it("drops actions outside the protocol and counts safety checks", async () => {
    const { client } = clientWith(
      streamed([
        {
          type: "computer_call",
          call_id: "call_1",
          pending_safety_checks: [{ id: "sc_1", code: "sensitive", message: "Payment" }],
          actions: [
            { type: "teleport", x: 1, y: 1 },
            { type: "move", x: -4, y: 10 },
            {
              type: "drag",
              path: [
                { x: 1.4, y: 2 },
                { x: 30, y: 40.6 },
              ],
            },
          ],
        },
      ]),
    );
    const r = await askScreen(client, "m", { screenshot, question: "?" });
    expect(r.reply).toBe("");
    expect(r.actions).toEqual([
      {
        type: "drag",
        path: [
          { x: 1, y: 2 },
          { x: 30, y: 41 },
        ],
      },
    ]);
    expect(r.dropped).toBe(2);
    expect(r.safetyChecks).toBe(1);
  });
});

describe("askScreen replies", () => {
  const ask = async (...replies: string[]) => {
    const s = scriptedFetch(
      replies.map((r, i) => (i === 0 ? streamed([message(r)]) : response([message(r)]))),
    );
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await askScreen(client, "muse-spark-1.3", { screenshot, question: "How?" });
    return { reply: r.reply, calls: s.calls };
  };

  it("rewrites common narration without another call", async () => {
    const r = await ask("I’ll highlight the Choose storage button so you can pick your SD card.");
    expect(r.reply).toBe("Click the Choose storage button to pick your SD card.");
    expect(r.calls).toHaveLength(1);
  });

  it("rewrites other narration with one more call", async () => {
    const r = await ask(
      "The storage button is what I'll highlight for you here.",
      "Click Choose storage to pick your SD card.",
    );
    expect(r.reply).toBe("Click Choose storage to pick your SD card.");
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1]!.body.instructions).toBe(prompts.asInstruction);
    expect(r.calls[1]!.body.tools).toBeUndefined();
  });

  it("leaves an instruction alone", async () => {
    const r = await ask("Click Choose storage.");
    expect(r.reply).toBe("Click Choose storage.");
    expect(r.calls).toHaveLength(1);
  });

  it("keeps a warm opener without rewriting it", async () => {
    const r = await ask("Got it. Click Export, then choose PDF.");
    expect(r.reply).toBe("Got it. Click Export, then choose PDF.");
    expect(r.calls).toHaveLength(1);
  });

  it("sends the lesson rules when teaching", async () => {
    const { client, calls } = clientWith(streamed([message("Click File.")]));
    await askScreen(client, "muse-spark-1.3", {
      screenshot,
      question: "Teach me Google Docs",
      lesson: true,
    });
    expect(calls[0]!.body.instructions).toBe(prompts.teachMe);
    const input = calls[0]!.body.input as Array<{ content: Array<Record<string, unknown>> }>;
    expect(input[0]!.content[0]!.text).toBe(
      `The user asks: Teach me Google Docs\n\n${TEACH_REPLY_RULE}`,
    );
  });

  it("keeps the first reply when the rewrite still narrates", async () => {
    const r = await ask("Save is the one I'll point at.", "I'll point at Save for you.");
    expect(r.reply).toBe("Save is the one I'll point at.");
  });

  it("never reads out leaked tool-call markup", async () => {
    const r = await ask(
      '<atem:function_calls><atem:invoke name="computer.stop"><atem:parameter name="answer">Say which button you need.</atem:parameter></atem:invoke></atem:function_calls>',
    );
    expect(r.reply).toBe("Say which button you need.");
  });
});

describe("unnarrate", () => {
  it("turns pointing narration into the instruction", () => {
    expect(unnarrate("I'll point to the Archive button so you can file this email.")).toBe(
      "Click the Archive button to file this email.",
    );
    expect(unnarrate("Got it. I'll highlight the Wi-Fi toggle to turn it off.")).toBe(
      "Click the Wi-Fi toggle to turn it off.",
    );
    expect(unnarrate("Let me point to the Add to Cart button.")).toBe(
      "Click the Add to Cart button.",
    );
  });

  it("uses the action's verb", () => {
    expect(
      unnarrate("I'll point to the Exposure slider so you can brighten the photo.", {
        type: "drag",
        path: [
          { x: 1, y: 1 },
          { x: 9, y: 1 },
        ],
      }),
    ).toBe("Drag the Exposure slider to brighten the photo.");
  });

  it("leaves anything else to the model", () => {
    expect(unnarrate("Click Export, then choose PDF.")).toBeNull();
    expect(unnarrate("I'll point to Export. Then I'll click PDF.")).toBeNull();
  });

  it("covers the other ways the model narrates pointing", () => {
    expect(unnarrate("Got it. I'll point out the Bluetooth settings for you.")).toBe(
      "Click the Bluetooth settings.",
    );
    expect(unnarrate("I'll show you where the Wi-Fi switch is.")).toBe("Click the Wi-Fi switch.");
    expect(unnarrate("Let me take you to the Display settings so you can change it.")).toBe(
      "Click the Display settings to change it.",
    );
    expect(unnarrate("I'm pointing at the Bold button.")).toBe("Click the Bold button.");
  });

  it("keeps plain instruction after a narrated first sentence", () => {
    expect(unnarrate("I'll point to Export. Then choose PDF.")).toBe(
      "Click Export. Then choose PDF.",
    );
  });
});
