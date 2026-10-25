import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  checkParts,
  checkStep,
  generateProcedure,
  generateStructured,
  highlightParts,
  identifyNameplate,
  imageUrl,
  loadMetaConfig,
  MetaClient,
  maskOutline,
  normalizeConcept,
  pdfData,
  pixelBox,
  prompts,
  segment,
  text,
  user,
} from "../src";
import {
  apiError,
  DOC_SAM_LINE,
  noSleep,
  responseWithText,
  samStream,
  scriptedFetch,
} from "./helpers";

const models = { reasoning: "muse-spark-1.3", segmentation: "sam-3.1" };
const photo = imageUrl("https://example.com/frame.jpg");
const clientWith = (replies: Parameters<typeof scriptedFetch>[0]) => {
  const s = scriptedFetch(replies);
  return {
    client: new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep }),
    calls: s.calls,
  };
};

describe("generateStructured", () => {
  const Schema = z.strictObject({ answer: z.string() });

  it("sends a json_schema text format and validates the result", async () => {
    const { client, calls } = clientWith([responseWithText('{"answer":"yes"}')]);
    const r = await generateStructured(client, {
      model: "m",
      name: "t",
      schema: Schema,
      instructions: "i",
      input: [user(text("q"))],
    });
    expect(r).toMatchObject({ ok: true, data: { answer: "yes" }, repaired: false });
    const fmt = (calls[0]!.body.text as { format: Record<string, unknown> }).format;
    expect(fmt).toMatchObject({ type: "json_schema", name: "t", strict: false });
    expect((fmt.schema as { properties: object }).properties).toHaveProperty("answer");
  });

  it("repairs once with the validation errors", async () => {
    const { client, calls } = clientWith([
      responseWithText('{"answer":1}'),
      responseWithText('```json\n{"answer":"fixed"}\n```'),
    ]);
    const r = await generateStructured(client, {
      model: "m",
      name: "t",
      schema: Schema,
      instructions: "i",
      input: [user(text("q"))],
    });
    expect(r).toMatchObject({ ok: true, data: { answer: "fixed" }, repaired: true });
    const repairMsg = JSON.stringify(calls[1]!.body.input);
    expect(repairMsg).toContain("did not match the required schema");
    expect(repairMsg).toContain("answer");
  });

  it("gives up after one repair", async () => {
    const { client, calls } = clientWith([
      responseWithText("not json"),
      responseWithText('{"nope":true}'),
    ]);
    const r = await generateStructured(client, {
      model: "m",
      name: "t",
      schema: Schema,
      instructions: "i",
      input: [user(text("q"))],
    });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(2);
  });
});

describe("identifyNameplate", () => {
  it("returns a validated reading", async () => {
    const { client } = clientWith([
      responseWithText(
        JSON.stringify({
          unreadable: false,
          make: "FlowSet",
          model: "CR 3-10",
          ratings: [{ label: "Head", value: "45 m" }],
          confidence: 0.92,
        }),
      ),
    ]);
    const r = await identifyNameplate(client, models, photo);
    expect(r.ok && r.data.model).toBe("CR 3-10");
  });
});

