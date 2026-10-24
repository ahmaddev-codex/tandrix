import { z } from "zod";
import type { Models } from "./pipelines";

const Env = z.object({
  META_API_KEY: z.string().min(1, "META_API_KEY is not set"),
  META_API_BASE_URL: z.url().default("https://api.meta.ai/v1"),
  META_MODEL_REASONING: z.string().min(1).default("muse-spark-1.3"),
  META_MODEL_COMPUTER_USE: z.string().min(1).default("muse-spark-1.3"),
  META_MODEL_SEGMENTATION: z.string().min(1).default("sam-3.1"),
  META_MODEL_TRANSCRIBE: z.string().min(1).default("muse-voice-transcribe-1.0"),
  META_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(60_000),
});

export interface MetaConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  models: Models & { computerUse: string; transcribe: string };
}

/** Reads Meta settings from the environment. Throws with the variable names that are wrong. */
export function loadMetaConfig(env: Record<string, string | undefined> = process.env): MetaConfig {
  const r = Env.safeParse(env);
  if (!r.success) {
    throw new Error(
      `Invalid Meta configuration: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const e = r.data;
  return {
    apiKey: e.META_API_KEY,
    baseUrl: e.META_API_BASE_URL,
    timeoutMs: e.META_TIMEOUT_MS,
    models: {
      reasoning: e.META_MODEL_REASONING,
      segmentation: e.META_MODEL_SEGMENTATION,
      computerUse: e.META_MODEL_COMPUTER_USE,
      transcribe: e.META_MODEL_TRANSCRIBE,
    },
  };
}
