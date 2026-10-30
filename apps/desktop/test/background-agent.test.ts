import { describe, expect, it } from "vitest";
import type { BackgroundResponse } from "@tandrix/contracts";
import { localNow, runBackgroundTask } from "../src/renderer/lib/background-agent";
import { dateParts, scriptArgs } from "../src/main/mac-tools";

describe("runBackgroundTask", () => {
  it("runs the tools the model asks for, sends their outputs back, and returns its answer", async () => {
    const asked: number[] = [];
    const ran: string[] = [];
    const replies: BackgroundResponse[] = [
      { status: "call", calls: [{ id: "a", name: "calendar_list_events", arguments: "{}" }] },
      { status: "call", calls: [{ id: "b", name: "calendar_add_event", arguments: "{}" }] },
      { status: "done", spoken: "Booked.", detail: "Thursday at ten.", sources: [] },
    ];
    const r = await runBackgroundTask("Book the dentist", {
      ask: async (body) => {
        asked.push(body.steps!.length);
        return replies.shift()!;
      },
      runTool: async (c) => {
        ran.push(c.name);
        return "ok";
      },
      now: () => "2026-10-30T09:00+01:00",
    });
    expect(r).toEqual({
      status: "done",
      spoken: "Booked.",
      detail: "Thursday at ten.",
      sources: [],
    });
    expect(ran).toEqual(["calendar_list_events", "calendar_add_event"]);
    expect(asked).toEqual([0, 1, 2]);
  });

  it("gives up after too many rounds instead of looping", async () => {
    const r = await runBackgroundTask("x", {
      ask: async () => ({
        status: "call",
        calls: [{ id: "a", name: "files_list", arguments: "{}" }],
      }),
      runTool: async () => "ok",
      now: () => "",
    });
    expect(r.status).toBe("unavailable");
  });

  it("reports a failed tool to the model rather than failing the task", async () => {
    let output = "";
    await runBackgroundTask("x", {
      ask: async (b) => {
        output = b.steps?.[0]?.output ?? output;
        return b.steps?.length
          ? { status: "done", spoken: "s", detail: "d", sources: [] }
          : { status: "call", calls: [{ id: "a", name: "notes_create", arguments: "{}" }] };
      },
      runTool: async () => {
        throw new Error("Notes isn't running");
      },
      now: () => "",
    });
    expect(output).toBe("Couldn't do it: Notes isn't running");
  });

  it("formats local time with its offset", () => {
    expect(localNow(new Date(2026, 9, 30, 9, 5))).toMatch(/^2026-10-30T09:05[+-]\d{2}:\d{2}$/);
  });
});

describe("mac tools", () => {
  it("reads local date-times and refuses anything else", () => {
    expect(dateParts("2026-10-31T09:30")).toEqual(["2026", "10", "31", "9", "30"]);
    expect(dateParts("next Thursday")).toBeNull();
    expect(dateParts("2026-13-01T09:00")).toBeNull();
  });

  it("builds event arguments, an hour long by default", () => {
    expect(
      scriptArgs("calendar_add_event", { title: "Dentist", start: "2026-10-31T23:30" }),
    ).toEqual(["Dentist", "2026", "10", "31", "23", "30", "2026", "11", "1", "0", "30", "", ""]);
    expect(typeof scriptArgs("calendar_add_event", { title: "x" })).toBe("string");
  });

  it("passes script-like text as plain data, and only well-formed email addresses", () => {
    const evil = 'x" & (do shell script "rm -rf ~") & "';
    const args = scriptArgs("reminders_add", { title: evil }) as string[];
    expect(args[0]).toBe(evil);
    expect(
      scriptArgs("mail_draft", { to: "sam@example.com, not an address", subject: "Hi", body: "b" }),
    ).toEqual(["sam@example.com", "Hi", "b"]);
    expect(typeof scriptArgs("mail_draft", { to: "nobody", subject: "Hi", body: "b" })).toBe(
      "string",
    );
  });

  it("escapes note text as HTML", () => {
    const [, body] = scriptArgs("notes_create", {
      title: "List",
      body: "<b>milk</b>\neggs",
    }) as string[];
    expect(body).toBe("<h1>List</h1>&lt;b&gt;milk&lt;/b&gt;<br>eggs");
  });
});
