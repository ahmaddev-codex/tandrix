// The front window's controls in a Do it for me turn (SP5): placed on the screenshot, named to the
// model next to it, and used to land a click on the control it was aimed at.
import type { DesktopAction, ScreenGeometry } from "@tandrix/contracts";
import type { ScreenControl } from "../../shared/bridge";

/** A control in screenshot pixels, as the model sees the screen. */
export interface ShotControl {
  role: string;
  name: string;
  enabled: boolean;
  box: { x: number; y: number; w: number; h: number };
}

/** The controls on the screenshot's display, in its pixels; the rest are left out. */
export function onShot(controls: ScreenControl[], g: ScreenGeometry): ShotControl[] {
  const sx = g.imageWidth / g.displayWidth;
  const sy = g.imageHeight / g.displayHeight;
  const out: ShotControl[] = [];
  for (const c of controls) {
    const x = Math.round((c.x - g.originX) * sx);
    const y = Math.round((c.y - g.originY) * sy);
    const w = Math.round(c.w * sx);
    const h = Math.round(c.h * sy);
    // Wholly on this screenshot, and big enough to aim at.
    if (x < 0 || y < 0 || x + w > g.imageWidth || y + h > g.imageHeight || w < 3 || h < 3) continue;
    out.push({ role: c.role, name: c.name, enabled: c.enabled, box: { x, y, w, h } });
  }
  return out;
}

/** How far outside a control a click still counts as aimed at it, in screenshot pixels. */
const NEAR = 8;

const inside = (b: ShotControl["box"], x: number, y: number, pad = 0) =>
  x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad;

/**
 * A click that lands on nothing, a few pixels off one control, moved to that control's middle: the
 * commonest way a step does nothing. A click already on a control (any control, enabled or not) is
 * never moved, and neither is one near two controls or near a big area (a text area, a canvas).
 */
export function snapClicks(actions: DesktopAction[], controls: ShotControl[]): DesktopAction[] {
  return actions.map((a) => {
    if (a.type !== "click" && a.type !== "double_click") return a;
    if (controls.some((c) => inside(c.box, a.x, a.y))) return a;
    const near = controls.filter((c) => inside(c.box, a.x, a.y, NEAR));
    const target = near.length === 1 ? near[0]! : undefined;
    if (
      !target ||
      !target.enabled ||
      target.box.w * target.box.h > 120 * 60 ||
      /Text(Area|Field)|SearchField/.test(target.role)
    )
      return a;
    return {
      ...a,
      x: target.box.x + Math.floor(target.box.w / 2),
      y: target.box.y + Math.floor(target.box.h / 2),
    };
  });
}
