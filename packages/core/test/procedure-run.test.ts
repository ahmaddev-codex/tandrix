import type { GenerateProcedureResponse, ProcedureRunResponse } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { RUN_TOO_LONG, RUN_WAIT_MS, waitForProcedure } from "../src";

const created = { status: "created", detail: {}, citedSteps: 1 } as GenerateProcedureResponse;
const writing: ProcedureRunResponse = { status: "writing" };
const noSleep = async () => undefined;

describe("waitForProcedure", () => {
  it("asks until the steps are there", async () => {
    const answers = [writing, writing, created];
    const r = await waitForProcedure({
      start: async () => writing,
      check: async () => answers.shift()!,
      isOffline: () => false,
      sleep: noSleep,
    });
    expect(r).toBe(created);
    expect(answers).toHaveLength(0);
  });

  it("returns at once when starting finds them already written", async () => {
    let checks = 0;
    await waitForProcedure({
      start: async () => created,
      check: async () => (checks++, created),
      isOffline: () => false,
      sleep: noSleep,
    });
    expect(checks).toBe(0);
  });

  it("waits out a dropped connection", async () => {
    let n = 0;
    const r = await waitForProcedure({
      start: async () => writing,
      check: async () => {
        if (++n < 3) throw new Error("offline");
        return created;
      },
      isOffline: () => true,
      sleep: noSleep,
    });
    expect(r).toBe(created);
  });

  it("throws anything else", async () => {
    await expect(
      waitForProcedure({
        start: async () => writing,
        check: async () => {
          throw new Error("signed out");
        },
        isOffline: () => false,
        sleep: noSleep,
      }),
    ).rejects.toThrow("signed out");
  });

  it("gives up in the end", async () => {
    let t = 0;
    const r = await waitForProcedure({
      start: async () => writing,
      check: async () => writing,
      isOffline: () => false,
      sleep: async () => void (t += RUN_WAIT_MS),
      now: () => t,
    });
    expect(r).toEqual({ status: "unavailable", message: RUN_TOO_LONG });
  });
});
