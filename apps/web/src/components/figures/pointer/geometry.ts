// Every static path of the pointing console, computed once. Moving parts (carriage, arm, head,
// ring) are built at the rest position and moved with translateAlong.
import {
  corners,
  cylinder,
  insetPlan,
  knurl,
  lineOnTop,
  onTop,
  planOutline,
  radialTicks,
  ring,
  slabOf,
  topTicks,
  type Plan,
  type Plane,
} from "@/vendor/anatomy/iso-kit";
import {
  ARM_BACK,
  ARM_FRONT,
  ARM_H,
  ARM_W,
  ARM_Z,
  at,
  BASE,
  BASE_H,
  FOOT_H,
  HEAD_Z,
  KEYS,
  KNOBS,
  P,
  PANEL,
  PANEL_H,
  PANEL_TOP,
  PANEL_Z,
  POST,
  POST_L,
  POST_R,
  POST_Y,
  RAIL_D,
  RAIL_H,
  RAIL_Z,
  REST,
  SCREEN,
  SLIDER,
  SWITCHES,
  type Target,
} from "./view";

const slab = (plan: Plan, z: number, h: number, steps = 6, bevel = 0) =>
  slabOf(plan, z, h, P, steps, bevel);
const cyl = (x: number, y: number, r: number, z: number, h: number, steps = 32) =>
  cylinder(x, y, r, z, h, P, steps);
const join = (paths: string[]) => paths.filter(Boolean).join("");

/* The bench */
const FEET: Plane[] = corners(BASE, 20);
const BASE_SCREWS: Plane[] = corners(BASE, 8);
const LABEL: Plan = { x: BASE.x + 22, y: BASE.y + BASE.d - 24, w: 70, d: 14, r: 2 };

export const BASE_ART = {
  halo: slab(BASE, -BASE_H - FOOT_H, BASE_H).fill,
  feet: FEET.map(([x, y]) => [
    cyl(x, y, 8, -BASE_H - FOOT_H, 1.6),
    cyl(x, y, 6, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6),
  ]),
  slab: slab(BASE, -BASE_H, BASE_H, 8, 1.6),
  groove: planOutline(insetPlan(BASE, 5), 0, P),
  screws: BASE_SCREWS.map(([x, y]) => at([x, y, 0])),
  screwRings: join(BASE_SCREWS.map(([x, y]) => ring(x, y, 2.4, 0, P, 16))),
  label: slab(LABEL, 0, 0.8, 4),
  labelLine: planOutline(insetPlan(LABEL, 1.6), 0.8, P),
  labelScrews: [
    at([LABEL.x + 3.6, LABEL.y + LABEL.d / 2, 0.8]),
    at([LABEL.x + LABEL.w - 3.6, LABEL.y + LABEL.d / 2, 0.8]),
  ],
  labelRule: join(
    [0, 1, 2].map((row) =>
      lineOnTop(
        [LABEL.x + 9, LABEL.y + 3.6 + row * 3.2],
        [LABEL.x + (row === 1 ? 40 : 56), LABEL.y + 3.6 + row * 3.2],
        0.8,
        P,
      ),
    ),
  ),
  /** A ruler along the front edge: the console's x travel, every 5 mm. */
  ruler: topTicks(BASE.x + 100, BASE.x + BASE.w - 20, 5, 5, BASE.y + BASE.d - 8, 0, [1.6, 3.2], P),
};

/* The console panel */
const PANEL_SCREWS = corners(PANEL, 6);
export const PANEL_ART = {
  body: slab(PANEL, PANEL_Z, PANEL_H, 8, 1.2),
  bezel: planOutline(insetPlan(PANEL, 5), PANEL_TOP, P),
  screws: PANEL_SCREWS.map(([x, y]) => at([x, y, PANEL_TOP])),
  /** Engraved dividers between the control groups. */
  dividers: join([lineOnTop([PANEL.x + 8, 0], [PANEL.x + PANEL.w - 8, 0], PANEL_TOP, P)]),
};

