// The kit's parts as server-built SVG, bottom to top. Each part comes with its ghost: the blue
// outline of where it lands, shown while Tandrix is guiding that step.
import * as React from "react";
import {
  corners,
  cylinder,
  dotGrid,
  insetPlan,
  iso,
  lineOnTop,
  onTop,
  pathOf,
  planOutline,
  ring,
  slabOf,
  translateAlong,
  type Plan,
  type Plane,
} from "@/vendor/anatomy/iso-kit";
import { Dots, Line, Solid } from "@/vendor/anatomy/react/draw";
import {
  BOARD,
  BOARD_H,
  BOARD_TOP,
  BOARD_Z,
  CASE,
  CASE_H,
  CHIP_H,
  COOLER,
  COOLER_BASE,
  COOLER_Z,
  COVER_H,
  COVER_Z,
  FAN,
  FIN_H,
  HOLES,
  P,
  PAD_H,
  POST_H,
  RAM,
  SOC,
} from "./view";

const slab = (plan: Plan, z: number, h: number, steps = 6, bevel = 0) =>
  slabOf(plan, z, h, P, steps, bevel);
const at = (x: number, y: number, z: number) => iso([x, y, z], P);
const joined = (paths: string[]) => paths.join("");

/** Ports on the board's right edge: two USB, one Ethernet. */
const PORTS: Array<{ plan: Plan; h: number }> = [
  { plan: { x: BOARD.x + BOARD.w - 14, y: -30, w: 18, d: 14, r: 1 }, h: 15 },
  { plan: { x: BOARD.x + BOARD.w - 14, y: -12, w: 18, d: 14, r: 1 }, h: 15 },
  { plan: { x: BOARD.x + BOARD.w - 16, y: 7, w: 20, d: 18, r: 1 }, h: 13 },
];

const CASE_ART = (
  <g>
    <path className="iso-halo" d={slab(CASE, -3, CASE_H + 3).fill} />
    {corners(CASE, 14).map(([x, y], i) => (
      <Solid key={i} paths={cylinder(x, y, 6, -3, 3, P, 18)} tone="lo" />
    ))}
    <Solid paths={slab(CASE, 0, CASE_H, 8, 1.2)} tone="mid" />
    <Line d={planOutline(insetPlan(CASE, 4), CASE_H, P)} tone="faint" />
    <Line d={joined(corners(CASE, 7).map(([x, y]) => ring(x, y, 2, CASE_H, P, 14)))} tone="faint" />
    <Dots points={corners(CASE, 7).map(([x, y]) => at(x, y, CASE_H))} size={0.6} tone="mid" />
    {/* Vent slots in the floor, under where the cooler will sit. */}
    <Line
      d={joined(
        Array.from({ length: 9 }, (_, i) =>
          lineOnTop(
            [COOLER.x + 6 + i * 5, COOLER.y + 6],
            [COOLER.x + 6 + i * 5, COOLER.y + COOLER.d - 6],
            CASE_H,
            P,
          ),
        ),
      )}
      tone="lo"
    />
    {HOLES.map(([x, y], i) => (
      <g key={i}>
        <Solid paths={cylinder(x, y, 3.2, CASE_H, POST_H, P, 18)} tone="hi" />
        <Line d={ring(x, y, 1.3, CASE_H + POST_H, P, 12)} tone="lo" />
      </g>
    ))}
  </g>
);

