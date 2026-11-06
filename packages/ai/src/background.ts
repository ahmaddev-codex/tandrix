// Background help: work that needs no screen (look something up, compare, sum up, draft words),
// done by the reasoning model with web search while the user carries on. Answers come back as a
// short spoken summary plus the full detail to read.
import type { AgentCall, AgentStep, MacToolName } from "@tandrix/contracts";
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

const ON_THE_MAC = `
You can also act on the user's Mac with the tools, without touching their screen: add calendar events and reminders, make notes, draft (never send) emails, list files, play or pause music, open a folder in Finder, open a page in Safari, and use a web browser of your own for sites that need clicking or forms. Use them when the task asks for it; take each step once. Times are the user's local time. Nothing is sent, paid or deleted: if the task needs that, draft or prepare it and say what's left for them to confirm. After the last tool, answer in the SPOKEN/DETAIL shape, saying what you did.`;

const str = (description: string) => ({ type: "string", description });
const fn = (
  name: MacToolName,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
) => ({
  type: "function",
  name,
  description,
  parameters: { type: "object", properties, required, additionalProperties: false },
});
/** The Mac tools, as the model sees them. The Mac runs each with a fixed script. */
const MAC_TOOL_DEFS = [
  fn(
    "calendar_add_event",
    "Adds an event to the user's calendar.",
    {
      title: str("What it is"),
      start: str("Local date-time, YYYY-MM-DDTHH:MM"),
      end: str("Local date-time, YYYY-MM-DDTHH:MM; default an hour after start"),
      location: str("Where, if known"),
      notes: str("Anything else worth keeping"),
    },
    ["title", "start"],
  ),
  fn(
    "calendar_list_events",
    "Lists the user's calendar events between two local date-times.",
    {
      from: str("Local date-time, YYYY-MM-DDTHH:MM"),
      to: str("Local date-time, YYYY-MM-DDTHH:MM"),
    },
    ["from", "to"],
  ),
  fn(
    "reminders_add",
    "Adds a reminder.",
    {
      title: str("What to remember"),
      due: str("Local date-time, YYYY-MM-DDTHH:MM, if it has one"),
      notes: str("Detail, if any"),
    },
    ["title"],
  ),
  fn(
    "notes_create",
    "Makes a new note in Notes.",
    { title: str("The note's title"), body: str("The text") },
    ["title", "body"],
  ),
  fn(
    "mail_draft",
    "Writes an email and leaves it as a draft for the user to check and send. Never sends.",
    {
      to: str("Addresses, comma-separated"),
      subject: str("Subject"),
      body: str("The message"),
    },
    ["to", "subject", "body"],
  ),
  fn(
    "files_list",
    "Lists files in Desktop, Documents or Downloads, newest first, optionally matching a word.",
    {
      folder: { type: "string", enum: ["Desktop", "Documents", "Downloads"] },
      match: str("A word in the file name, optional"),
    },
    ["folder"],
  ),
  fn(
    "music_control",
    "Plays, pauses or skips in Music; with a search, plays the first song in the user's library whose name, artist, album or genre matches it.",
    {
      action: { type: "string", enum: ["play", "pause", "next", "previous"] },
      search: str("What to play, for example jazz or an artist; optional"),
    },
    ["action"],
  ),
  fn(
    "finder_open",
    "Opens one of the user's folders in a Finder window.",
    {
      folder: {
        type: "string",
        enum: [
          "Home",
          "Desktop",
          "Documents",
          "Downloads",
          "Pictures",
          "Movies",
          "Music",
          "Applications",
        ],
      },
    },
    ["folder"],
  ),
  fn(
    "safari_open",
    "Opens a web page in Safari, in front, for the user to see.",
    { url: str("A full https URL") },
    ["url"],
  ),
  fn(
    "browse",
    "Does something on a website in Tandrix's own browser (signed in where the user has signed in), out of sight. Give a goal and where to start; it reports what it did and found.",
    {
      goal: str("What to get done or find on the site, in one or two sentences"),
      url: str("Where to start, a full https URL"),
    },
    ["goal", "url"],
  ),
];

export type BackgroundStep =
  { status: "call"; calls: AgentCall[] } | ({ status: "done" } & BackgroundResult);

/**
 * One step of a background task. With `tools`, the model may ask the Mac to run some (the Mac runs
 * them and asks again with their outputs in `steps`); otherwise, or once it's done, it answers.
 * Stateless: the whole task so far is sent each time and nothing is stored.
 */
export async function runBackground(
  client: MetaClient,
  model: string,
  task: string,
  signal?: AbortSignal,
  opts: { tools?: boolean; steps?: AgentStep[]; now?: string } = {},
): Promise<BackgroundStep> {
  const steps = opts.steps ?? [];
  const asked = opts.now ? `${task}\n\n(It's now ${opts.now} on the user's Mac.)` : task;
  const res = await client.respond(
    {
      model,
      instructions: opts.tools ? INSTRUCTIONS + ON_THE_MAC : INSTRUCTIONS,
      input: [
        user(text(asked)),
        ...steps.flatMap((st) => [
          { type: "function_call", call_id: st.id, name: st.name, arguments: st.arguments },
          { type: "function_call_output", call_id: st.id, output: st.output },
        ]),
      ],
      tools: [
        { type: "web_search", search_context_size: "low" },
        // Past the step limit it must answer with what it has.
        ...(opts.tools && steps.length < 12 ? MAC_TOOL_DEFS : []),
      ],
      include: ["web_search_call.results"],
      reasoning: { effort: "low" },
    },
    signal,
  );
  const calls = macCalls(res.output ?? []);
  if (calls.length) return { status: "call", calls };
  return { status: "done", ...parseBackground(outputText(res), [...searchedUrls(res)]) };
}

const TOOL_NAMES = new Set<string>(MAC_TOOL_DEFS.map((t) => t.name));
/** The Mac tool calls in a response; anything else (a made-up tool) is ignored. */
export function macCalls(
  output: Array<{ type: string; name?: string; arguments?: string; call_id?: string }>,
): AgentCall[] {
  return output
    .filter((o) => o.type === "function_call" && o.call_id && o.name && TOOL_NAMES.has(o.name))
    .slice(0, 6)
    .map((o) => ({
      id: o.call_id!,
      name: o.name as MacToolName,
      arguments: (o.arguments ?? "{}").slice(0, 4000),
    }));
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
