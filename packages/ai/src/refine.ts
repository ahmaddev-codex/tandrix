/**
 * Landing each marked part exactly. Asked for boxes, the model places parts loosely (on the
 * marking bench, about a third to two thirds overlap with the true part), but its computer-use
 * clicks land on the part itself far more often: it's trained to point precisely. So each part is
 * clicked, in parallel, and the click is the part's point; a box that missed the click is moved to
 * it. The shape then comes from the screenshot's pixels round that point, on the Mac.
 */
import type { MetaClient, MetaResponse } from "./client";
import type { InputPart } from "./content";
import { text, user } from "./content";
import { prompts } from "./prompts";

export interface PartBox {
  label: string;
  detail?: string;
  point?: { x: number; y: number };
  box: { x: number; y: number; w: number; h: number };
}

/** A click that hasn't come by then leaves the part as it was. */
export const POINT_TIMEOUT_MS = 14_000;

function clickIn(res: MetaResponse): { x: number; y: number } | null {
  for (const o of res.output) {
    if (o.type !== "computer_call") continue;
    const call = o as { actions?: unknown[]; action?: unknown };
    const all = Array.isArray(call.actions) ? call.actions : call.action ? [call.action] : [];
    for (const a of all) {
      const p = a as { x?: unknown; y?: unknown };
      if (typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }
  }
  return null;
}

/** Every part clicked, in parallel; each resolves on its own (the first can be drawn at once). */
export function locateParts<P extends PartBox>(
  client: MetaClient,
  model: string,
  screenshot: InputPart,
  size: { width: number; height: number },
  parts: P[],
  signal?: AbortSignal,
): Array<Promise<P>> {
  return parts.map(async (p) => {
    try {
      const asked = client
        .respond(
          {
            model,
            instructions: prompts.pointPart,
            tools: [{ type: "computer" }],
            reasoning: { effort: "low" },
            input: [
              user(text(`Point at: ${p.label}${p.detail ? ` (${p.detail})` : ""}.`), screenshot),
            ],
          },
          signal,
        )
        .catch(() => null);
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), POINT_TIMEOUT_MS));
      const res = await Promise.race([asked, timeout]);
      const at = res ? clickIn(res) : null;
      if (!at || at.x < 0 || at.y < 0 || at.x >= size.width || at.y >= size.height) return p;
      const point = { x: Math.round(at.x), y: Math.round(at.y) };
      const b = p.box;
      // A click far from where the part was placed is on something else with its name (the
      // word "atlas" in a window's title): the first placement stands.
      const reach = Math.max(b.w, b.h, 40);
      const far =
        Math.max(b.x - point.x, point.x - (b.x + b.w), 0) > reach ||
        Math.max(b.y - point.y, point.y - (b.y + b.h), 0) > reach;
      if (far) return p;
      const inside =
        point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h;
      // The box keeps its size; when it missed the part, it's moved to centre on the click.
      const box = inside
        ? b
        : {
            x: Math.max(0, Math.round(point.x - b.w / 2)),
            y: Math.max(0, Math.round(point.y - b.h / 2)),
            w: b.w,
            h: b.h,
          };
      return { ...p, point, box };
    } catch {
      return p;
    }
  });
}

export async function refineParts<P extends PartBox>(
  client: MetaClient,
  model: string,
  screenshot: InputPart,
  size: { width: number; height: number },
  parts: P[],
  signal?: AbortSignal,
): Promise<P[]> {
  return Promise.all(locateParts(client, model, screenshot, size, parts, signal));
}
