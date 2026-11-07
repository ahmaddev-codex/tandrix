import { describe, expect, it } from "vitest";
import {
  continueDoing,
  controlsLine,
  finishedTurn,
  imageUrl,
  MetaClient,
  prompts,
  startDoing,
} from "../src";
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

describe("controlsLine", () => {
  it("names the front window's controls with their centres, once each", () => {
    const box = { x: 100, y: 40, w: 60, h: 24 };
    expect(
      controlsLine([
        { role: "Button", name: "Save", enabled: true, box },
        { role: "Button", name: "Save", enabled: true, box },
        { role: "Button", name: "", enabled: true, box: { x: 1, y: 1, w: 9, h: 9 } },
        { role: "TextField", name: "", enabled: true, box: { x: 10, y: 80, w: 200, h: 22 } },
        { role: "CheckBox", name: 'Say "hi"', enabled: false, box: { x: 0, y: 0, w: 10, h: 10 } },
      ]),
    ).toBe(
      'Controls in the front window, from the app itself (screenshot pixels). Aim at a control\'s centre:\n- Button "Save" centre 130,52, 60x24\n- TextField centre 110,91, 200x22\n- CheckBox "Say hi" centre 5,5, 10x10 (dimmed)',
    );
  });

  it("is nothing when there's nothing named", () => {
    expect(controlsLine([])).toBeNull();
  });
});

describe("finishedTurn", () => {
  const click = { type: "click" as const, x: 1, y: 1, button: "left" as const };
  it("is finished when the model says DONE, whatever came with it, without the marker", () => {
    expect(
      finishedTurn({ callId: "c", actions: [click], reply: "DONE: Sent Sam your reply." }),
    ).toEqual({
      done: true,
      reply: "Sent Sam your reply.",
    });
  });
  it("is finished with no actions", () => {
    expect(finishedTurn({ callId: null, actions: [], reply: "Added it." }).done).toBe(true);
  });
  it("is finished when only idle actions come with a reply saying what it did", () => {
    expect(
      finishedTurn({ callId: "c", actions: [{ type: "wait" }], reply: "Sent your message to Sam." })
        .done,
    ).toBe(true);
    expect(
      finishedTurn({
        callId: "c",
        actions: [{ type: "move", x: 1, y: 1 }],
        reply: "I've added the event.",
      }).done,
    ).toBe(true);
  });
  it("keeps going while there's real work, or an idle action without a finished reply", () => {
    expect(finishedTurn({ callId: "c", actions: [click], reply: "Sent the first one." }).done).toBe(
      false,
    );
    expect(
      finishedTurn({
        callId: "c",
        actions: [{ type: "wait" }],
        reply: "Waiting for Calendar to open.",
      }).done,
    ).toBe(false);
  });
});
