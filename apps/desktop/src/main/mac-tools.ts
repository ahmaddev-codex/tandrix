// What background agents can do on this Mac without its screen, mouse or keyboard: add calendar
// events and reminders, make notes, draft emails, list files. Each tool is a fixed AppleScript;
// what the model wrote reaches it only as separate arguments (`on run argv`), never as script
// text, so it can't run anything else. Nothing here sends, pays or deletes. The first use of each
// app asks the user (macOS Automation permission).
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentCall, MacToolName } from "@tandrix/contracts";

/** "2026-10-31T09:00" → its parts, as AppleScript takes them; null if it isn't one. */
export function dateParts(s: unknown): string[] | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return [y, mo, d, h, mi].map(String);
}

/** An hour after a start, as parts (rolls over the day the way AppleScript dates do). */
const anHourLater = (p: string[]) => {
  const t = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(p[3]) + 1, Number(p[4]));
  return [t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes()].map(String);
};

/** Starts an app out of sight (launch, never activate) and waits until it answers. */
const ENSURE = `
on ensure(appName)
  if application appName is not running then
    tell application appName to launch
    repeat 60 times
      if application appName is running then exit repeat
      delay 0.1
    end repeat
    delay 0.6
  end if
end ensure`;

const MKDATE = `
on mkdate(p, i)
  set t to current date
  set day of t to 1
  set year of t to (item i of p) as integer
  set month of t to (item (i + 1) of p) as integer
  set day of t to (item (i + 2) of p) as integer
  set time of t to ((item (i + 3) of p) as integer) * 3600 + ((item (i + 4) of p) as integer) * 60
  return t
end mkdate`;

/** The scripts. Arguments arrive as `argv`, in the order given by each tool below. */
export const SCRIPTS = {
  calendar_add_event: `${ENSURE}${MKDATE}
on run argv
  ensure("Calendar")
  set s to mkdate(argv, 2)
  set e to mkdate(argv, 7)
  tell application "Calendar"
    set cal to first calendar whose writable is true
    make new event at end of events of cal with properties {summary:(item 1 of argv), start date:s, end date:e, location:(item 12 of argv), description:(item 13 of argv)}
    return "Added to " & (name of cal)
  end tell
end run`,
  calendar_list_events: `${ENSURE}${MKDATE}
on run argv
  ensure("Calendar")
  set s to mkdate(argv, 1)
  set e to mkdate(argv, 6)
  set out to {}
  tell application "Calendar"
    repeat with c in calendars
      repeat with ev in (every event of c whose start date is greater than or equal to s and start date is less than or equal to e)
        set end of out to (summary of ev) & " | " & ((start date of ev) as string)
        if (count of out) is 40 then exit repeat
      end repeat
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  return out as text
end run`,
  reminders_add: `${ENSURE}${MKDATE}
on run argv
  ensure("Reminders")
  tell application "Reminders"
    if (item 3 of argv) is "" then
      make new reminder with properties {name:(item 1 of argv), body:(item 2 of argv)}
    else
      make new reminder with properties {name:(item 1 of argv), body:(item 2 of argv), due date:my mkdate(argv, 3)}
    end if
  end tell
  return "Added"
end run`,
  notes_create: `${ENSURE}
on run argv
  ensure("Notes")
  tell application "Notes" to make new note with properties {name:(item 1 of argv), body:(item 2 of argv)}
  return "Made"
end run`,
  mail_draft: `${ENSURE}
on run argv
  ensure("Mail")
  tell application "Mail"
    set m to make new outgoing message with properties {subject:(item 2 of argv), content:(item 3 of argv), visible:false}
    set AppleScript's text item delimiters to ","
    repeat with a in text items of (item 1 of argv)
      tell m to make new to recipient at end of to recipients with properties {address:(a as text)}
    end repeat
    save m
  end tell
  return "Saved to Drafts"
end run`,
} as const;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

const field = (a: Record<string, unknown>, k: string, max = 2000) =>
  typeof a[k] === "string" ? (a[k] as string).slice(0, max) : "";

