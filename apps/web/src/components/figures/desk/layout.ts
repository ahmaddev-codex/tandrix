// The desk Tandrix works at through a day: a laptop, a router, a tray of kit parts, a manual, a phone
// and a mug. World units are about a millimetre; x right, y toward the viewer (the kit's camera
// looks down +y, so the back of the desk is negative y), z up. Shared by A day with Tandrix and the
// Ask cards, which frame one object at a time.
import type { Plan, Point3 } from "@/vendor/anatomy/iso-kit";

export const AZIMUTH = 40;

export const DESK: Plan = { x: -190, y: -112, w: 380, d: 224, r: 10 };
export const DESK_H = 10;
export const FOOT_H = 4;

/** The laptop: a deck in front, the lid standing at its back edge. */
export const LAPTOP = { x: -76, y: -76, w: 150, d: 96, h: 6, lid: 96, lidD: 3.2 };
/** The screen on the lid's front face: x from, x to, z from, z to, and the face's y. */
export const SCREEN = {
  x0: LAPTOP.x + 8,
  x1: LAPTOP.x + LAPTOP.w - 8,
  z0: LAPTOP.h + 8,
  z1: LAPTOP.h + LAPTOP.lid - 7,
  y: LAPTOP.y,
};

export const ROUTER = { x: 104, y: -100, w: 60, d: 36, h: 12, antenna: 40 };
export const TRAY: Plan = { x: 96, y: -10, w: 76, d: 60, r: 4 };
export const TRAY_H = 8;
export const MANUAL: Plan = { x: -176, y: -78, w: 66, d: 88, r: 2 };
export const MANUAL_H = 4;
export const PHONE: Plan = { x: 22, y: 34, w: 38, d: 70, r: 6 };
export const PHONE_H = 4;
export const MUG = { x: -140, y: 62, r: 15, h: 30 };

export type DeskObject = "laptop" | "router" | "tray" | "manual" | "phone" | "mug";

/** Corners of each object's box, for framing a figure on some of them. */
export const BOUNDS: Record<DeskObject, Point3[]> = {
  laptop: box(
    { x: LAPTOP.x, y: LAPTOP.y - LAPTOP.lidD, w: LAPTOP.w, d: LAPTOP.d + LAPTOP.lidD, r: 0 },
    0,
    LAPTOP.h + LAPTOP.lid,
  ),
  router: box(
    { x: ROUTER.x, y: ROUTER.y, w: ROUTER.w, d: ROUTER.d, r: 0 },
    0,
    ROUTER.h + ROUTER.antenna,
  ),
  tray: box(TRAY, 0, TRAY_H + 8),
  manual: box(MANUAL, 0, MANUAL_H),
  phone: box(PHONE, 0, PHONE_H),
  mug: box({ x: MUG.x - MUG.r, y: MUG.y - MUG.r, w: MUG.r * 2, d: MUG.r * 2, r: 0 }, 0, MUG.h),
};
export const DESK_BOUNDS = box(DESK, -DESK_H - FOOT_H, 0);

function box({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] {
  return [z0, z1].flatMap(
    (z) =>
      [
        [x, y, z],
        [x + w, y, z],
        [x, y + d, z],
        [x + w, y + d, z],
      ] as Point3[],
  );
}
