// What the presence bar says while Tandrix works: short thinking phrases in turn, never the words
// it's about to speak. Phrases come from what the work is about (the manual, the parts, a
// calendar, a chat) mixed with general ones, so the bar reads as busy on this job, not a script.

/** Said about any work. */
export const GENERAL_PHRASES = [
  "Thinking",
  "Theorizing",
  "Pondering",
  "Working it out",
  "Considering",
  "Mulling it over",
  "Connecting the dots",
  "Piecing it together",
  "Reasoning",
  "Weighing it up",
  "Puzzling it out",
  "Figuring it out",
  "Sorting it out",
  "Lining things up",
  "Getting oriented",
  "Taking stock",
  "Sizing it up",
  "Mapping it out",
  "Planning the steps",
  "Choosing the next move",
  "Double-checking",
  "Cross-checking",
  "Looking closer",
  "Focusing",
  "Concentrating",
  "Reflecting",
  "Deliberating",
  "Calculating",
  "Computing",
  "Crunching",
  "Processing",
  "Analyzing",
  "Examining",
  "Investigating",
  "Exploring",
  "Surveying",
  "Scanning",
  "Inspecting",
  "Reviewing",
  "Evaluating",
  "Assessing",
  "Comparing",
  "Untangling",
  "Unpacking it",
  "Breaking it down",
  "Tracing it through",
  "Following the thread",
  "Narrowing it down",
  "Homing in",
  "Zeroing in",
  "Getting closer",
  "Almost there",
  "Making sense of it",
  "Lining up the details",
  "Putting it in order",
  "Organizing",
  "Arranging",
  "Tidying up",
  "Preparing",
  "Getting ready",
  "Setting it up",
  "On it",
  "Working",
  "Still working",
  "Keeping at it",
  "Getting there",
  "Thinking it through",
  "Running through it",
  "Checking the details",
  "Confirming",
  "Verifying",
  "Validating",
  "Making sure",
  "Being careful",
  "Taking care",
  "Reading the screen",
  "Looking around",
  "Finding my place",
  "Getting my bearings",
  "Brainstorming",
  "Hypothesizing",
  "Speculating",
  "Deducing",
  "Inferring",
  "Synthesizing",
  "Distilling",
  "Summarizing",
  "Polishing",
  "Refining",
  "Fine-tuning",
  "Cogitating",
  "Ruminating",
  "Contemplating",
  "Musing",
  "Noodling",
  "Tinkering",
  "Calibrating",
  "Orchestrating",
  "Composing",
  "Assembling",
  "Gathering",
] as const;

/** Said while the hands are busy on the screen. */
export const ACTING_PHRASES = [
  "Clicking through",
  "Finding the button",
  "Filling it in",
  "Typing it out",
  "Scrolling down",
  "Switching apps",
  "Opening it up",
  "Moving along",
  "Stepping through",
  "Following the steps",
  "Navigating",
  "Getting there",
  "Lining up the click",
  "Pressing on",
  "Working the controls",
] as const;

interface Topic {
  /** Words in the task or the work that mean this topic. */
  match: RegExp;
  phrases: readonly string[];
}

