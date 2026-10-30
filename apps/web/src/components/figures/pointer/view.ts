// Fig: Show me. A control console on a bench under a small XY gantry; the pointer head (Tandrix's
// pointer, with its blue ring light) travels to the control you're asking about. World units are
// about a millimetre; x right, y toward the viewer (the kit's camera looks down +y), z up.
import { fitProjection, iso, type Flat, type Plan, type Point3 } from "../../iso/iso-kit";

export const WIDTH = 640;
export const HEIGHT = 420;
export const AZIMUTH = 40;

/** The bench the console stands on. */
export const BASE: Plan = { x: -160, y: -96, w: 320, d: 196, r: 10 };
export const BASE_H = 9;
export const FOOT_H = 5;

/** The console: a raised panel with its controls. */
export const PANEL: Plan = { x: -118, y: -54, w: 220, d: 118, r: 8 };
export const PANEL_Z = 0;
export const PANEL_H = 12;
export const PANEL_TOP = PANEL_Z + PANEL_H;

/** The gantry: two posts at the back (negative y), a rail along x, an arm along y, a head on the arm. */
export const POST = 14;
export const POST_Y = -86;
export const POST_L = -140;
export const POST_R = 126;
export const RAIL_Z = 96;
export const RAIL_H = 10;
export const RAIL_D = 10;
export const ARM_Z = 84;
export const ARM_H = 7;
export const ARM_W = 12;
/** Where the arm meets the rail, and how far forward it reaches. */
export const ARM_BACK = POST_Y + POST + 4;
export const ARM_FRONT = 86;
export const HEAD_Z = 50;

export interface Target {
  id: string;
  name: string;
  says: string;
  /** Where the ring settles: centre and radius on the control's top. */
  at: Point3;
  r: number;
}

/** The controls Tandrix can point at, left to right, back to front. */
export const KNOBS: Array<{ x: number; y: number; r: number; h: number }> = [
  { x: -84, y: -24, r: 13, h: 12 },
  { x: -46, y: -24, r: 10, h: 10 },
];
export const SWITCHES = [-6, 12, 30, 48].map((x) => ({ x, y: -28 }));
export const KEYS = [-86, -62, -38, -14, 10].map((x) => ({ x, y: 36 }));
export const SLIDER = { x0: 34, x1: 88, y: 36, at: 70 };
export const SCREEN: Plan = { x: 62, y: -44, w: 32, d: 40, r: 3 };

export const TARGETS: Target[] = [
  {
    id: "dial",
    name: "Brightness dial",
    says: "Turn it right to brighten",
    at: [KNOBS[0]!.x, KNOBS[0]!.y, PANEL_TOP + KNOBS[0]!.h],
    r: 17,
  },
  {
    id: "power",
    name: "Power switch",
    says: "Flick it up to turn on",
    at: [SWITCHES[0]!.x, SWITCHES[0]!.y, PANEL_TOP + 4],
    r: 9,
  },
  {
    id: "export",
    name: "Export key",
    says: "Press it, then choose PDF",
    at: [KEYS[2]!.x, KEYS[2]!.y, PANEL_TOP + 5],
    r: 12,
  },
  {
    id: "zoom",
    name: "Zoom slider",
    says: "Slide right to zoom in",
    at: [SLIDER.at, SLIDER.y, PANEL_TOP + 6],
    r: 10,
  },
  {
    id: "screen",
    name: "Status screen",
    says: "All good: nothing to fix",
    at: [SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.d / 2, PANEL_TOP + 2],
    r: 22,
  },
];

/** Where the head rests, over the first control. */
export const REST: Point3 = TARGETS[0]!.at;

export const P = fitProjection(
  [
    [BASE.x, BASE.y, -BASE_H - FOOT_H],
    [BASE.x + BASE.w, BASE.y, -BASE_H - FOOT_H],
    [BASE.x, BASE.y + BASE.d, -BASE_H - FOOT_H],
    [BASE.x + BASE.w, BASE.y + BASE.d, -BASE_H - FOOT_H],
    [POST_L, POST_Y, RAIL_Z + RAIL_H],
    [POST_R + POST, POST_Y, RAIL_Z + RAIL_H],
    [POST_L, POST_Y + POST, RAIL_Z + RAIL_H],
    [0, ARM_FRONT, ARM_Z + ARM_H],
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: AZIMUTH },
);

export const at = (point: Point3): Flat => iso(point, P);
