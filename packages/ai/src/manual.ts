// Find manufacturer manuals with Muse Spark web search. Only URLs the search actually returned are
// kept: a model can invent plausible manual links, and we must never fetch one of those.
import { ManualSearchOutput } from "@tandrix/contracts";
import { outputText, type MetaClient, type MetaResponse } from "./client";
import { text, user } from "./content";
import type { Models } from "./pipelines";
import { prompts } from "./prompts";
import { generateStructured } from "./structured";

/** Lower-case host and path, no fragment or trailing slash: how two URLs are compared. */
export function urlKey(u: string): string | null {
  try {
    const x = new URL(u);
    x.hash = "";
    return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, "")}${x.search}`;
  } catch {
    return null;
  }
}

/** Every URL the web search returned or cited in this response. */
export function searchedUrls(res: MetaResponse): Set<string> {
  const urls = new Set<string>();
  const add = (u: unknown) => {
    const k = typeof u === "string" ? urlKey(u) : null;
    if (k) urls.add(k);
  };
  for (const item of res.output) {
    if (item.type === "web_search_call") {
      for (const r of (item.results as Array<{ url?: unknown }> | undefined) ?? []) add(r.url);
    }
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        for (const a of (c as { annotations?: Array<{ type?: string; url?: unknown }> })
          .annotations ?? []) {
          if (a.type === "url_citation") add(a.url);
        }
      }
    }
  }
  return urls;
}

/**
 * Two calls: a web search in plain words (with the search tool on, the model doesn't keep to a
 * JSON format), then a small call with no tools that turns those notes into candidates. Only URLs
 * the search actually returned or cited are kept.
 */
export async function findManual(
  client: MetaClient,
  models: Models,
  asset: { make: string; model: string },
) {
  const search = await client.respond({
    model: models.reasoning,
    instructions: prompts.manualSearch,
    input: [user(text(`Make: ${asset.make}\nModel: ${asset.model}`))],
    tools: [{ type: "web_search", search_context_size: "medium" }],
    include: ["web_search_call.results"],
    reasoning: { effort: "low" },
  });
  const seen = searchedUrls(search);
  if (!seen.size) return { ok: true as const, data: { candidates: [] }, dropped: 0, raw: search };

  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "manual_search",
    schema: ManualSearchOutput,
    instructions: prompts.manualCandidates,
    input: [
      user(
        text(
          `Make: ${asset.make}\nModel: ${asset.model}\n\nSearch notes:\n${outputText(search).slice(0, 6000)}\n\nURLs the search returned:\n${[...seen].join("\n")}`,
        ),
      ),
    ],
    effort: "low",
  });
  if (!r.ok) return r;
  const candidates = r.data.candidates
    .filter((c) => c.url.startsWith("https://"))
    .filter((c) => {
      const k = urlKey(c.url);
      return k !== null && seen.has(k);
    })
    .sort((a, b) => Number(b.official) - Number(a.official) || b.confidence - a.confidence);
  const kept = new Set(candidates.map((c) => c.url));
  return {
    ...r,
    data: { candidates },
    dropped: r.data.candidates.length - candidates.length,
    // For the log: where dropped URLs pointed, and how many URLs the search returned.
    droppedUrls: r.data.candidates.filter((c) => !kept.has(c.url)).map((c) => c.url),
    searchedCount: seen.size,
  };
}
