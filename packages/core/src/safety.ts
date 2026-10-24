// Deterministic safety rules. Model output can add hazard tags but never remove them.
import type { HazardTag, SafetyGate } from "@tandrix/contracts";

const gateForTag: Partial<Record<HazardTag, SafetyGate>> = {
  electrical_isolation: "isolate_power",
  pressure: "release_pressure",
  rotating_parts: "lock_rotation",
  hot_surface: "cool_down",
  heavy_lift: "lifting_plan",
  chemical: "chemical_ppe",
};

const tagOrder: HazardTag[] = [
  "live_electrical",
  "electrical_isolation",
  "pressure",
  "rotating_parts",
  "hot_surface",
  "heavy_lift",
  "chemical",
];

/** Keyword rules that tag a step regardless of what the model said. Conservative by design. */
const keywordRules: Array<{ tag: HazardTag; pattern: RegExp }> = [
  {
    tag: "live_electrical",
    pattern:
      /\b(live|energi[sz]ed|hot)\s+(wir(e|es|ing)|circuit|conductor|terminal)s?\b|\bwhile (it is |it's )?(powered|energi[sz]ed|running)\b|\b(rewire|wire up|connect the (mains|supply|motor leads))\b/i,
  },
  {
    tag: "electrical_isolation",
    pattern:
      /\b(isolat\w*|lock[- ]?out|tag[- ]?out|LOTO|disconnect (the )?(power|supply)|switch off|terminal box|motor (leads|cable))\b/i,
  },
  {
    tag: "pressure",
    pattern:
      /\b(pressur\w*|bleed|vent the|drain the (pump|casing|line)|discharge valve|suction valve)\b/i,
  },
  {
    tag: "rotating_parts",
    pattern: /\b(coupling|shaft rotat\w*|impeller rotat\w*|spin(ning)?|rotat(e|ing) by hand)\b/i,
  },
  {
    tag: "hot_surface",
    pattern: /\b(hot (surface|casing|fluid)|let it cool|temperature above)\b/i,
  },
  {
    tag: "heavy_lift",
    pattern: /\b(lift(ing)? (the )?(motor|pump|unit|housing)|hoist|sling|two[- ]person|crane)\b/i,
  },
  { tag: "chemical", pattern: /\b(solvent|chemical|corrosive|lubricant|glycol|cleaning agent)\b/i },
];

export function detectHazards(text: string): HazardTag[] {
  return keywordRules.filter((r) => r.pattern.test(text)).map((r) => r.tag);
}

/** Union of model-proposed and rule-detected tags, in a stable order. */
export function mergeHazardTags(
  modelTags: readonly HazardTag[],
  ruleTags: readonly HazardTag[],
): HazardTag[] {
  const all = new Set<HazardTag>([...modelTags, ...ruleTags]);
  return tagOrder.filter((t) => all.has(t));
}

/** Tags for a step: what the model proposed plus whatever the rules find in the step's text. */
export function hazardTagsForStep(step: {
  hazardTags: readonly HazardTag[];
  title: string;
  instruction: string;
  caution?: string | undefined;
}): HazardTag[] {
  const text = [step.title, step.instruction, step.caution ?? ""].join("\n");
  return mergeHazardTags(step.hazardTags, detectHazards(text));
}

export function requiredGates(tags: readonly HazardTag[]): SafetyGate[] {
  const gates = tags.map((t) => gateForTag[t]).filter((g): g is SafetyGate => g !== undefined);
  return [...new Set(gates)];
}

export function missingGates(
  tags: readonly HazardTag[],
  confirmed: readonly SafetyGate[],
): SafetyGate[] {
  return requiredGates(tags).filter((g) => !confirmed.includes(g));
}

export interface Refusal {
  refused: true;
  reason: string;
}

/** Steps Tandrix will not guide. The UI shows a stop SafetyGate with this reason. */
export function refusalFor(tags: readonly HazardTag[]): Refusal | null {
  if (tags.includes("live_electrical")) {
    return {
      refused: true,
      reason:
        "Electrical wiring and live work need a qualified electrician. Tandrix will continue with the other steps.",
    };
  }
  return null;
}

/** Copy for each gate's SafetyGate panel. */
export const gateCopy: Record<SafetyGate, { title: string; body: string; action: string }> = {
  isolate_power: {
    title: "Before you start this step",
    body: "Isolate power at the panel and lock it off.",
    action: "Confirm isolated",
  },
  release_pressure: {
    title: "Before you open anything",
    body: "Close the suction and discharge valves and release the pressure in the line.",
    action: "Confirm pressure released",
  },
  lock_rotation: {
    title: "Before you touch moving parts",
    body: "Make sure the shaft can't turn: power isolated and the coupling at rest.",
    action: "Confirm it can't turn",
  },
  cool_down: {
    title: "Before you touch the casing",
    body: "Let the unit cool until it's safe to touch.",
    action: "Confirm it's cool",
  },
  lifting_plan: {
    title: "Before you lift",
    body: "Use a lifting aid or a second person for this part.",
    action: "Confirm lifting plan",
  },
  chemical_ppe: {
    title: "Before you handle this",
    body: "Wear the gloves and eye protection the product label asks for.",
    action: "Confirm PPE on",
  },
};
