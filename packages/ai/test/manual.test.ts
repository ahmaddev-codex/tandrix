import { describe, expect, it } from "vitest";
import { findManual, MetaClient, searchedUrls, urlKey } from "../src";
import { json, noSleep, scriptedFetch } from "./helpers";

const models = { reasoning: "muse-spark-1.3", segmentation: "sam-3.1" };

/** A Responses payload with a web_search_call, a cited message, and structured JSON text. */
function searchResponse(results: string[], cited: string[], candidates: object[]) {
  return json(200, {
    id: "resp_s",
    status: "completed",
    model: "muse-spark-1.3",
    output: [
      {
        type: "web_search_call",
        id: "ws_1",
        status: "completed",
        results: results.map((url) => ({ type: "text_result", url, title: "t" })),
      },
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ candidates }),
            annotations: cited.map((url) => ({
              type: "url_citation",
              url,
              title: "t",
              start_index: 0,
              end_index: 1,
            })),
          },
        ],
      },
    ],
  });
}

const cand = (url: string, official: boolean, confidence: number) => ({
  url,
  title: "CR 3-10 installation manual",
  official,
  documentType: "installation_manual",
  confidence,
});

describe("urlKey", () => {
  it("ignores case in the host, fragments and trailing slashes", () => {
    expect(urlKey("https://Example.com/a/b/#p3")).toBe(urlKey("https://example.com/a/b"));
    expect(urlKey("not a url")).toBeNull();
  });
});

describe("findManual", () => {
  it("keeps only https URLs the search returned or cited, official first", async () => {
    const s = scriptedFetch([
      searchResponse(
        ["https://flowset.example/docs/cr3-10.pdf", "https://pumpparts.example/cr3.pdf"],
        ["https://mirror.example/manual.pdf"],
        [
          cand("https://pumpparts.example/cr3.pdf", false, 0.9),
          cand("https://flowset.example/docs/cr3-10.pdf", true, 0.7),
          cand("https://mirror.example/manual.pdf", false, 0.5),
          cand("https://invented.example/made-up.pdf", true, 0.99), // not in results: dropped
          cand("http://pumpparts.example/cr3.pdf", false, 0.9), // not https: dropped
        ],
      ),
    ]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await findManual(client, models, { make: "FlowSet", model: "CR 3-10" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.candidates.map((c) => c.url)).toEqual([
      "https://flowset.example/docs/cr3-10.pdf",
      "https://pumpparts.example/cr3.pdf",
      "https://mirror.example/manual.pdf",
    ]);
    expect(r.dropped).toBe(2);
    expect(s.calls[0]!.body).toMatchObject({
      tools: [{ type: "web_search" }],
      include: ["web_search_call.results"],
      text: { format: { type: "json_schema", name: "manual_search" } },
    });
  });

  it("returns nothing when the search found nothing", async () => {
    const s = scriptedFetch([searchResponse([], [], [cand("https://x.example/a.pdf", true, 0.9)])]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await findManual(client, models, { make: "A", model: "B" });
    expect(r.ok && r.data.candidates).toEqual([]);
  });
});

describe("searchedUrls", () => {
  it("collects results and citations", () => {
    const urls = searchedUrls({
      id: "r",
      status: "completed",
      model: "m",
      output: [
        { type: "web_search_call", results: [{ url: "https://a.example/x" }] },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "",
              annotations: [{ type: "url_citation", url: "https://b.example/y" }],
            } as never,
          ],
        },
      ],
    });
    expect([...urls].sort()).toEqual(["https://a.example/x", "https://b.example/y"]);
  });
});
