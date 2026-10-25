import { describe, expect, it } from "vitest";
import { checkStep, imageUrl, MetaClient } from "../src";
import { noSleep, responseWithText, scriptedFetch } from "./helpers";

const models = { reasoning: "muse-spark-1.3", segmentation: "sam-3.1" };
const req = {
  photo: imageUrl("https://example.com/check.jpg"),
  instruction: "Fit the impeller onto the shaft.",
  expectedState: "Impeller seated against the shoulder, vanes facing the inlet.",
};

async function run(output: object) {
  const s = scriptedFetch([responseWithText(JSON.stringify(output))]);
  const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
  return checkStep(client, models, req);
}

describe("checkStep outcomes", () => {
  it("passes a photo that shows the expected state", async () => {
    const r = await run({
      result: "pass",
      reason: "Seated against the shoulder, vanes towards the inlet.",
    });
    expect(r.ok && r.data.result).toBe("pass");
  });

  it("fails a wrong stage with a specific reason and what to show next", async () => {
    const r = await run({
      result: "fail",
      reason: "The vanes face away from the inlet. Turn the impeller round.",
      whatToShowNext: "Show the impeller from the inlet side.",
    });
    expect(r.ok && r.data).toMatchObject({
      result: "fail",
      whatToShowNext: "Show the impeller from the inlet side.",
    });
  });

  it("says when a photo can't show it", async () => {
    const r = await run({ result: "not_verifiable", reason: "Torque can't be seen in a photo." });
    expect(r.ok && r.data.result).toBe("not_verifiable");
  });

  it("refuses a made-up verdict", async () => {
    const s = scriptedFetch([
      responseWithText(JSON.stringify({ result: "probably", reason: "x" })),
      responseWithText(JSON.stringify({ result: "maybe", reason: "x" })),
    ]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    expect((await checkStep(client, models, req)).ok).toBe(false);
  });
});
