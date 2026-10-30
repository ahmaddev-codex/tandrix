// The desk, drawn for one moment: which object Tandrix is looking at (lit), what's on the laptop
// and phone screens, and the blue ring on the exact control. Server-only: plain SVG, no script.
import * as React from "react";
import {
  corners,
  cylinder,
  depthOf,
  insetPlan,
  iso,
  lineOnTop,
  pathOf,
  planOutline,
  ring,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
} from "@/vendor/anatomy/iso-kit";
import { Dots, Line, Solid } from "@/vendor/anatomy/react/draw";
import {
  DESK,
  DESK_H,
  FOOT_H,
  LAPTOP,
  MANUAL,
  MANUAL_H,
  MUG,
  PHONE,
  PHONE_H,
  ROUTER,
  SCREEN,
  TRAY,
  TRAY_H,
  type DeskObject,
} from "./layout";

/** What the moment is about: decides the lit object, the screens and the ring. */
export type Focus = "sheet" | "wifi" | "kit" | "calendar" | "none";

const LIT: Record<Focus, DeskObject[]> = {
  sheet: ["laptop"],
  wifi: ["laptop", "router"],
  kit: ["tray", "phone"],
  calendar: ["laptop"],
  none: [],
};

export function DeskArt({ P, focus, only }: { P: Projection; focus: Focus; only?: DeskObject[] }) {
  const show = (o: DeskObject) => !only || only.includes(o);
  const lit = (o: DeskObject) => LIT[focus][0] === o;
  const at = (p: Point3) => iso(p, P);
  const parts: Array<{ depth: number; node: React.ReactNode }> = [];
  const add = (o: DeskObject, center: Point3, node: React.ReactNode) => {
    if (show(o)) parts.push({ depth: depthOf(center, P), node: <g key={o}>{node}</g> });
  };

  add(
    "laptop",
    [LAPTOP.x + LAPTOP.w / 2, LAPTOP.y + 10, 0],
    <Laptop P={P} focus={focus} lit={lit("laptop")} />,
  );
  add(
    "router",
    [ROUTER.x + ROUTER.w / 2, ROUTER.y + ROUTER.d / 2, 0],
    <Router P={P} on={focus === "wifi"} at={at} />,
  );
  add(
    "tray",
    [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, 0],
    <Tray P={P} on={focus === "kit"} lit={lit("tray")} at={at} />,
  );
  add(
    "manual",
    [MANUAL.x + MANUAL.w / 2, MANUAL.y + MANUAL.d / 2, 0],
    <Manual P={P} on={focus === "kit"} />,
  );
  add("phone", [PHONE.x + PHONE.w / 2, PHONE.y + PHONE.d / 2, 0], <Phone P={P} focus={focus} />);
  add("mug", [MUG.x, MUG.y, 0], <Mug P={P} />);
  parts.sort((a, b) => a.depth - b.depth);

  return (
    <>
      {only ? null : <Desk P={P} at={at} />}
      {parts.map((p) => p.node)}
    </>
  );
}

/* The desk top, on four feet, with a groove and screws: the ground the day happens on. */
function Desk({ P, at }: { P: Projection; at: (p: Point3) => Flat }) {
  const feet = corners(DESK, 24);
  return (
    <g>
      <path className="iso-halo" d={slabOf(DESK, -DESK_H - FOOT_H, DESK_H, P).fill} />
      {feet.map(([x, y], i) => (
        <Solid key={i} paths={cylinder(x, y, 7, -DESK_H - FOOT_H, FOOT_H, P, 20)} tone="lo" />
      ))}
      <Solid paths={slabOf(DESK, -DESK_H, DESK_H, P, 8, 1.6)} tone="lo" />
      <Line d={planOutline(insetPlan(DESK, 6), 0, P)} tone="faint" />
      <Dots points={corners(DESK, 10).map(([x, y]) => at([x, y, 0]))} size={0.9} tone="mid" />
    </g>
  );
}

/* A rectangle in the plane of an upright face that looks toward +y. */
const faceRect = (P: Projection, x0: number, x1: number, z0: number, z1: number, y: number) =>
  pathOf(
    [iso([x0, y, z0], P), iso([x1, y, z0], P), iso([x1, y, z1], P), iso([x0, y, z1], P)],
    true,
  );