/** Work-specific phrases, chosen when the job mentions their topic. */
export const TOPICS: readonly Topic[] = [
  {
    match: /\bmanual|guide|instructions?|datasheet|pdf\b/i,
    phrases: [
      "Reading the manual",
      "Finding the right page",
      "Checking the manual",
      "Looking up the figure",
      "Reading the fine print",
      "Matching the diagram",
      "Following the manual",
      "Checking the specs",
    ],
  },
  {
    match: /\bparts?\b|components?|pieces?|screws?|kit\b|inventory/i,
    phrases: [
      "Checking each part",
      "Counting the parts",
      "Matching parts to the list",
      "Looking for what's missing",
      "Sorting the pieces",
      "Checking the kit",
      "Ticking off parts",
    ],
  },
  {
    match: /\bsteps?\b|procedure|assembl|install|build|fit|mount|wire|connect/i,
    phrases: [
      "Planning the steps",
      "Ordering the steps",
      "Checking the next step",
      "Working out the order",
      "Checking it's safe",
      "Following the procedure",
      "Lining up the next step",
    ],
  },
  {
    match: /\bphotos?\b|picture|image|camera|look at|see\b/i,
    phrases: [
      "Studying the photo",
      "Looking closely",
      "Spotting the details",
      "Comparing with the picture",
      "Reading the picture",
    ],
  },
  {
    match: /\bcalendar|schedule|meeting|event|appointment|interview|slot|agenda/i,
    phrases: [
      "Checking your calendar",
      "Finding the dates",
      "Lining up the times",
      "Finding a free slot",
      "Adding the events",
      "Checking for clashes",
      "Setting the times",
    ],
  },
  {
    match: /\bwhatsapp|messages?|chat|imessage|slack|telegram|text\b|dm\b/i,
    phrases: [
      "Reading the chat",
      "Finding the conversation",
      "Scrolling the messages",
      "Picking out the details",
      "Reading the thread",
      "Finding the message",
    ],
  },
  {
    match: /\be-?mails?\b|inbox|gmail|outlook|mail\b|reply|draft/i,
    phrases: [
      "Checking your inbox",
      "Reading the email",
      "Drafting a reply",
      "Finding the email",
      "Sorting the mail",
    ],
  },
  {
    match: /\bbrowser|safari|chrome|website|web\b|search|google|online|url|link/i,
    phrases: [
      "Searching the web",
      "Reading the page",
      "Following the link",
      "Comparing sources",
      "Checking the site",
      "Scanning the results",
    ],
  },
  {
    match: /\bfiles?\b|folder|finder|document|download|save|desktop\b/i,
    phrases: [
      "Looking through your files",
      "Finding the folder",
      "Opening the document",
      "Checking the downloads",
      "Sorting the files",
    ],
  },
  {
    match: /\bspreadsheet|sheet|excel|numbers\b|table|cells?\b|budget|invoice/i,
    phrases: [
      "Reading the sheet",
      "Checking the numbers",
      "Adding it up",
      "Filling the cells",
      "Lining up the columns",
    ],
  },
  {
    match: /\bsettings?|preferences|wi-?fi|bluetooth|display|sound|network|router/i,
    phrases: [
      "Finding the setting",
      "Checking the settings",
      "Adjusting it",
      "Checking the connection",
      "Looking in Settings",
    ],
  },
  {
    match: /\bcode|terminal|repo|git|bug|error|xcode|vs ?code|script/i,
    phrases: [
      "Reading the code",
      "Tracing the error",
      "Checking the logs",
      "Following the stack",
      "Testing a fix",
    ],
  },
  {
    match: /\bnotes?\b|write|document|word|pages\b|essay|list/i,
    phrases: [
      "Writing it down",
      "Drafting it",
      "Choosing the words",
      "Tidying the wording",
      "Making a list",
    ],
  },
  {
    match: /\bmusic|spotify|song|playlist|podcast|video|youtube/i,
    phrases: ["Finding the track", "Queueing it up", "Searching the library", "Setting the volume"],
  },
  {
    match: /\bbook|order|buy|cart|checkout|price|shop|deliver/i,
    phrases: ["Comparing prices", "Checking the options", "Reading the reviews", "Checking stock"],
  },
  {
    match: /\bmaps?\b|directions|route|travel|flight|trip|hotel/i,
    phrases: ["Checking the route", "Finding directions", "Comparing times", "Checking the trip"],
  },
];

/** Every phrase there is, general and work-specific. */
export const ALL_PHRASES: readonly string[] = [
  ...new Set([...GENERAL_PHRASES, ...ACTING_PHRASES, ...TOPICS.flatMap((t) => t.phrases)]),
];

/** The phrases that fit this work: its topics first, then acting and general ones. */
export function phrasesFor(about: string, acting = false): { topical: string[]; rest: string[] } {
  const topical = [...new Set(TOPICS.filter((t) => t.match.test(about)).flatMap((t) => t.phrases))];
  const rest = [...(acting ? ACTING_PHRASES : []), ...GENERAL_PHRASES].filter(
    (p) => !topical.includes(p),
  );
  return { topical, rest };
}

/**
 * The next phrase: two in three from the job's topics when it has any, never one of the last
 * few shown. `random` is injectable for tests.
 */
export function nextPhrase(
  about: string,
  recent: readonly string[],
  { acting = false, random = Math.random }: { acting?: boolean; random?: () => number } = {},
): string {
  const { topical, rest } = phrasesFor(about, acting);
  const fresh = (list: string[]) => list.filter((p) => !recent.includes(p));
  const pool =
    topical.length && random() < 2 / 3 && fresh(topical).length ? fresh(topical) : fresh(rest);
  const from = pool.length ? pool : rest;
  return from[Math.floor(random() * from.length)] ?? "Thinking";
}
