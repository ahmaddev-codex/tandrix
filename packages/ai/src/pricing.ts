// What Meta charges, so local testing can meter spend (prices as published, Oct 2026; check
// https://dev.meta.ai/docs/pricing-rate-limits before relying on them). Reasoning tokens are
// billed as output.

export interface SpendEntry {
  model: string;
  usd: number;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  seconds?: number;
}

/** USD per million tokens. */
const tokenPrices: Record<string, { input: number; cachedInput: number; output: number }> = {
  "muse-spark-1.3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
  "muse-spark-1.3-contributor": { input: 0.1, cachedInput: 0.002, output: 0.2 },
};
const SAM_PER_IMAGE = 2.5 / 1000;
const TRANSCRIBE_PER_SECOND = 0.18 / 3600;
/** Unknown models are priced as Spark, the dearest we use, so the meter never under-counts. */
const fallback = tokenPrices["muse-spark-1.3"]!;

export function tokenCost(
  model: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  },
): SpendEntry {
  const p = tokenPrices[model] ?? fallback;
  const input = usage.input_tokens ?? 0;
  const cached = Math.min(usage.input_tokens_details?.cached_tokens ?? 0, input);
  const output = usage.output_tokens ?? 0;
  return {
    model,
    inputTokens: input,
    outputTokens: output,
    usd: ((input - cached) * p.input + cached * p.cachedInput + output * p.output) / 1_000_000,
  };
}

export const segmentationCost = (model: string, images = 1): SpendEntry => ({
  model,
  images,
  usd: images * SAM_PER_IMAGE,
});

/** Metered in whole seconds, rounded down. */
export const transcriptionCost = (model: string, durationMs: number): SpendEntry => {
  const seconds = Math.floor(durationMs / 1000);
  return { model, seconds, usd: seconds * TRANSCRIBE_PER_SECOND };
};

/**
 * Where spend goes. `allow` runs before every paid call and throws to stop it (a spend cap);
 * `record` runs after, with what the call cost.
 */
export interface SpendMeter {
  allow(model: string): void;
  record(entry: SpendEntry): void;
}

let meter: SpendMeter | null = null;
/** Set once at start-up (the API's ledger); every MetaClient then meters its calls. */
export function setSpendMeter(m: SpendMeter | null) {
  meter = m;
}
export const spendMeter = () => meter;