const faceLine = (P: Projection, a: [number, number], b: [number, number], y: number) =>
  pathOf([iso([a[0], y, a[1]], P), iso([b[0], y, b[1]], P)]);

/** Tandrix's pointer, drawn flat on the screen with its tip at (x, z). */
function cursorOnFace(P: Projection, x: number, z: number, y: number) {
  const shape: Array<[number, number]> = [
    [0, 0],
    [0, -13],
    [3.2, -9.8],
    [5.6, -14.8],
    [7.6, -13.9],
    [5.3, -9],
    [9.4, -9],
  ];
  return pathOf(
    shape.map(([dx, dz]) => iso([x + dx, y, z + dz], P)),
    true,
  );
}

function Ringed({ d }: { d: string }) {
  return (
    <g className="desk-ring">
      <path className="iso-line desk-glow" data-tone="blue" d={d} />
      <path className="iso-line" data-tone="blue" d={d} />
    </g>
  );
}

function Laptop({ P, focus, lit }: { P: Projection; focus: Focus; lit: boolean }) {
  const { x, y, w, d, h, lid, lidD } = LAPTOP;
  const deck: Plan = { x, y, w, d, r: 5 };
  const keys: string[] = [];
  const cols = 13;
  const kw = (w - 24) / cols;
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < cols; col++) {
      // The space bar takes the middle five keys of the bottom row.
      if (row === 4 && col > 4 && col < 9) {
        if (col === 5)
          keys.push(
            planOutline(
              {
                x: x + 12 + col * kw + 0.8,
                y: y + 10 + row * 8.4,
                w: kw * 4 - 1.6,
                d: 6.8,
                r: 1.2,
              },
              h,
              P,
              3,
            ),
          );
        continue;
      }
      keys.push(
        planOutline(
          { x: x + 12 + col * kw + 0.8, y: y + 10 + row * 8.4, w: kw - 1.6, d: 6.8, r: 1.2 },
          h,
          P,
          3,
        ),
      );
    }
  const fy = y + 0.01;
  const { x0, x1, z0, z1 } = SCREEN;
  return (
    <g>
      <Solid paths={slabOf(deck, 0, h, P, 6, 0.8)} tone="mid" lit={lit} />
      <Line d={keys.join("")} tone="faint" />
      <Line
        d={planOutline({ x: x + w / 2 - 28, y: y + 58, w: 56, d: 32, r: 3 }, h, P)}
        tone="faint"
      />
      <Line
        d={lineOnTop([x + w / 2 - 14, y + d - 3], [x + w / 2 + 14, y + d - 3], h, P)}
        tone="lo"
      />
      {/* The lid stands on the back edge. */}
      <Solid
        paths={slabOf({ x: x + 1, y: y - lidD, w: w - 2, d: lidD, r: 1.2 }, h, lid, P, 4, 0.4)}
        tone="mid"
        lit={lit}
      />
      <path className="desk-glass" d={faceRect(P, x0, x1, z0, z1, fy)} />
      <Line d={faceRect(P, x0, x1, z0, z1, fy)} tone="lo" />
      <Dots points={[iso([x + w / 2, fy, z1 + 3.5], P)]} size={0.8} tone="mid" />
      <ScreenContent P={P} focus={focus} y={fy} />
    </g>
  );
}

