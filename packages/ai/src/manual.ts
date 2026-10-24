// Find manufacturer manuals with Muse Spark web search. Only URLs the search actually returned are
// kept: a model can invent plausible manual links, and we must never fetch one of those.
import { ManualSearchOutput } from "@tandrix/contracts";
import type { MetaClient, MetaResponse } from "./client";
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

export async function findManual(
  client: MetaClient,
  models: Models,
  asset: { make: string; model: string },
) {
  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "manual_search",
    schema: ManualSearchOutput,
    instructions: prompts.manualSearch,
    input: [user(text(`Make: ${asset.make}\nModel: ${asset.model}`))],
    effort: "low",
    extra: {
      tools: [{ type: "web_search", search_context_size: "medium" }],
      include: ["web_search_call.results"],
    },
  });
  if (!r.ok) return r;
  const seen = searchedUrls(r.raw);
  const candidates = r.data.candidates
    .filter((c) => c.url.startsWith("https://"))
    .filter((c) => {
      const k = urlKey(c.url);
      return k !== null && seen.has(k);
    })
    .sort((a, b) => Number(b.official) - Number(a.official) || b.confidence - a.confidence);
  return { ...r, data: { candidates }, dropped: r.data.candidates.length - candidates.length };
}
