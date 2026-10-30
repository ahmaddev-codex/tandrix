// Background help: work that needs no screen (look something up, compare, sum up, draft words),
// done by the reasoning model with web search while the user carries on. Answers come back as a
// short spoken summary plus the full detail to read.
import { outputText, type MetaClient } from "./client";
import { text, user } from "./content";
import { searchedUrls } from "./manual";
import { cleanSpokenReply } from "./reply";

export interface BackgroundResult {
  /** One or two sentences, said aloud when it's ready. */
  spoken: string;
  /** The full answer, to read. */
  detail: string;
  sources: string[];
}

const INSTRUCTIONS = `You are Tandrix, a quick, capable assistant working on a task in the background while the user does something else. Do the task fully: search the web when facts, prices, times or recent information matter; otherwise just answer.
Reply in this exact shape:
SPOKEN: one or two short, natural sentences with the answer itself (what they'd want to hear first). Warm and plain, no lists.
DETAIL: the full answer to read: the findings, options or the drafted text, clearly laid out in short paragraphs or simple lines. No markdown headings, no tables.
Never invent facts; if something can't be found, say so plainly.`;

export async function runBackground(
  client: MetaClient,
  model: string,
  task: string,
  signal?: AbortSignal,
): Promise<BackgroundResult> {
  const res = await client.respond(
    {
      model,
      instructions: INSTRUCTIONS,
      input: [user(text(task))],
      tools: [{ type: "web_search", search_context_size: "low" }],
      include: ["web_search_call.results"],
      reasoning: { effort: "low" },
    },
    signal,
  );
  return parseBackground(outputText(res), [...searchedUrls(res)]);
}

/** Splits the model's reply into what's said and what's read. */
export function parseBackground(raw: string, sources: string[] = []): BackgroundResult {
  const spoken = /SPOKEN:\s*([\s\S]*?)(?:\n\s*DETAIL:|$)/i.exec(raw)?.[1]?.trim() ?? "";
  const detail = /DETAIL:\s*([\s\S]*)$/i.exec(raw)?.[1]?.trim() ?? "";
  const fallback = raw.trim();
  return {
    spoken: cleanSpokenReply(spoken || fallback.split(/\n/)[0] || "Done.").slice(0, 400),
    detail: (detail || fallback).slice(0, 6000),
    sources: sources.slice(0, 8),
  };
}
