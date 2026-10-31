// Small intent helpers for the live pipelines. (An earlier specialist-agent registry lived
// here; the pipelines call prompts.ts directly, so the registry was removed rather than left
// to drift from production behavior.)

const ONLINE_LOOKUP_RE =
  /\b(search online|look up online|find\b.+\bonline|online instructions|instructions online|search the internet|search the web|look on the web)\b/i;

/** True when a user prompt asks Tandrix to look up instructions or solutions online and apply them. */
export function needsOnlineLookup(text: string): boolean {
  return ONLINE_LOOKUP_RE.test(text.trim());
}
