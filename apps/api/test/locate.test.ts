// POST /screen/locate: each part of an answer clicked, streamed back a line per part as it lands.
import { ScreenLocated } from "@tandrix/contracts";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../src/auth";
import { HttpError } from "../src/errors";
import { inlineScreenRoutes } from "../src/routes/screen";
import { noModelScreenGuide, type ScreenGuide } from "../src/screen-guide";
import { PNG } from "./fixtures";

const SECRET = "test-secret-test-secret-test-secret!";

function app(guide: ScreenGuide) {
  const a = new Hono<AuthEnv>();
  a.use(async (c, next) => {
    c.set("user", { id: "u1" } as never);
    await next();
  });
  a.route("/screen", inlineScreenRoutes({ guide, tokenSecret: SECRET }));
  a.onError((e, c) =>
    e instanceof HttpError ? c.json({ error: e.code }, e.status) : c.json({ error: "x" }, 500),
  );
  return a;
}

const body = (parts: unknown[]) =>
  JSON.stringify({
    screenshot: { mimeType: "image/png", data: Buffer.from(PNG).toString("base64") },
    geometry: {
      displayId: "1",
      imageWidth: 400,
      imageHeight: 300,
      originX: 0,
      originY: 0,
      displayWidth: 400,
      displayHeight: 300,
    },
    parts,
  });

const lines = async (res: Response) =>
  (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => ScreenLocated.parse(JSON.parse(l)));

describe("POST /screen/locate", () => {
  it("streams each part as soon as it's found, the quick ones first", async () => {
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const guide: ScreenGuide = {
      ...noModelScreenGuide,
      locate: ({ parts }) =>
        parts.map(async (p, i) => {
          if (i === 0) await slow;
          return { point: { x: 10 + i, y: 20 }, box: p.box };
        }),
    };
    const res = await app(guide).request("/screen/locate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body([
        { label: "Atlas", detail: null, box: { x: 1, y: 2, w: 30, h: 10 } },
        { label: "Axis", detail: "turns the head", box: { x: 5, y: 6, w: 30, h: 10 } },
      ]),
    });
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    setTimeout(release, 20);
    const got = await lines(res);
    // The second part, found at once, comes before the first.
    expect(got.map((l) => l.i)).toEqual([1, 0]);
    expect(got[1]).toEqual({ i: 0, point: { x: 10, y: 20 }, box: { x: 1, y: 2, w: 30, h: 10 } });
  });

  it("keeps every point and box on the screenshot", async () => {
    const guide: ScreenGuide = {
      ...noModelScreenGuide,
      locate: ({ parts }) =>
        parts.map(async () => ({
          point: { x: 9000.4, y: -5 },
          box: { x: -20, y: 10.6, w: 0.2, h: 40 },
        })),
    };
    const res = await app(guide).request("/screen/locate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body([{ label: "Sacrum", detail: null, box: { x: 1, y: 2, w: 30, h: 10 } }]),
    });
    const [l] = await lines(res);
    expect(l).toEqual({ i: 0, point: { x: 399, y: 0 }, box: { x: 0, y: 11, w: 1, h: 40 } });
  });

  it("answers without the model with the parts where they were", async () => {
    const res = await app(noModelScreenGuide).request("/screen/locate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body([{ label: "Coccyx", detail: null, box: { x: 3, y: 4, w: 12, h: 9 } }]),
    });
    expect(await lines(res)).toEqual([{ i: 0, point: null, box: { x: 3, y: 4, w: 12, h: 9 } }]);
  });

  it("refuses more than eight parts, or none", async () => {
    const part = { label: "x", detail: null, box: { x: 1, y: 1, w: 2, h: 2 } };
    for (const parts of [[], Array.from({ length: 9 }, () => part)]) {
      const res = await app(noModelScreenGuide).request("/screen/locate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(parts),
      });
      expect(res.status).toBe(400);
    }
  });
});

describe("what's already worked out about a screenshot", () => {
  it("clicks a part once per screenshot, and only the new ones after", async () => {
    const asked: string[] = [];
    const guide: ScreenGuide = {
      ...noModelScreenGuide,
      locate: ({ parts }) =>
        parts.map(async (p) => {
          asked.push(p.label);
          return { point: { x: 5, y: 5 }, box: p.box };
        }),
    };
    const a = app(guide);
    const ask = (labels: string[]) =>
      a.request("/screen/locate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(
          labels.map((label) => ({ label, detail: null, box: { x: 1, y: 1, w: 9, h: 9 } })),
        ),
      });
    await lines(await ask(["Atlas", "Axis"]));
    const again = await lines(await ask(["atlas", "Sacrum"]));
    expect(asked).toEqual(["Atlas", "Axis", "Sacrum"]);
    expect(again.find((l) => l.i === 0)?.point).toEqual({ x: 5, y: 5 });
  });

  it("answers the same question on the same screenshot at once", async () => {
    let asks = 0;
    const guide: ScreenGuide = {
      ...noModelScreenGuide,
      ask: async () => {
        asks++;
        return { status: "answered", reply: "That's the atlas.", actions: [] } as never;
      },
    };
    const a = app(guide);
    const ask = (q: string, history: unknown[] = []) =>
      a.request("/screen/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...JSON.parse(body([])),
          parts: undefined,
          transcript: q,
          mode: "show",
          history,
        }),
      });
    const first = await ask("What is this bone?");
    const repeat = await ask("what is this bone?", [
      { question: "What is this bone?", reply: "That's the atlas." },
    ]);
    expect(first.status).toBe(200);
    expect(repeat.headers.get("x-tandrix-cache")).toBe("hit");
    await ask("And this one?");
    expect(asks).toBe(2);
  });
});
