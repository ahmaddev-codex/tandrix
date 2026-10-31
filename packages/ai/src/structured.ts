// Schema-constrained generation: ask for JSON matching a Zod schema, validate, repair once.
import { z } from "zod";
import {
  MetaApiError,
  outputText,
  type MetaClient,
  type MetaResponse,
  type ResponseUsage,
} from "./client";
import type { InputMessage } from "./content";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface StructuredRequest<S extends z.ZodType> {
  model: string;
  name: string;
  schema: S;
  instructions: string;
  input: InputMessage[];
  effort?: ReasoningEffort;
  signal?: AbortSignal;
  /** For calls someone is waiting on: ask again after this long, the first answer winning. */
  hedgeMs?: number;
  /** Extra Responses API fields, e.g. tools: [{ type: "web_search" }], include: [...]. */
  extra?: Record<string, unknown>;
}

export type StructuredResult<T> =
  | {
      ok: true;
      data: T;
      responseId: string;
      usage?: ResponseUsage;
      repaired: boolean;
      /** The response the data came from (e.g. to read web search results). */
      raw: MetaResponse;
    }
  | { ok: false; reason: "invalid_output"; issues: string[]; responseId: string };

const issueList = (e: z.ZodError) =>
  e.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

function parse<S extends z.ZodType>(schema: S, raw: string) {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(raw));
  } catch {
    return { success: false as const, issues: ["Output was not valid JSON."] };
  }
  const r = schema.safeParse(json);
  return r.success
    ? { success: true as const, data: r.data as z.output<S> }
    : { success: false as const, issues: issueList(r.error) };
}

/** Models occasionally wrap JSON in a ```json fence despite the format setting. */
function stripFence(s: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(s);
  return m ? m[1]! : s;
}

export async function generateStructured<S extends z.ZodType>(
  client: MetaClient,
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.output<S>>> {
  const jsonSchema = z.toJSONSchema(req.schema, { io: "input", target: "draft-2020-12" });
  const base = {
    model: req.model,
    instructions: req.instructions,
    text: { format: { type: "json_schema", name: req.name, schema: jsonSchema, strict: false } },
    ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
    ...req.extra,
  };

  const first = req.hedgeMs
    ? await client.respondHedged({ ...base, input: req.input }, req.signal, req.hedgeMs)
    : await client.respond({ ...base, input: req.input }, req.signal);
  const a = parse(req.schema, outputText(first));
  if (a.success)
    return {
      ok: true,
      data: a.data,
      responseId: first.id,
      usage: first.usage,
      repaired: false,
      raw: first,
    };

  // One repair attempt with the validation errors; never more, so a bad prompt can't loop.
  const repair: InputMessage = {
    type: "message",
    role: "user",
    content: [
      {
        type: "input_text",
        text: `Your previous output did not match the required schema:\n- ${a.issues.join("\n- ")}\nReturn only corrected JSON for the same task.`,
      },
    ],
  };
  const second = await client.respond({ ...base, input: [...req.input, repair] }, req.signal);
  const b = parse(req.schema, outputText(second));
  if (b.success)
    return {
      ok: true,
      data: b.data,
      responseId: second.id,
      usage: second.usage,
      repaired: true,
      raw: second,
    };
  return { ok: false, reason: "invalid_output", issues: b.issues, responseId: second.id };
}

export { MetaApiError };