/* Controls */
export const KNOB_ART = KNOBS.map((k) => ({
  collar: cyl(k.x, k.y, k.r + 3, PANEL_TOP, 1.4),
  body: cyl(k.x, k.y, k.r, PANEL_TOP + 1.4, k.h - 1.4),
  cap: ring(k.x, k.y, k.r * 0.55, PANEL_TOP + k.h, P, 28),
  knurl: knurl(k.x, k.y, k.r, PANEL_TOP + 1.4, PANEL_TOP + k.h, 30, P),
  ticks: radialTicks(
    k.x,
    k.y,
    k.r + 7,
    20,
    5,
    PANEL_TOP,
    [1.4, 2.8],
    P,
    -Math.PI * 0.75,
    Math.PI * 1.5,
  ),
  mark: lineOnTop([k.x, k.y + k.r * 0.2], [k.x, k.y + k.r * 0.85], PANEL_TOP + k.h, P),
}));

export const SWITCH_ART = SWITCHES.map((s, i) => ({
  plate: slab({ x: s.x - 6, y: s.y - 9, w: 12, d: 18, r: 2 }, PANEL_TOP, 1.2, 4),
  slot: planOutline({ x: s.x - 2, y: s.y - 6, w: 4, d: 12, r: 2 }, PANEL_TOP + 1.2, P),
  // Up for the first two, down for the rest: a real panel in use.
  lever: slab(
    { x: s.x - 2.2, y: s.y + (i < 2 ? -6 : 0), w: 4.4, d: 6, r: 2 },
    PANEL_TOP + 1.2,
    4,
    4,
  ),
  led: at([s.x, s.y - 13, PANEL_TOP]),
  on: i < 2,
}));

export const KEY_ART = KEYS.map((k) => ({
  well: planOutline({ x: k.x - 10, y: k.y - 9, w: 20, d: 18, r: 3 }, PANEL_TOP, P),
  cap: slab({ x: k.x - 8.5, y: k.y - 7.5, w: 17, d: 15, r: 3 }, PANEL_TOP, 4, 6, 0.8),
  dish: planOutline({ x: k.x - 5, y: k.y - 4, w: 10, d: 8, r: 3 }, PANEL_TOP + 4, P),
}));

export const SLIDER_ART = {
  track: slab(
    { x: SLIDER.x0, y: SLIDER.y - 2.5, w: SLIDER.x1 - SLIDER.x0, d: 5, r: 2.5 },
    PANEL_TOP,
    0.6,
    6,
  ),
  groove: lineOnTop([SLIDER.x0 + 3, SLIDER.y], [SLIDER.x1 - 3, SLIDER.y], PANEL_TOP + 0.6, P),
  ticks: topTicks(SLIDER.x0 + 2, SLIDER.x1 - 2, 4, 4, SLIDER.y - 9, PANEL_TOP, [1.6, 3], P),
  thumb: slab({ x: SLIDER.at - 5, y: SLIDER.y - 8, w: 10, d: 16, r: 2 }, PANEL_TOP, 6, 4, 0.8),
  grip: join(
    [-2, 0, 2].map((dx) =>
      lineOnTop([SLIDER.at + dx, SLIDER.y - 5], [SLIDER.at + dx, SLIDER.y + 5], PANEL_TOP + 6, P),
    ),
  ),
};

export const SCREEN_ART = {
  frame: slab(SCREEN, PANEL_TOP, 2, 6, 0.6),
  glass: slab(insetPlan(SCREEN, 3), PANEL_TOP + 2, 0.4, 4),
  /** Status bars on the screen, a little graph of readings. */
  bars: join(
    [0, 1, 2, 3, 4].map((i) =>
      lineOnTop(
        [SCREEN.x + 8 + i * 4, SCREEN.y + SCREEN.d - 8],
        [SCREEN.x + 8 + i * 4, SCREEN.y + SCREEN.d - 8 - [10, 16, 12, 20, 18][i]!],
        PANEL_TOP + 2.4,
        P,
      ),
    ),
  ),
};