/** A tool's script arguments from what the model wrote, or why they won't do. */
export function scriptArgs(
  name: Exclude<MacToolName, "files_list" | "browse">,
  a: Record<string, unknown>,
): string[] | string {
  switch (name) {
    case "calendar_add_event": {
      const start = dateParts(a.start);
      if (!field(a, "title") || !start) return "Needs a title and a start like 2026-10-31T09:00.";
      const end = dateParts(a.end) ?? anHourLater(start);
      return [
        field(a, "title", 300),
        ...start,
        ...end,
        field(a, "location", 300),
        field(a, "notes"),
      ];
    }
    case "calendar_list_events": {
      const from = dateParts(a.from);
      const to = dateParts(a.to);
      return from && to ? [...from, ...to] : "Needs from and to like 2026-10-31T00:00.";
    }
    case "reminders_add": {
      if (!field(a, "title")) return "Needs a title.";
      const due = a.due ? dateParts(a.due) : null;
      if (a.due && !due) return "The due time should look like 2026-10-31T09:00.";
      return [field(a, "title", 300), field(a, "notes"), ...(due ?? [""])];
    }
    case "notes_create":
      if (!field(a, "title") || !field(a, "body")) return "Needs a title and a body.";
      // Notes keeps HTML: the title as its heading, then the text, escaped.
      return [
        field(a, "title", 300),
        `<h1>${escapeHtml(field(a, "title", 300))}</h1>${escapeHtml(field(a, "body", 8000))}`,
      ];
    case "mail_draft": {
      const to = field(a, "to", 1000)
        .split(",")
        .map((x) => x.trim())
        .filter((x) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(x));
      if (!to.length || !field(a, "subject"))
        return "Needs at least one email address and a subject.";
      return [to.join(","), field(a, "subject", 300), field(a, "body", 8000)];
    }
  }
}

function osascript(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script, ...args], { timeout: 20_000 }, (err, out, errOut) => {
      if (err) reject(new Error((errOut || err.message).trim().slice(0, 300)));
      else resolve(out.trim());
    });
  });
}

const FOLDERS = { Desktop: "Desktop", Documents: "Documents", Downloads: "Downloads" } as const;

async function listFiles(a: Record<string, unknown>): Promise<string> {
  const folder = FOLDERS[a.folder as keyof typeof FOLDERS];
  if (!folder) return "Folder must be Desktop, Documents or Downloads.";
  const dir = join(homedir(), folder);
  const match = field(a, "match", 100).toLowerCase();
  const names = (await readdir(dir)).filter(
    (n) => !n.startsWith(".") && (!match || n.toLowerCase().includes(match)),
  );
  const dated = await Promise.all(
    names
      .slice(0, 500)
      .map(async (n) => ({ n, t: (await stat(join(dir, n)).catch(() => null))?.mtimeMs ?? 0 })),
  );
  dated.sort((x, y) => y.t - x.t);
  return (
    dated
      .slice(0, 30)
      .map((f) => f.n)
      .join("\n") || "Nothing there."
  );
}

export interface MacToolDeps {
  /** Runs Tandrix's own out-of-sight browser on a goal; what it did and found. */
  browse(goal: string, url: string): Promise<string>;
}

/** Runs one tool call from a background agent; the output goes back to the model. */
export async function runMacTool(call: AgentCall, deps: MacToolDeps): Promise<string> {
  let a: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(call.arguments);
    a = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return "The arguments weren't valid JSON.";
  }
  try {
    if (call.name === "files_list") return await listFiles(a);
    if (call.name === "browse") {
      const url = field(a, "url", 2000);
      if (!/^https:\/\//i.test(url) || !field(a, "goal")) return "Needs a goal and an https URL.";
      return (await deps.browse(field(a, "goal", 600), url)).slice(0, 8000);
    }
    const args = scriptArgs(call.name, a);
    if (typeof args === "string") return args;
    return (await osascript(SCRIPTS[call.name], args)) || "Done";
  } catch (e) {
    const msg = (e as Error).message;
    // The user said no to Tandrix using that app (or hasn't been asked yet).
    if (/-1743|not authori[sz]ed|not allowed/i.test(msg))
      return "Not allowed: the user hasn't let Tandrix use that app. Tell them to allow it in System Settings > Privacy & Security > Automation.";
    return `Couldn't do it: ${msg}`;
  }
}