const BOARD_ART = (
  <g>
    <Solid paths={slab(BOARD, BOARD_Z, BOARD_H, 4, 0.4)} tone="mid" />
    <Line d={joined(HOLES.map(([x, y]) => ring(x, y, 2.6, BOARD_TOP, P, 14)))} tone="lo" />
    {/* Copper traces from the processor out to the memory and the header. */}
    <Line
      d={joined(
        [0, 1, 2, 3].map((i) =>
          onTop(
            [
              [SOC.x + SOC.w, SOC.y + 4 + i * 3],
              [SOC.x + SOC.w + 4, SOC.y + 4 + i * 3],
              [RAM.x, RAM.y + 2 + i * 2.6],
            ] as Plane[],
            BOARD_TOP,
            P,
          ),
        ),
      )}
      tone="faint"
    />
    <Line
      d={joined(
        [0, 1, 2].map((i) =>
          lineOnTop([SOC.x + 4 + i * 4, SOC.y], [SOC.x + 4 + i * 4, BOARD.y + 9], BOARD_TOP, P),
        ),
      )}
      tone="faint"
    />
    <Dots points={dotGrid(-2, 10, 6, 3, 4, BOARD_TOP, P)} size={0.5} tone="mid" />
    <Line d={planOutline({ x: -46, y: 20, w: 26, d: 8, r: 1 }, BOARD_TOP, P)} tone="faint" />
    {/* The 40-pin header along the back edge. */}
    <Solid
      paths={slab({ x: -42, y: BOARD.y + 2, w: 80, d: 5.4, r: 0.6 }, BOARD_TOP, 2.6, 4)}
      tone="lo"
    />
    <Dots
      points={dotGrid(-40.7, BOARD.y + 3.4, 20, 2, 4, BOARD_TOP + 2.6, P)}
      size={0.55}
      tone="hi"
    />
    <Solid paths={slab(SOC, BOARD_TOP, CHIP_H, 4, 0.3)} tone="hi" />
    <Solid paths={slab(RAM, BOARD_TOP, CHIP_H, 4, 0.3)} tone="hi" />
    <Dots points={[at(SOC.x + 2.4, SOC.y + 2.4, BOARD_TOP + CHIP_H)]} size={0.6} tone="mid" />
    {PORTS.map((p, i) => (
      <g key={i}>
        <Solid paths={slab(p.plan, BOARD_TOP, p.h, 4, 0.4)} tone="hi" />
        <Line d={planOutline(insetPlan(p.plan, 2), BOARD_TOP + p.h, P)} tone="faint" />
      </g>
    ))}
  </g>
);

const PADS_ART = (
  <g>
    <Solid paths={slab(insetPlan(SOC, 1), BOARD_TOP + CHIP_H, PAD_H, 4)} tone="hi" lit />
    <Solid paths={slab(insetPlan(RAM, 1), BOARD_TOP + CHIP_H, PAD_H, 4)} tone="hi" lit />
  </g>
);

/** The cooler's push pins: one at each of two opposite corners. */
export const PINS: Array<[number, number]> = [
  [COOLER.x + 3.5, COOLER.y + 3.5],
  [COOLER.x + COOLER.w - 3.5, COOLER.y + COOLER.d - 3.5],
];
const FIN_TOP = COOLER_Z + COOLER_BASE;
const COOLER_ART = (
  <g>
    {PINS.map(([x, y], i) => (
      <Solid
        key={i}
        paths={cylinder(x, y, 1.2, BOARD_TOP, COOLER_Z - BOARD_TOP, P, 10)}
        tone="hi"
      />
    ))}
    <Solid paths={slab(COOLER, COOLER_Z, COOLER_BASE, 6, 0.6)} tone="mid" />
    {/* Fins, back to front. */}
    {Array.from({ length: 8 }, (_, i) => (
      <Solid
        key={i}
        paths={slab(
          { x: COOLER.x + 4, y: COOLER.y + 3 + i * 4, w: 24, d: 1.4, r: 0.4 },
          FIN_TOP,
          FIN_H,
          2,
        )}
        tone="mid"
      />
    ))}
    {PINS.map(([x, y], i) => (
      <Solid key={i} paths={cylinder(x, y, 2.4, FIN_TOP, 1.6, P, 14)} tone="hi" />
    ))}
    <Solid paths={cylinder(FAN.x + 2, FAN.y, FAN.r, FIN_TOP, 8, P, 36, 0.5)} tone="mid" />
    <Line d={ring(FAN.x + 2, FAN.y, FAN.r - 2, FIN_TOP + 8, P, 36)} tone="faint" />
    {/* Seven blades, swept. */}
    <Line
      d={joined(
        Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return onTop(
            [
              [FAN.x + 2 + 4 * Math.cos(a), FAN.y + 4 * Math.sin(a)],
              [FAN.x + 2 + 9.6 * Math.cos(a + 0.5), FAN.y + 9.6 * Math.sin(a + 0.5)],
            ] as Plane[],
            FIN_TOP + 8,
            P,
          );
        }),
      )}
      tone="lo"
    />
    <Solid paths={cylinder(FAN.x + 2, FAN.y, 3.6, FIN_TOP + 8, 1, P, 20)} tone="hi" />
  </g>
);