describe("generateProcedure", () => {
  const draft = {
    title: "Assemble the pump",
    parts: [{ ref: "P1", name: "Impeller", qty: 1 }],
    steps: [
      {
        order: 1,
        surface: "physical",
        title: "Fit the impeller",
        instruction: "Slide the impeller onto the shaft.",
        partRefs: ["P1"],
        hazardTags: [],
        verification: "photo",
        expectedState: "Impeller seated against the shoulder.",
        citation: { kind: "manual", page: 7 },
      },
    ],
  };

  it("works from the goal alone for a project with no equipment", async () => {
    const { client, calls } = clientWith([responseWithText(JSON.stringify(draft))]);
    await generateProcedure(client, models, { job: "Assemble a 12U home server rack" });
    const body = calls[0]!.body as { instructions: string; input: unknown };
    expect(body.instructions).toBe(prompts.procedureGeneric);
    expect(JSON.stringify(body.input)).toContain(
      "Project (no specific equipment): Assemble a 12U home server rack",
    );
  });

  it("sends the manual and its page count with the manual prompt", async () => {
    const { client, calls } = clientWith([responseWithText(JSON.stringify(draft))]);
    const r = await generateProcedure(client, models, {
      manual: pdfData(new Uint8Array([37, 80, 68, 70, 45]), "manual.pdf"),
      manualPages: 12,
      asset: { make: "FlowSet", model: "CR 3-10" },
      job: "Assemble the pump",
    });
    expect(r.ok).toBe(true);
    const body = calls[0]!.body as {
      instructions: string;
      input: Array<{ content: Array<Record<string, string>> }>;
    };
    expect(body.instructions).toBe(prompts.procedure);
    const [about, file] = body.input[0]!.content;
    expect(about!.text).toContain("12 pages");
    expect(file).toMatchObject({ type: "input_file", filename: "manual.pdf" });
    expect(file!.file_data).toMatch(/^data:application\/pdf;base64,/);
  });

  it("uses the generic prompt and sends no file without a manual", async () => {
    const { client, calls } = clientWith([responseWithText(JSON.stringify(draft))]);
    await generateProcedure(client, models, {
      asset: { make: "FlowSet", model: "CR 3-10" },
      job: "Assemble the pump",
    });
    const body = calls[0]!.body as { instructions: string; input: Array<{ content: unknown[] }> };
    expect(body.instructions).toBe(prompts.procedureGeneric);
    expect(body.input[0]!.content).toHaveLength(1);
  });
});

describe("checkStep", () => {
  it("sends the expected state and the reference image", async () => {
    const { client, calls } = clientWith([
      responseWithText(
        JSON.stringify({ result: "fail", reason: "Vanes face away from the inlet." }),
      ),
    ]);
    const r = await checkStep(client, models, {
      photo,
      reference: imageUrl("https://example.com/ref.jpg"),
      instruction: "Fit the impeller",
      expectedState: "Vanes toward the inlet",
    });
    expect(r.ok && r.data.result).toBe("fail");
    const content = JSON.stringify(calls[0]!.body.input);
    expect(content).toContain("Vanes toward the inlet");
    expect(content).toContain("ref.jpg");
  });
});

