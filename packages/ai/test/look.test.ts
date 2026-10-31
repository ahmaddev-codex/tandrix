import { describe, expect, it } from "vitest";
import { imageUrl, lookAt, MetaClient, nearest, type Segment } from "../src";
import { apiError, noSleep, responseWithText, scriptedFetch } from "./helpers";

const models = {
  reasoning: "muse-spark-1.3",
  segmentation: "sam-3.1",
  computerUse: "muse-spark-1.3",
};
const photo = imageUrl("https://example.com/frame.jpg");
const size = { width: 1000, height: 800 };
const seg = (x: number, y: number, w: number, h: number, confidence = 0.9): Segment => ({
  objectId: `${x}`,
  box: { x, y, w, h },
  confidence,
  mask: null,
});

describe("nearest", () => {
  const rough = { x: 400, y: 300, w: 200, h: 150 };
  it("picks the segment Spark meant, not the most confident one elsewhere", () => {
    const far = seg(10, 10, 100, 100, 0.99);
    const here = seg(420, 320, 150, 110, 0.7);
    expect(nearest([far, here], rough)).toBe(here);
  });
  it("finds nothing when no segment is near", () => {
    expect(nearest([seg(10, 10, 50, 50)], rough)).toBeNull();
  });
});

describe("lookAt", () => {
  const answer = (target: unknown) =>
    responseWithText(
      JSON.stringify({ reply: "That's the fan connector. It plugs in by the GPIO pins.", target }),
    );

  it("answers without an outline when the answer isn't about one thing", async () => {
    const { fetch } = scriptedFetch([answer(null)]);
    const client = new MetaClient({ apiKey: "k", fetch, sleep: noSleep });
    const r = await lookAt(client, models, { photo, size, question: "Is this the right way up?" });
    expect(r).toMatchObject({ highlight: null, segmented: false });
  });

  it("outlines Spark's own box when the segmenter can't help", async () => {
    const { fetch, calls } = scriptedFetch([
      answer({
        label: "fan connector",
        looksLike: "white connector",
        box: { x: 400, y: 500, w: 100, h: 50 },
      }),
      apiError(400, "invalid_request_error", "bad"),
    ]);
    const client = new MetaClient({ apiKey: "k", fetch, sleep: noSleep });
    const r = await lookAt(client, models, { photo, size, question: "What is this?" });
    expect(r).toMatchObject({
      reply: expect.stringContaining("fan connector"),
      highlight: { label: "fan connector", box: { x: 400, y: 400, w: 100, h: 40 }, mask: null },
      segmented: false,
    });
    expect(calls[1]!.body.model).toBe("sam-3.1");
  });
});
