// Searches the web for a model's manual with Muse Spark. Failures become "unavailable" so the app
// offers upload instead; it never blocks the job.
import { findManual, MetaApiError, MetaClient, type MetaConfig } from "@tandrix/ai";
import type { ManualSearchOutput } from "@tandrix/contracts";

export type ManualFinderResult =
  | { status: "found"; candidates: ManualSearchOutput["candidates"] }
  | { status: "unavailable"; message: string };

export interface ManualFinder {
  find(asset: { make: string; model: string }): Promise<ManualFinderResult>;
}

export const SEARCH_UNAVAILABLE =
  "Tandrix can't search for the manual right now. Upload it, or photograph the pages.";

export function metaManualFinder(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): ManualFinder {
  return {
    async find(asset) {
      try {
        const r = await findManual(client, config.models, asset);
        if (!r.ok) {
          // Where the output broke the schema (paths and messages only, never the content).
          log({
            level: "warn",
            event: "manual_search_invalid_output",
            issues: r.issues.slice(0, 6),
          });
          return { status: "unavailable", message: SEARCH_UNAVAILABLE };
        }
        if (r.dropped)
          log({
            level: "info",
            event: "manual_search_dropped_urls",
            count: r.dropped,
            searched: "searchedCount" in r ? r.searchedCount : undefined,
            dropped: "droppedUrls" in r ? r.droppedUrls?.slice(0, 5) : undefined,
          });
        return { status: "found", candidates: r.data.candidates };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({
            level: "warn",
            event: "manual_search_model_error",
            status: e.status,
            code: e.code,
          });
          return { status: "unavailable", message: SEARCH_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelFinder: ManualFinder = {
  async find() {
    return { status: "unavailable", message: SEARCH_UNAVAILABLE };
  },
};
