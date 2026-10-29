import { describe, expect, it } from "vitest";
import {
  askScreen,
  imageUrl,
  MetaClient,
  prompts,
  REPLY_RULE,
  TEACH_REPLY_RULE,
} from "../src";
import { json, noSleep, scriptedFetch } from "./helpers";

const screenshot = imageUrl("data:image/jpeg;base64,AAAA");

const response = (output: unknown[]) =>
  json(200, {
    id: "resp_1",
    object: "response",
    status: "completed",
    model: "muse-spark-1.3",
    output,
  });

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
    const { client, calls } = clientWith(response([message("Click Save.")]));
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
      response([
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
      response([
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
    const s = scriptedFetch(replies.map((r) => response([message(r)])));
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await askScreen(client, "muse-spark-1.3", { screenshot, question: "How?" });
    return { reply: r.reply, calls: s.calls };
  };

  it("rewrites narration as the instruction, with one more call", async () => {
    const r = await ask(
      "I’ll highlight the storage button so you can pick your SD card.",
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
    const { client, calls } = clientWith(response([message("Click File.")]));
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
    const r = await ask("Let me point at Save.", "I'll point at Save for you.");
    expect(r.reply).toBe("Let me point at Save.");
  });

  it("never reads out leaked tool-call markup", async () => {
    const r = await ask(
      '<atem:function_calls><atem:invoke name="computer.stop"><atem:parameter name="answer">Say which button you need.</atem:parameter></atem:invoke></atem:function_calls>',
    );
    expect(r.reply).toBe("Say which button you need.");
  });
});