function ScreenContent({ P, focus, y }: { P: Projection; focus: Focus; y: number }) {
  const { x0, x1, z0, z1 } = SCREEN;
  const lines: string[] = [];
  const blue: string[] = [];
  let ringD = "";
  let tip: [number, number] | null = null;
  // A menu bar across the top of every screen.
  lines.push(faceLine(P, [x0, z1 - 6], [x1, z1 - 6], y));
  if (focus === "wifi") {
    // Settings: a sidebar and a list of networks; the ring on yours.
    const side = x0 + 38;
    lines.push(faceLine(P, [side, z0], [side, z1 - 6], y));
    for (let i = 0; i < 6; i++)
      lines.push(
        faceLine(P, [x0 + 6, z1 - 14 - i * 9], [side - 8 - (i % 3) * 5, z1 - 14 - i * 9], y),
      );
    for (let i = 0; i < 5; i++) {
      const top = z1 - 12 - i * 13;
      lines.push(faceRect(P, side + 8, x1 - 8, top - 10, top, y));
      lines.push(faceLine(P, [side + 22, top - 5], [side + 60 - i * 4, top - 5], y));
      // A Wi‑Fi mark at the start of each row.
      blue.push(
        ...[2, 3.4].map((r) =>
          pathOf([
            iso([side + 13 - r, y, top - 7 + r * 0.6], P),
            iso([side + 13, y, top - 7 + r * 1.3], P),
            iso([side + 13 + r, y, top - 7 + r * 0.6], P),
          ]),
        ),
      );
    }
    ringD = faceRect(P, side + 5.5, x1 - 5.5, z1 - 12 - 13 - 12.5, z1 - 12 - 13 + 2.5, y);
    tip = [x1 - 30, z1 - 34];
  } else if (focus === "calendar") {
    // Calendar: a week grid, Thursday at ten ringed.
    const top = z1 - 14;
    lines.push(faceLine(P, [x0 + 6, top + 3], [x0 + 46, top + 3], y));
    const cw = (x1 - x0 - 12) / 7;
    const rh = (top - z0 - 6) / 5;
    for (let c = 0; c <= 7; c++)
      lines.push(faceLine(P, [x0 + 6 + c * cw, top - 2], [x0 + 6 + c * cw, z0 + 4], y));
    for (let r = 0; r <= 5; r++)
      lines.push(faceLine(P, [x0 + 6, top - 2 - r * rh], [x1 - 6, top - 2 - r * rh], y));
    // Three events already booked.
    for (const [c, r] of [
      [1, 1],
      [4, 3],
      [5, 0],
    ] as const)
      blue.push(
        faceRect(
          P,
          x0 + 8 + c * cw,
          x0 + 4 + (c + 1) * cw,
          top - 2 - (r + 1) * rh + 2,
          top - 4 - r * rh,
          y,
        ),
      );
    ringD = faceRect(
      P,
      x0 + 6 + 3 * cw - 2,
      x0 + 6 + 4 * cw + 2,
      top - 2 - 2 * rh - 2,
      top - 2 - rh + 2,
      y,
    );
    tip = [x0 + 6 + 3.6 * cw, top - 2 - 1.6 * rh];
  } else {
    // A spreadsheet: a ribbon of buttons, then the grid. Teaching rings PivotTable.
    const top = z1 - 9;
    for (let i = 0; i < 6; i++)
      lines.push(faceRect(P, x0 + 6 + i * 20, x0 + 22 + i * 20, top - 11, top - 1, y));
    const gridTop = top - 16;
    for (let r = 0; r < 6; r++)
      lines.push(faceLine(P, [x0 + 6, gridTop - r * 8.6], [x1 - 6, gridTop - r * 8.6], y));
    for (let c = 0; c < 6; c++)
      lines.push(faceLine(P, [x0 + 6 + c * 22, gridTop], [x0 + 6 + c * 22, gridTop - 5 * 8.6], y));
    for (let r = 1; r < 5; r++)
      blue.push(
        faceLine(
          P,
          [x1 - 30 + r * 5, gridTop - 47],
          [x1 - 30 + r * 5, gridTop - 47 + [6, 11, 8, 14][r - 1]!],
          y,
        ),
      );
    if (focus === "sheet") {
      ringD = faceRect(P, x0 + 6 + 2 * 20 - 2.5, x0 + 22 + 2 * 20 + 2.5, top - 13.5, top + 1.5, y);
      tip = [x0 + 36 + 2 * 20, top - 7];
    }
  }
  return (
    <g>
      <Line d={lines.join("")} tone="faint" />
      <Line d={blue.join("")} tone="blue" />
      {ringD ? <Ringed d={ringD} /> : null}
      {tip ? <path className="desk-cursor" d={cursorOnFace(P, tip[0], tip[1], y)} /> : null}
    </g>
  );
}

