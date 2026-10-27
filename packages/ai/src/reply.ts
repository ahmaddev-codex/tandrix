// Spoken replies come back as free text, and models sometimes leak their own tool-call markup,
// code fences or JSON into it ("<atem:function_calls><atem:invoke name=\"computer.stop\">…").
// Whatever the user hears and reads goes through here: the words meant for them, or nothing.

/** Parameters whose value is words meant for the user. */
const SAYING = /^(answer|text|message|reply|content|explanation|instruction)$/i;

export function cleanSpokenReply(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Tool-call markup (any namespace): keep only what it meant to say to the user.
  if (/<\/?[\w.-]*:?(function_calls|invoke|parameter|tool_call)\b/i.test(text)) {
    const said: string[] = [];
    for (const m of text.matchAll(
      /<[\w.-]*:?parameter\s+name="([^"]+)"\s*>([\s\S]*?)<\/[\w.-]*:?parameter>/gi,
    ))
      if (SAYING.test(m[1]!)) said.push(m[2]!.trim());
    // Words outside the markup are meant for the user too.
    const outside = text
      .replace(/<([\w.-]*:?)(function_calls|tool_call|invoke|parameter)\b[\s\S]*?<\/\1\2>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .trim();
    text = [outside, ...said].filter(Boolean).join(" ");
  }

  // A reply wrapped in a code fence: unwrap it; a fence that's only code: drop it.
  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_m, body: string) =>
    /[{}<>;=]|^\s*(const|let|function|import|def|class)\b/m.test(body) ? " " : body,
  );

  // JSON instead of words: take the field meant for the user.
  if (/^\s*[{[]/.test(text)) {
    try {
      const v = JSON.parse(text) as Record<string, unknown>;
      const key = Object.keys(v).find((k) => SAYING.test(k) && typeof v[k] === "string");
      text = key ? String(v[key]) : "";
    } catch {
      // Not JSON after all.
    }
  }

  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
