import { describe, expect, it } from "vitest";
import { continueDoing, imageUrl, MetaClient, prompts, startDoing } from "../src";
import { json, noSleep, scriptedFetch } from "./helpers";

const response = (id: string, output: unknown[]) =>
  json(200, { id, object: "response", status: "completed", model: "muse-spark-1.3", output });
const call = (actions: unknown[], checks: unknown[] = []) => ({
  type: "computer_call",
  id: "cu_1",
  call_id: "call_1",
  actions,
  pending_safety_checks: checks,
  status: "completed",
});
const message = (text: string) => ({
  type: "message",
  role: "assistant",
  content: [{ type: "output_text", text }],
});

function clientWith(...replies: Response[]) {
  const s = scriptedFetch(replies);
  return {
    client: new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep }),
    calls: s.calls,
  };
}

describe("startDoing", () => {
  it("asks with the computer tool and stores the session for the next turn", async () => {
    const { client, calls } = clientWith(
      response("resp_1", [call([{ type: "click", x: 10.4, y: 20.6 }, { type: "bogus" }])]),
    );
    const t = await startDoing(client, "muse-spark-1.3", {
      screenshot: imageUrl("data:image/png;base64,AAAA"),
      task: "Turn on notifications for VS Code",
    });
    expect(calls[0]!.body).toMatchObject({
      store: true,
      instructions: prompts.doItForMe,
      tools: [{ type: "computer" }],
    });
    expect(t).toMatchObject({
      responseId: "resp_1",
      callId: "call_1",
      actions: [{ type: "click", x: 10, y: 21, button: "left" }],
      dropped: 1,
      safetyChecks: [],
    });
  });

  it("is finished when the model proposes nothing more", async () => {
    const { client } = clientWith(response("resp_2", [message("I turned on notifications.")]));
    const t = await startDoing(client, "m", {
      screenshot: imageUrl("data:image/png;base64,AAAA"),
      task: "x",
    });
    expect(t).toMatchObject({ callId: null, actions: [], reply: "I turned on notifications." });
  });
});

describe("continueDoing", () => {
  it("answers the call with the new screen and the checks the user accepted", async () => {
    const check = { id: "sc_1", code: "sensitive", message: "This sends an email" };
    const { client, calls } = clientWith(response("resp_3", [call([{ type: "wait" }], [check])]));
    const t = await continueDoing(client, "m", {
      previousResponseId: "resp_1",
      callId: "call_1",
      screenshotDataUrl: "data:image/jpeg;base64,BBBB",
      acknowledged: [check],
    });
    expect(calls[0]!.body).toMatchObject({
      store: true,
      previous_response_id: "resp_1",
      input: [
        {
          type: "computer_call_output",
          call_id: "call_1",
          acknowledged_safety_checks: [check],
          output: { type: "computer_screenshot", image_url: "data:image/jpeg;base64,BBBB" },
        },
      ],
    });
    expect(t.safetyChecks).toEqual([check]);
  });
});