/** Tandrix's pointer, inlaid in the lid. */
const LOGO = [
  [0, 0],
  [0, 13],
  [3.2, 9.8],
  [5.6, 14.8],
  [7.6, 13.9],
  [5.3, 9],
  [9.4, 9],
].map(([x, y]) => [CASE.x + 16 + x!, CASE.y + CASE.d - 30 + y!] as Plane);
const COVER_TOP = COVER_Z + COVER_H;
const COVER_ART = (
  <g>
    <Solid paths={slab(CASE, COVER_Z, COVER_H, 8, 1.2)} tone="mid" />
    <Line d={planOutline(insetPlan(CASE, 4), COVER_TOP, P)} tone="faint" />
    {/* The grille over the fan, and vents along the back. */}
    <Line
      d={joined([4, 8, 12].map((r) => ring(FAN.x + 2, FAN.y, r, COVER_TOP, P, 36)))}
      tone="lo"
    />
    <Line
      d={joined(
        Array.from({ length: 12 }, (_, i) =>
          lineOnTop(
            [CASE.x + 30 + i * 6, CASE.y + 8],
            [CASE.x + 30 + i * 6, CASE.y + 18],
            COVER_TOP,
            P,
          ),
        ),
      )}
      tone="lo"
    />
    <path className="fill-(--anatomy-hi)" d={onTop(LOGO, COVER_TOP, P, true)} />
    {/* Openings for the ports, on the right-hand face. */}
    <Line
      d={joined(
        PORTS.map((p) =>
          pathOf(
            [
              at(CASE.x + CASE.w, p.plan.y, BOARD_TOP),
              at(CASE.x + CASE.w, p.plan.y + p.plan.d, BOARD_TOP),
              at(CASE.x + CASE.w, p.plan.y + p.plan.d, BOARD_TOP + p.h - 2),
              at(CASE.x + CASE.w, p.plan.y, BOARD_TOP + p.h - 2),
            ],
            true,
          ),
        ),
      )}
      tone="lo"
    />
  </g>
);

/** Where each part lands, drawn on the part below. */
const ghost = (d: string) => (
  <g>
    <path className="iso-line stroke-[6px] opacity-[0.18]" data-tone="blue" d={d} />
    <path className="iso-line stroke-[1.6px]" data-tone="blue" d={d} />
  </g>
);

export const KIT_LAYERS: React.ReactNode[] = [CASE_ART, BOARD_ART, PADS_ART, COOLER_ART, COVER_ART];
export const KIT_GHOSTS: React.ReactNode[] = [
  null,
  ghost(planOutline(BOARD, BOARD_Z, P)),
  ghost(
    planOutline(insetPlan(SOC, 1), BOARD_TOP + CHIP_H, P) +
      planOutline(insetPlan(RAM, 1), BOARD_TOP + CHIP_H, P),
  ),
  ghost(planOutline(COOLER, COOLER_Z, P)),
  ghost(planOutline(CASE, COVER_Z, P)),
];

/**
 * A still for "Is this part seated right?": the cooler sits high on its left pin, which is ringed.
 * The lift is how far the left side stands proud.
 */
export function SeatedStill() {
  const [px, py] = PINS[0]!;
  return (
    <>
      {CASE_ART}
      {BOARD_ART}
      {PADS_ART}
      <g transform={translateAlong(P, [0, 0, 7])}>{COOLER_ART}</g>
      {ghost(ring(px, py, 6, BOARD_TOP, P, 32))}
    </>
  );
}