/* The gantry */
const POSTS: Plan[] = [POST_L, POST_R].map((x) => ({ x, y: POST_Y, w: POST, d: POST, r: 2 }));
export const GANTRY_ART = {
  posts: POSTS.map((plan) => ({
    foot: slab(insetPlan(plan, -3), 0, 2, 4, 0.6),
    body: slab(plan, 2, RAIL_Z - 2, 4, 0.8),
    screws: corners(insetPlan(plan, -3), 1.6).map(([x, y]) => at([x, y, 2])),
  })),
  rail: slab(
    {
      x: POST_L - 4,
      y: POST_Y + POST / 2 - RAIL_D / 2,
      w: POST_R + POST - POST_L + 8,
      d: RAIL_D,
      r: 2,
    },
    RAIL_Z,
    RAIL_H,
    6,
    1,
  ),
  railGroove: lineOnTop(
    [POST_L + POST + 4, POST_Y + POST / 2],
    [POST_R - 4, POST_Y + POST / 2],
    RAIL_Z + RAIL_H,
    P,
  ),
  railTicks: topTicks(
    POST_L + POST + 6,
    POST_R - 6,
    5,
    5,
    POST_Y + POST / 2 - RAIL_D / 2 + 0.6,
    RAIL_Z + RAIL_H,
    [1.4, 2.8],
    P,
  ),
};

/* Moving parts, at rest over the first control. */
const [RX, RY] = REST;
export const CARRIAGE_ART = {
  block: slab(
    { x: RX - 14, y: POST_Y + POST / 2 - 9, w: 28, d: 18, r: 3 },
    RAIL_Z + RAIL_H,
    8,
    6,
    1,
  ),
  screws: corners({ x: RX - 14, y: POST_Y + POST / 2 - 9, w: 28, d: 18, r: 3 }, 3.5).map(([x, y]) =>
    at([x, y, RAIL_Z + RAIL_H + 8]),
  ),
  hanger: slab(
    { x: RX - 5, y: ARM_BACK - 4, w: 10, d: 8, r: 2 },
    ARM_Z + ARM_H,
    RAIL_Z - ARM_Z - ARM_H + RAIL_H,
    4,
  ),
};
export const ARM_ART = {
  arm: slab(
    { x: RX - ARM_W / 2, y: ARM_BACK, w: ARM_W, d: ARM_FRONT - ARM_BACK, r: 2 },
    ARM_Z,
    ARM_H,
    6,
    0.8,
  ),
  groove: lineOnTop([RX + 2.5, ARM_BACK + 8], [RX + 2.5, ARM_FRONT - 6], ARM_Z + ARM_H, P),
  ticks: topTicks(
    ARM_BACK + 10,
    ARM_FRONT - 8,
    5,
    5,
    RX - ARM_W / 2 + 0.6,
    ARM_Z + ARM_H,
    [1.2, 2.4],
    P,
    "y",
  ),
  endCap: slab(
    { x: RX - ARM_W / 2 - 1, y: ARM_FRONT - 1, w: ARM_W + 2, d: 4, r: 1.5 },
    ARM_Z - 1,
    ARM_H + 2,
    4,
  ),
};
/** The head rides the arm along y; the stylus hangs to just above the control. */
export function headArt(z: number) {
  return {
    sled: slab({ x: RX - 10, y: RY - 8, w: 20, d: 16, r: 3 }, ARM_Z + ARM_H, 6, 6, 0.8),
    sledScrews: corners({ x: RX - 10, y: RY - 8, w: 20, d: 16, r: 3 }, 3).map(([x, y]) =>
      at([x, y, ARM_Z + ARM_H + 6]),
    ),
    housing: cylinder(RX, RY, 6, HEAD_Z, ARM_Z - HEAD_Z, P, 28),
    collar: cylinder(RX, RY, 7.5, HEAD_Z + 4, 2.4, P, 28),
    knurl: knurl(RX, RY, 6, HEAD_Z + 8, ARM_Z - 3, 22, P),
    // The stylus runs up inside the housing, so it can drop to a lower control and still be one rod.
    stylus: cylinder(RX, RY, 1.8, z + 6, HEAD_Z + 14 - z - 6, P, 16),
    tip: cylinder(RX, RY, 3.2, z + 2.5, 3.5, P, 20),
    lamp: ring(RX, RY, 6, HEAD_Z, P, 28),
  };
}
/** The ring of light Tandrix puts on a control, drawn where the control is. */
export function ringFor(t: Target) {
  const points = Array.from(
    { length: 48 },
    (_, i) =>
      [
        t.at[0] + t.r * Math.cos((i / 48) * Math.PI * 2),
        t.at[1] + t.r * Math.sin((i / 48) * Math.PI * 2),
      ] as Plane,
  );
  return onTop(points, t.at[2], P, true);
}
