// Build it: a small single-board computer kit, from the case up. World units are about a
// millimetre; x right, y toward the viewer, z up. Each part rests on the one below; exploded, it
// waits above its landing place.
import { fitProjection, type Plan, type Point3 } from "../../iso/iso-kit";

export const WIDTH = 640;
export const HEIGHT = 560;

export const CASE: Plan = { x: -64, y: -46, w: 128, d: 92, r: 8 };
export const CASE_H = 6;
export const POST_H = 6;
export const BOARD: Plan = { x: -54, y: -36, w: 104, d: 70, r: 3 };
export const BOARD_Z = CASE_H + POST_H;
export const BOARD_H = 1.6;
export const BOARD_TOP = BOARD_Z + BOARD_H;
/** The two chips the pads and cooler sit on. */
export const SOC: Plan = { x: -30, y: -16, w: 18, d: 18, r: 1.2 };
export const RAM: Plan = { x: -6, y: -14, w: 16, d: 12, r: 1 };
export const CHIP_H = 1.6;
export const PAD_H = 1;
export const COOLER: Plan = { x: -36, y: -24, w: 52, d: 34, r: 2 };
export const COOLER_Z = BOARD_TOP + CHIP_H + PAD_H;
export const COOLER_BASE = 3;
export const FIN_H = 9;
export const FAN = { x: 2, y: -7, r: 12 };
export const COVER_Z = CASE_H;
export const COVER_H = 28;
export const HOLES: Array<[number, number]> = [
  [BOARD.x + 4, BOARD.y + 4],
  [BOARD.x + BOARD.w - 4, BOARD.y + 4],
  [BOARD.x + 4, BOARD.y + BOARD.d - 4],
  [BOARD.x + BOARD.w - 4, BOARD.y + BOARD.d - 4],
];

/** Bottom to top, with how far each waits above its place when the kit is apart. */
export const PARTS = [
  { name: "Case base", apart: 0 },
  { name: "Main board", apart: 60 },
  { name: "Thermal pads", apart: 115 },
  { name: "Active cooler", apart: 180 },
  { name: "Top cover", apart: 270 },
] as const;

const TOP = COVER_Z + COVER_H + PARTS[4].apart;
export const P = fitProjection(
  [
    [CASE.x, CASE.y, -3],
    [CASE.x + CASE.w, CASE.y, -3],
    [CASE.x, CASE.y + CASE.d, -3],
    [CASE.x + CASE.w, CASE.y + CASE.d, -3],
    [CASE.x, CASE.y, TOP],
    [CASE.x + CASE.w, CASE.y + CASE.d, TOP],
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 40 },
);
