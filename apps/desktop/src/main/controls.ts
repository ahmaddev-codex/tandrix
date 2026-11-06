// The front window's controls for Do it for me (SP5): read by the input helper from the app's
// accessibility tree (native/input/main.swift "tree"), names and frames only. Password fields and
// password managers are never read there; here every entry is checked and trimmed again before it
// goes anywhere.
import type { ScreenControl } from "../shared/bridge";
import { frontApp } from "./apps";
import { drive } from "./input-driver";

const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** The helper's controls, kept only when every field is what it should be. */
export function cleanControls(raw: unknown): ScreenControl[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreenControl[] = [];
  for (const c of raw.slice(0, 150)) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    const [x, y, w, h] = [int(r.x), int(r.y), int(r.w), int(r.h)];
    if (x === null || y === null || w === null || h === null || w < 4 || h < 4) continue;
    if (typeof r.role !== "string" || !/^[A-Za-z]{2,40}$/.test(r.role)) continue;
    if (/secure/i.test(r.role)) continue;
    const name =
      typeof r.name === "string"
        ? r.name.replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, 80)
        : "";
    out.push({ role: r.role, name, enabled: r.enabled !== false, x, y, w, h });
  }
  return out;
}

/** What's in the front window now, in global display points; empty when it can't be read. */
export async function frontControls(): Promise<ScreenControl[]> {
  // Tandrix itself in front (its panel): nothing to read.
  if (!(await frontApp())) return [];
  const r = await drive({ op: "tree" }).catch(() => null);
  return r?.ok ? cleanControls(r.controls) : [];
}