function Router({ P, on, at }: { P: Projection; on: boolean; at: (p: Point3) => Flat }) {
  const { x, y, w, d, h, antenna } = ROUTER;
  const plan: Plan = { x, y, w, d, r: 4 };
  const vents = Array.from({ length: 7 }, (_, i) =>
    lineOnTop([x + 12 + i * 5, y + 7], [x + 12 + i * 5, y + d - 14], h, P),
  ).join("");
  const leds = [0, 1, 2, 3].map((i) => [x + 12 + i * 8, y + d - 6] as const);
  return (
    <g>
      {[x + 6, x + w - 6].map((ax) => (
        <g key={ax}>
          <Solid paths={cylinder(ax, y + 4, 3.4, h, 3, P, 16)} tone="mid" />
          <Solid
            paths={cylinder(ax, y + 4, 2.1, h + 3, antenna - 3, P, 14)}
            tone="mid"
            lit={on && ax > x + w / 2}
          />
        </g>
      ))}
      <Solid
        paths={slabOf({ x, y: y + 8, w, d: d - 8, r: 4 }, 0, h, P, 6, 0.8)}
        tone="mid"
        lit={on}
      />
      <Line d={vents} tone="faint" />
      <Line d={planOutline(insetPlan(plan, 3), h, P)} tone="faint" />
      <Dots
        points={leds.slice(0, 3).map(([lx, ly]) => at([lx, ly, h]))}
        size={1}
        tone={on ? "hi" : "mid"}
      />
      {/* The blinking light the question is about. */}
      <Line d={ring(leds[3]![0], leds[3]![1], 1.6, h, P, 16)} tone="blue" />
      {on ? <Ringed d={ring(leds[3]![0], leds[3]![1], 6, h, P, 32)} /> : null}
    </g>
  );
}

function Tray({
  P,
  on,
  lit,
  at,
}: {
  P: Projection;
  on: boolean;
  lit: boolean;
  at: (p: Point3) => Flat;
}) {
  const { x, y, w, d } = TRAY;
  const cw = (w - 12) / 2;
  const cd = (d - 12) / 2;
  const cells: Plan[] = [0, 1].flatMap((r) =>
    [0, 1].map((c) => ({ x: x + 4 + c * (cw + 4), y: y + 4 + r * (cd + 4), w: cw, d: cd, r: 2 })),
  );
  const [screws, brackets, posts, board] = cells as [Plan, Plan, Plan, Plan];
  const screwAt = [0, 1, 2].flatMap((r) =>
    [0, 1, 2].map((c) => [screws.x + 6 + c * 9, screws.y + 5 + r * 7] as const),
  );
  return (
    <g>
      <Solid paths={slabOf(TRAY, 0, TRAY_H, P, 6, 0.8)} tone="mid" lit={lit} />
      <Line d={cells.map((c) => planOutline(c, TRAY_H, P)).join("")} tone="lo" />
      <Line d={screwAt.map(([sx, sy]) => ring(sx, sy, 2, TRAY_H, P, 12)).join("")} tone="lo" />
      <Dots points={screwAt.map(([sx, sy]) => at([sx, sy, TRAY_H]))} size={0.6} tone="hi" />
      {[0, 1].map((i) => (
        <g key={i}>
          <Solid
            paths={slabOf(
              { x: brackets.x + 4 + i * 14, y: brackets.y + 3, w: 10, d: brackets.d - 6, r: 1 },
              TRAY_H,
              2,
              P,
              3,
            )}
            tone="hi"
          />
          <Solid
            paths={slabOf(
              { x: brackets.x + 4 + i * 14, y: brackets.y + 3, w: 3, d: brackets.d - 6, r: 1 },
              TRAY_H + 2,
              6,
              P,
              3,
            )}
            tone="hi"
          />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <Solid
          key={i}
          paths={cylinder(posts.x + 7 + i * 10, posts.y + posts.d / 2, 2.6, TRAY_H, 9, P, 14)}
          tone="hi"
        />
      ))}
      <Solid paths={slabOf(insetPlan(board, 3), TRAY_H, 1.6, P, 4)} tone="hi" />
      <Solid
        paths={slabOf(
          { x: board.x + 9, y: board.y + 6, w: 9, d: 7, r: 1 },
          TRAY_H + 1.6,
          1.8,
          P,
          3,
        )}
        tone="mid"
      />
      {on ? (
        <>
          <Ringed d={planOutline(insetPlan(brackets, -1.5), TRAY_H, P)} />
          <Ringed d={planOutline(insetPlan(posts, -1.5), TRAY_H, P)} />
        </>
      ) : null}
    </g>
  );
}