describe("segment (SAM 3.1)", () => {
  it("parses the documented wire format into boxes and masks", async () => {
    const { client, calls } = clientWith([samStream(DOC_SAM_LINE, 23)]);
    const r = await segment(client, { model: "sam-3.1", image: photo, concept: "button" });
    expect(r.warnings).toEqual([]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toMatchObject({
      objectId: "0",
      box: { x: 211, y: 228 },
      confidence: null,
    });
    expect(r.segments[0]!.mask).toMatchObject({ encoding: "lossless", width: 60, height: 27 });
    expect(calls[0]!.body).toMatchObject({
      model: "sam-3.1",
      stream: true,
      metadata: { include_confidence: "true" },
    });
  });

  it("turns a mask into an SVG outline in its raster's pixels", async () => {
    const { client } = clientWith([samStream(DOC_SAM_LINE)]);
    const r = await segment(client, { model: "sam-3.1", image: photo, concept: "button" });
    const outline = maskOutline(r.segments[0]!);
    expect(outline?.raster).toEqual({ width: 60, height: 27 });
    expect(outline?.path).toMatch(/^M[\d. ]+L/);
    expect(maskOutline({ ...r.segments[0]!, mask: null })).toBeNull();
    expect(
      maskOutline({ ...r.segments[0]!, mask: { ...r.segments[0]!.mask!, payload: "!!" } }),
    ).toBeNull();
  });

  it("keeps boxes on whole pixels inside the image", () => {
    expect(pixelBox({ x: 10.4, y: -2, w: 5.2, h: 400 }, { width: 100, height: 50 })).toEqual({
      x: 10,
      y: 0,
      w: 6,
      h: 50,
    });
  });

  it("treats zero matches as a normal empty result", async () => {
    const { client } = clientWith([samStream("")]);
    expect(
      (await segment(client, { model: "sam-3.1", image: photo, concept: "impeller" })).segments,
    ).toEqual([]);
  });

  it("surfaces the API error instead of the parser's wrapper", async () => {
    const { client } = clientWith([apiError(402, "billing_error", "billing_not_configured")]);
    await expect(
      segment(client, { model: "sam-3.1", image: photo, concept: "impeller" }),
    ).rejects.toMatchObject({
      name: "MetaApiError",
      status: 402,
      code: "billing_not_configured",
    });
  });

  it("requires exactly one prompt kind", async () => {
    const { client } = clientWith([]);
    await expect(segment(client, { model: "sam-3.1", image: photo })).rejects.toThrow(
      /exactly one/,
    );
  });
});

describe("normalizeConcept", () => {
  it("turns part names into short noun phrases", () => {
    expect(normalizeConcept("O-ring, 120 mm (part 7)")).toBe("o-ring");
    expect(normalizeConcept("Housing bolt M12")).toBe("housing bolt m12");
    expect(normalizeConcept("The Mechanical Seal")).toBe("mechanical seal");
  });
});

describe("highlightParts", () => {
  const conf = (line: string) => line.replace(/;h=334\|>/g, ";h=334;c=0.95|>");

  it("skips reasoning when every part has one confident match", async () => {
    const oneObject = DOC_SAM_LINE.split(",1<|")[0]!;
    const { client, calls } = clientWith([samStream(conf(oneObject))]);
    const r = await highlightParts(client, models, {
      photo,
      size: { width: 320, height: 334 },
      instruction: "Fit the impeller",
      parts: [{ ref: "P3", name: "Impeller" }],
    });
    expect("picks" in r && r.usedReasoning).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("asks Spark to pick when ambiguous, and drops invented refs and indexes", async () => {
    const { client } = clientWith([
      samStream(DOC_SAM_LINE),
      responseWithText(
        JSON.stringify({
          picks: [
            { partRef: "P3", boxIndex: 1, confidence: 0.8 },
            { partRef: "P99", boxIndex: 0, confidence: 0.9 },
          ],
        }),
      ),
    ]);
    const r = await highlightParts(client, models, {
      photo,
      size: { width: 320, height: 334 },
      instruction: "Fit the impeller",
      parts: [{ ref: "P3", name: "Impeller" }],
    });
    if (!("picks" in r)) throw new Error("expected picks");
    expect(r.usedReasoning).toBe(true);
    expect(r.picks).toHaveLength(1);
    expect(r.picks[0]!.candidate?.objectId).toBe("1");
  });
});

describe("checkParts", () => {
  it("reports every listed part once, missing when the model skipped it", async () => {
    const { client } = clientWith([
      samStream(DOC_SAM_LINE),
      responseWithText(
        JSON.stringify({
          assignments: [
            { partRef: "P1", status: "found", boxIndexes: [0, 7] },
            { partRef: "P99", status: "found" },
          ],
        }),
      ),
    ]);
    const r = await checkParts(client, models, {
      photo,
      parts: [
        { ref: "P1", name: "Housing", qty: 1 },
        { ref: "P7", name: "O-ring", qty: 1 },
      ],
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.assignments).toEqual([
      { partRef: "P1", status: "found", boxIndexes: [0] },
      { partRef: "P7", status: "missing", boxIndexes: [] },
    ]);
  });
});

describe("loadMetaConfig", () => {
  it("applies defaults and names missing variables", () => {
    expect(loadMetaConfig({ META_API_KEY: "k" }).models).toMatchObject({
      reasoning: "muse-spark-1.3",
      segmentation: "sam-3.1",
    });
    expect(() => loadMetaConfig({})).toThrow(/META_API_KEY/);
  });
});