function Manual({ P, on }: { P: Projection; on: boolean }) {
  const { x, y, w, d } = MANUAL;
  const half = w / 2;
  const text = [0, 1].flatMap((page) =>
    Array.from({ length: 7 }, (_, i) =>
      lineOnTop(
        [x + page * half + 6, y + 10 + i * 6],
        [x + page * half + half - 6 - ((i * 7) % 11), y + 10 + i * 6],
        MANUAL_H,
        P,
      ),
    ),
  );
  const step: Plan = { x: x + half + 6, y: y + d - 34, w: half - 12, d: 26, r: 1 };
  return (
    <g>
      <Solid paths={slabOf(MANUAL, 0, MANUAL_H, P, 4, 0.4)} tone="mid" />
      <Line d={lineOnTop([x + half, y + 2], [x + half, y + d - 2], MANUAL_H, P)} tone="lo" />
      <Line d={text.join("")} tone="faint" />
      <Line d={planOutline(step, MANUAL_H, P)} tone="lo" />
      <Line
        d={lineOnTop([step.x + 4, step.y + 18], [step.x + step.w - 4, step.y + 8], MANUAL_H, P)}
        tone="faint"
      />
      {on ? <Ringed d={planOutline(insetPlan(step, -2), MANUAL_H, P)} /> : null}
    </g>
  );
}

function Phone({ P, focus }: { P: Projection; focus: Focus }) {
  const screen = insetPlan(PHONE, 3);
  const z = PHONE_H;
  const marks: string[] = [];
  const blue: string[] = [];
  if (focus === "kit") {
    // The camera view of the tray: what's there, outlined.
    blue.push(planOutline({ x: screen.x + 5, y: screen.y + 12, w: 12, d: 14, r: 1 }, z, P));
    blue.push(planOutline({ x: screen.x + 19, y: screen.y + 30, w: 9, d: 16, r: 1 }, z, P));
    marks.push(
      planOutline(
        { x: screen.x + 4, y: screen.y + screen.d - 12, w: screen.w - 8, d: 7, r: 3 },
        z,
        P,
      ),
    );
  } else if (focus === "calendar") {
    for (let i = 0; i < 3; i++)
      marks.push(
        planOutline(
          { x: screen.x + 3, y: screen.y + 8 + i * 12, w: screen.w - 6, d: 9, r: 2 },
          z,
          P,
        ),
      );
    blue.push(lineOnTop([screen.x + 6, screen.y + 12.5], [screen.x + 20, screen.y + 12.5], z, P));
  } else {
    marks.push(
      lineOnTop([screen.x + 6, screen.y + 14], [screen.x + screen.w - 8, screen.y + 14], z, P),
    );
    marks.push(
      lineOnTop([screen.x + 6, screen.y + 20], [screen.x + screen.w - 14, screen.y + 20], z, P),
    );
  }
  return (
    <g>
      <Solid paths={slabOf(PHONE, 0, PHONE_H, P, 8, 0.6)} tone="mid" lit={focus === "kit"} />
      <Line d={planOutline(screen, z, P)} tone="lo" />
      <Line
        d={planOutline(
          { x: PHONE.x + PHONE.w / 2 - 6, y: screen.y + 2, w: 12, d: 3, r: 1.5 },
          z,
          P,
        )}
        tone="lo"
      />
      <Line d={marks.join("")} tone="faint" />
      <Line d={blue.join("")} tone="blue" />
    </g>
  );
}

function Mug({ P }: { P: Projection }) {
  const { x, y, r, h } = MUG;
  return (
    <g>
      <Solid
        paths={slabOf({ x: x + r - 2, y: y - 3, w: 11, d: 6, r: 3 }, 6, h - 12, P, 4)}
        tone="mid"
      />
      <Solid paths={cylinder(x, y, r, 0, h, P, 32, 0.6)} tone="mid" />
      <Line d={ring(x, y, r - 2, h, P, 32)} tone="lo" />
      <Line d={ring(x, y, r - 3.4, h - 4, P, 32)} tone="faint" />
    </g>
  );
}
