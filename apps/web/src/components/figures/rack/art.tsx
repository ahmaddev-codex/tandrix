// The Server Rack assembly as server-built SVG, bottom to top.
// Each assembly comes with its ghost: the blue landing outline showing where it docks,
// lighted as Tandrix guides that assembly step.
import * as React from "react";
import {
  corners,
  cylinder,
  dotGrid,
  insetPlan,
  iso,
  lineOnTop,
  planOutline,
  ring,
  slabOf,
  type Plan,
} from "@/vendor/anatomy/iso-kit";
import { Dots, Line, Solid, Wire } from "@/vendor/anatomy/react/draw";
import {
  BASE_H,
  CHASSIS_D,
  CHASSIS_W,
  CHASSIS_X,
  CHASSIS_Y,
  COMPUTE_H,
  COMPUTE_PLAN,
  COMPUTE_Z,
  CROWN_H,
  DOOR_H,
  DOOR_PLAN,
  DOOR_Z,
  FRAME,
  FRAME_TOP,
  P,
  PDU_D,
  PDU_H,
  PDU_L,
  PDU_R,
  PDU_W,
  PDU_Z,
  POST_FL,
  POST_FR,
  POST_H,
  POST_RL,
  POST_RR,
  STORAGE_H,
  STORAGE_PLAN,
  STORAGE_Z,
  SWITCH_H,
  SWITCH_PLAN,
  SWITCH_Z,
} from "./view";

const slab = (plan: Plan, z: number, h: number, steps = 6, bevel = 0) =>
  slabOf(plan, z, h, P, steps, bevel);
const at = (x: number, y: number, z: number) => iso([x, y, z], P);
const joined = (paths: string[]) => paths.join("");

// ---------------------------------------------------------------------------
// 0. FRAME ART (Base plate, 4 casters, leveling feet, 4 EIA posts, roof crown)
// ---------------------------------------------------------------------------
const POSTS = [POST_RL, POST_RR, POST_FL, POST_FR];
const CASTER_POS = corners(FRAME, 12);
const TIE_Z = 72;

const FRAME_ART = (
  <g>
    {/* Floor shadow halo under base */}
    <path className="iso-halo" d={slab(FRAME, -10, BASE_H + 10).fill} />

    {/* 4 Corner Swivel Casters & Threaded Leveling Feet */}
    {CASTER_POS.map(([x, y], i) => (
      <g key={`caster-${i}`}>
        {/* Swivel mount bracket */}
        <Solid paths={cylinder(x, y, 4.2, -4, 4, P, 16)} tone="lo" />
        {/* Caster wheel tire */}
        <Solid paths={cylinder(x, y, 3.2, -10, 6, P, 16)} tone="hi" />
        {/* Threaded leveling foot */}
        <Solid paths={cylinder(x + (x > 0 ? -7 : 7), y, 2.8, -9, 3, P, 14)} tone="mid" />
        <Line d={ring(x + (x > 0 ? -7 : 7), y, 2.8, -6, P, 14)} tone="faint" />
      </g>
    ))}

    {/* Heavy Structural Base Plate */}
    <Solid paths={slab(FRAME, 0, BASE_H, 8, 1.2)} tone="mid" />
    <Line d={planOutline(insetPlan(FRAME, 4), BASE_H, P)} tone="faint" />
    {/* Base floor ventilation grid */}
    <Dots points={dotGrid(-28, -35, 14, 18, 4, BASE_H, P)} size={0.45} tone="lo" />
    {/* Corner anchor bolts */}
    {corners(FRAME, 6).map(([x, y], i) => (
      <g key={`anchor-${i}`}>
        <Line d={ring(x, y, 1.8, BASE_H, P, 12)} tone="faint" />
        <Dots points={[at(x, y, BASE_H)]} size={0.5} tone="mid" />
      </g>
    ))}

    {/* 4 Vertical EIA-310 Mounting Posts */}
    {POSTS.map((post, i) => (
      <g key={`post-${i}`}>
        <Solid paths={slab(post, BASE_H, POST_H, 4, 0.4)} tone="hi" />
        <Line d={planOutline(insetPlan(post, 1), BASE_H + POST_H, P)} tone="faint" />
      </g>
    ))}

    {/* Post EIA Unit Markings & Square Cage Nut Slots on Front Uprights */}
    {[POST_FL, POST_FR].map((post, pIdx) => (
      <g key={`eia-ticks-${pIdx}`}>
        {Array.from({ length: 18 }, (_, u) => {
          const z = BASE_H + 10 + u * 7;
          return (
            <React.Fragment key={`u-${u}`}>
              {/* 1U divider line across post face */}
              <Line
                d={lineOnTop(
                  [post.x + 0.8, post.y + post.d],
                  [post.x + post.w - 0.8, post.y + post.d],
                  z,
                  P,
                )}
                tone="lo"
              />
              {/* Cage nut square hole marker */}
              <Dots
                points={[at(post.x + post.w / 2, post.y + post.d, z + 3.5)]}
                size={0.65}
                tone="lo"
              />
            </React.Fragment>
          );
        })}
      </g>
    ))}

    {/* Mid-height Structural Tie Braces */}
    {/* Left side tie bar */}
    <Solid paths={slab({ x: -49, y: -47, w: 6, d: 94, r: 1 }, TIE_Z, 6, 2, 0.3)} tone="mid" />
    {/* Right side tie bar */}
    <Solid paths={slab({ x: 43, y: -47, w: 6, d: 94, r: 1 }, TIE_Z, 6, 2, 0.3)} tone="mid" />
    {/* Rear cross tie bar */}
    <Solid paths={slab({ x: -42, y: -54, w: 84, d: 5, r: 1 }, TIE_Z, 6, 2, 0.3)} tone="mid" />

    {/* Top Roof Crown Panel */}
    <Solid paths={slab(FRAME, BASE_H + POST_H, CROWN_H, 8, 1.2)} tone="mid" />
    <Line d={planOutline(insetPlan(FRAME, 4), FRAME_TOP, P)} tone="faint" />

    {/* Dual Cable Brush Pass-through Grommets on Roof */}
    <Solid paths={slab({ x: -32, y: -38, w: 20, d: 18, r: 2 }, FRAME_TOP, 1.4, 2)} tone="lo" />
    <Line
      d={joined(
        Array.from({ length: 6 }, (_, i) =>
          lineOnTop([-30 + i * 3.4, -36], [-30 + i * 3.4, -22], FRAME_TOP + 1.4, P),
        ),
      )}
      tone="faint"
    />

    <Solid paths={slab({ x: 12, y: -38, w: 20, d: 18, r: 2 }, FRAME_TOP, 1.4, 2)} tone="lo" />
    <Line
      d={joined(
        Array.from({ length: 6 }, (_, i) =>
          lineOnTop([14 + i * 3.4, -36], [14 + i * 3.4, -22], FRAME_TOP + 1.4, P),
        ),
      )}
      tone="faint"
    />

    {/* Roof Exhaust Louver Vents */}
    <Line
      d={joined(
        Array.from({ length: 7 }, (_, i) =>
          lineOnTop([-16, -6 + i * 5], [16, -6 + i * 5], FRAME_TOP, P),
        ),
      )}
      tone="lo"
    />
  </g>
);

// ---------------------------------------------------------------------------
// 1. DUAL ZERO-U PDUs & REAR CABLE HARNESS (`PDU_ART`)
// ---------------------------------------------------------------------------
const PDUS = [PDU_L, PDU_R];

const PDU_ART = (
  <g>
    {PDUS.map((pdu, pIdx) => (
      <g key={`pdu-${pIdx}`}>
        {/* Vertical PDU Housing Strip */}
        <Solid paths={slab(pdu, PDU_Z, PDU_H, 2, 0.4)} tone="lo" />
        <Line d={planOutline(insetPlan(pdu, 0.8), PDU_Z + PDU_H, P)} tone="faint" />

        {/* 12 IEC C13/C19 Receptacle Outlets */}
        {Array.from({ length: 12 }, (_, oIdx) => {
          const oz = PDU_Z + 8 + oIdx * 9;
          return (
            <g key={`outlet-${oIdx}`}>
              <Solid
                paths={slab(
                  { x: pdu.x + 1.2, y: pdu.y + 1, w: PDU_W - 2.4, d: PDU_D - 2, r: 0.6 },
                  oz,
                  5.2,
                  2,
                )}
                tone="hi"
              />
              {/* Outlet socket aperture dot */}
              <Dots
                points={[at(pdu.x + PDU_W / 2, pdu.y + PDU_D / 2, oz + 5.2)]}
                size={0.65}
                tone="mid"
              />
            </g>
          );
        })}

        {/* Digital Load Meter LED Window at top */}
        <Solid
          paths={slab(
            { x: pdu.x + 1, y: pdu.y + 0.8, w: PDU_W - 2, d: PDU_D - 1.6, r: 0.5 },
            PDU_Z + PDU_H - 12,
            7,
            2,
          )}
          tone="hi"
          lit
        />
        {/* Status LED */}
        <Dots
          points={[at(pdu.x + PDU_W / 2, pdu.y + PDU_D / 2, PDU_Z + PDU_H - 8)]}
          size={0.7}
          tone="hi"
        />

        {/* Overhead 3-Phase Power Feed Cable Whip */}
        <Wire
          from={at(pdu.x + PDU_W / 2, pdu.y + PDU_D / 2, PDU_Z + PDU_H)}
          to={at(pdu.x + (pdu.x > 0 ? 8 : -8), -30, FRAME_TOP + 18)}
          via={[
            at(pdu.x + PDU_W / 2, pdu.y + 2, PDU_Z + PDU_H + 10),
            at(pdu.x + (pdu.x > 0 ? 5 : -5), -32, FRAME_TOP + 8),
          ]}
          size={1.6}
          tone="hi"
        />
        {/* Industrial Twist-lock Plug Cylinder at whip terminus */}
        <Solid
          paths={cylinder(pdu.x + (pdu.x > 0 ? 8 : -8), -30, 2.4, FRAME_TOP + 18, 8, P, 14)}
          tone="hi"
        />
      </g>
    ))}

    {/* Rear Vertical Cable Management Raceway / Tie-down Bars */}
    {Array.from({ length: 6 }, (_, i) => {
      const bz = PDU_Z + 15 + i * 18;
      return <Line key={`cable-tie-${i}`} d={lineOnTop([-36, -52], [36, -52], bz, P)} tone="lo" />;
    })}
  </g>
);

// ---------------------------------------------------------------------------
// 2. 4U HIGH-DENSITY SAS/NVMe STORAGE CHASSIS (`STORAGE_ART`)
// ---------------------------------------------------------------------------
const STORAGE_ART = (
  <g>
    {/* Telescoping Slide Rails (Left & Right) */}
    <Solid
      paths={slab(
        { x: CHASSIS_X - 3.5, y: CHASSIS_Y + 2, w: 3.5, d: CHASSIS_D - 4, r: 0.6 },
        STORAGE_Z + 4,
        6,
        2,
      )}
      tone="hi"
    />
    <Solid
      paths={slab(
        { x: CHASSIS_X + CHASSIS_W, y: CHASSIS_Y + 2, w: 3.5, d: CHASSIS_D - 4, r: 0.6 },
        STORAGE_Z + 4,
        6,
        2,
      )}
      tone="hi"
    />
    {/* Blue Rail Release Latches */}
    <Solid
      paths={slab(
        { x: CHASSIS_X - 4.5, y: CHASSIS_Y + CHASSIS_D - 10, w: 2, d: 8, r: 0.4 },
        STORAGE_Z + 5,
        4,
        2,
      )}
      tone="hi"
      lit
    />
    <Solid
      paths={slab(
        { x: CHASSIS_X + CHASSIS_W + 2.5, y: CHASSIS_Y + CHASSIS_D - 10, w: 2, d: 8, r: 0.4 },
        STORAGE_Z + 5,
        4,
        2,
      )}
      tone="hi"
      lit
    />

    {/* Heavy 4U Chassis Main Enclosure */}
    <Solid paths={slab(STORAGE_PLAN, STORAGE_Z, STORAGE_H, 4, 0.8)} tone="mid" />
    <Line d={planOutline(insetPlan(STORAGE_PLAN, 2), STORAGE_Z + STORAGE_H, P)} tone="faint" />

    {/* Front Chassis Industrial Pull Handles */}
    <Solid
      paths={cylinder(CHASSIS_X + 2, CHASSIS_Y + CHASSIS_D + 2, 1.5, STORAGE_Z + 6, 20, P, 12)}
      tone="hi"
    />
    <Solid
      paths={cylinder(
        CHASSIS_X + CHASSIS_W - 2,
        CHASSIS_Y + CHASSIS_D + 2,
        1.5,
        STORAGE_Z + 6,
        20,
        P,
        12,
      )}
      tone="hi"
    />

    {/* 24 Hot-Swap 3.5" SAS/NVMe Drive Caddies in 4 Rows x 6 Columns */}
    {Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 6 }, (_, col) => {
        const cx = CHASSIS_X + 6 + col * 12;
        const cz = STORAGE_Z + 3 + row * 6.8;
        return (
          <g key={`caddy-${row}-${col}`}>
            {/* Drive caddy bezel */}
            <Solid
              paths={slab(
                { x: cx, y: CHASSIS_Y + CHASSIS_D - 1.5, w: 10.5, d: 2, r: 0.6 },
                cz,
                5.6,
                2,
              )}
              tone="lo"
            />
            {/* Ejector release latch lever */}
            <Line
              d={lineOnTop(
                [cx + 1, CHASSIS_Y + CHASSIS_D + 0.5],
                [cx + 9.5, CHASSIS_Y + CHASSIS_D + 0.5],
                cz + 1.2,
                P,
              )}
              tone="mid"
            />
            {/* Power LED (green) & Activity LED (amber) */}
            <Dots
              points={[at(cx + 9, CHASSIS_Y + CHASSIS_D + 0.5, cz + 4.2)]}
              size={0.4}
              tone="hi"
            />
            <Dots
              points={[at(cx + 7.6, CHASSIS_Y + CHASSIS_D + 0.5, cz + 4.2)]}
              size={0.4}
              tone="mid"
            />
          </g>
        );
      }),
    )}

    {/* Dual Hot-Swap Redundant Power Supply Units (PSUs) at Rear */}
    {[-28, 12].map((px, i) => (
      <g key={`psu-${i}`}>
        <Solid
          paths={slab({ x: px, y: CHASSIS_Y - 3, w: 16, d: 3, r: 0.6 }, STORAGE_Z + 4, 14, 2)}
          tone="hi"
        />
        {/* PSU Finger Pull Loop */}
        <Line d={ring(px + 8, CHASSIS_Y - 3, 2.6, STORAGE_Z + 11, P, 14)} tone="lo" />
      </g>
    ))}
  </g>
);

// ---------------------------------------------------------------------------
// 3. 2U GPU ACCELERATOR / COMPUTE NODE (`COMPUTE_ART`)
// ---------------------------------------------------------------------------
const HEATSINKS = [
  { x: -30, y: -6, w: 22, d: 24, r: 1.5 },
  { x: 8, y: -6, w: 22, d: 24, r: 1.5 },
];

const COMPUTE_ART = (
  <g>
    {/* Telescoping Slide Rails */}
    <Solid
      paths={slab(
        { x: CHASSIS_X - 3.5, y: CHASSIS_Y + 2, w: 3.5, d: CHASSIS_D - 4, r: 0.6 },
        COMPUTE_Z + 4,
        5,
        2,
      )}
      tone="hi"
    />
    <Solid
      paths={slab(
        { x: CHASSIS_X + CHASSIS_W, y: CHASSIS_Y + 2, w: 3.5, d: CHASSIS_D - 4, r: 0.6 },
        COMPUTE_Z + 4,
        5,
        2,
      )}
      tone="hi"
    />

    {/* 2U Compute Enclosure Tray */}
    <Solid paths={slab(COMPUTE_PLAN, COMPUTE_Z, COMPUTE_H, 4, 0.6)} tone="mid" />
    <Line d={planOutline(insetPlan(COMPUTE_PLAN, 2), COMPUTE_Z + COMPUTE_H, P)} tone="faint" />

    {/* Front Control Panel: Power Button Ring, ID LED & Dual USB Ports */}
    <Line
      d={ring(CHASSIS_X + 4, CHASSIS_Y + CHASSIS_D + 0.5, 1.8, COMPUTE_Z + 12, P, 12)}
      tone="hi"
    />
    <Dots
      points={[at(CHASSIS_X + 4, CHASSIS_Y + CHASSIS_D + 0.5, COMPUTE_Z + 12)]}
      size={0.6}
      tone="hi"
    />
    <Solid
      paths={slab(
        { x: CHASSIS_X + 9, y: CHASSIS_Y + CHASSIS_D - 1, w: 6, d: 1.5, r: 0.4 },
        COMPUTE_Z + 10,
        4,
        2,
      )}
      tone="lo"
    />

    {/* Dual Server CPU Sockets & Heavy Stacked Heatsinks */}
    {HEATSINKS.map((hs, i) => (
      <g key={`hs-${i}`}>
        {/* Heatsink base copper block */}
        <Solid paths={slab(hs, COMPUTE_Z + 2, 14, 2, 0.5)} tone="hi" />
        {/* Aluminum cooling fins across top */}
        <Line
          d={joined(
            Array.from({ length: 9 }, (_, fIdx) =>
              lineOnTop(
                [hs.x + 2, hs.y + 2 + fIdx * 2.4],
                [hs.x + hs.w - 2, hs.y + 2 + fIdx * 2.4],
                COMPUTE_Z + 16,
                P,
              ),
            ),
          )}
          tone="mid"
        />
        {/* Heatpipe copper tubes */}
        <Line
          d={joined([
            lineOnTop([hs.x + 4, hs.y], [hs.x + 4, hs.y + hs.d], COMPUTE_Z + 16, P),
            lineOnTop([hs.x + hs.w - 4, hs.y], [hs.x + hs.w - 4, hs.y + hs.d], COMPUTE_Z + 16, P),
          ])}
          tone="lo"
        />
      </g>
    ))}

    {/* 6 Hot-Swap Mid-Chassis Fan Modules (Fan Wall) */}
    <Solid paths={slab({ x: -36, y: 18, w: 72, d: 7, r: 1 }, COMPUTE_Z + 1.5, 15, 2)} tone="lo" />
    {Array.from({ length: 6 }, (_, fIdx) => {
      const fx = -30 + fIdx * 12;
      return (
        <g key={`fan-${fIdx}`}>
          <Solid paths={cylinder(fx, 21.5, 4.4, COMPUTE_Z + 2, 14, P, 18)} tone="mid" />
          <Line d={ring(fx, 21.5, 3.4, COMPUTE_Z + 16, P, 18)} tone="faint" />
          {/* Swept fan blades */}
          <Line
            d={joined(
              Array.from({ length: 5 }, (_, bIdx) => {
                const a = (bIdx / 5) * Math.PI * 2;
                return lineOnTop(
                  [fx + 1.2 * Math.cos(a), 21.5 + 1.2 * Math.sin(a)],
                  [fx + 3.8 * Math.cos(a + 0.4), 21.5 + 3.8 * Math.sin(a + 0.4)],
                  COMPUTE_Z + 16,
                  P,
                );
              }),
            )}
            tone="lo"
          />
        </g>
      );
    })}

    {/* DDR5 Memory DIMM Slot Banks beside Heatsinks */}
    {[-38, 32].map((dimmX, bIdx) =>
      Array.from({ length: 4 }, (_, dIdx) => (
        <Solid
          key={`dimm-${bIdx}-${dIdx}`}
          paths={slab({ x: dimmX, y: -6 + dIdx * 6, w: 5.5, d: 4.5, r: 0.4 }, COMPUTE_Z + 2, 12, 2)}
          tone="hi"
        />
      )),
    )}

    {/* 4 Full-Length PCIe GPU Expansion Accelerator Cards in Riser Cage */}
    {Array.from({ length: 4 }, (_, gIdx) => {
      const gy = -42 + gIdx * 7.5;
      return (
        <g key={`gpu-${gIdx}`}>
          {/* GPU expansion board */}
          <Solid
            paths={slab({ x: -36, y: gy, w: 72, d: 5, r: 0.6 }, COMPUTE_Z + 3, 14, 2)}
            tone="hi"
          />
          {/* Rear PCIe bracket retention thumbscrew */}
          <Dots points={[at(-34, gy + 2.5, COMPUTE_Z + 17)]} size={0.5} tone="mid" />
        </g>
      );
    })}
  </g>
);

// ---------------------------------------------------------------------------
// 4. 1U TOP-OF-RACK HIGH-SPEED FIBER SWITCH (`SWITCH_ART`)
// ---------------------------------------------------------------------------
const SWITCH_ART = (
  <g>
    {/* 1U Switch Chassis Body */}
    <Solid paths={slab(SWITCH_PLAN, SWITCH_Z, SWITCH_H, 3, 0.5)} tone="mid" />
    <Line d={planOutline(insetPlan(SWITCH_PLAN, 2), SWITCH_Z + SWITCH_H, P)} tone="faint" />

    {/* Mounting Flange Ears with Post Screws */}
    <Solid
      paths={slab({ x: CHASSIS_X - 4, y: 47, w: 4, d: 4, r: 0.5 }, SWITCH_Z + 1, 10, 2)}
      tone="hi"
    />
    <Dots points={[at(CHASSIS_X - 2, 49, SWITCH_Z + 6)]} size={0.65} tone="mid" />
    <Solid
      paths={slab({ x: CHASSIS_X + CHASSIS_W, y: 47, w: 4, d: 4, r: 0.5 }, SWITCH_Z + 1, 10, 2)}
      tone="hi"
    />
    <Dots points={[at(CHASSIS_X + CHASSIS_W + 2, 49, SWITCH_Z + 6)]} size={0.65} tone="mid" />

    {/* 48 SFP28/QSFP Optical Transceiver Cages across Front Face (2 Rows x 24 Ports) */}
    {Array.from({ length: 2 }, (_, row) =>
      Array.from({ length: 24 }, (_, col) => {
        const px = CHASSIS_X + 4 + col * 2.9;
        const pz = SWITCH_Z + 2 + row * 4.5;
        return (
          <g key={`port-${row}-${col}`}>
            <Solid
              paths={slab(
                { x: px, y: CHASSIS_Y + CHASSIS_D - 0.8, w: 2.3, d: 1.5, r: 0.3 },
                pz,
                3.6,
                2,
              )}
              tone="lo"
            />
            {/* Link Activity LED Indicator */}
            <Dots
              points={[at(px + 1.15, CHASSIS_Y + CHASSIS_D + 0.8, pz + 4)]}
              size={0.3}
              tone="hi"
            />
          </g>
        );
      }),
    )}

    {/* 6 QSFP56 100G Uplink Cages on Right Flank */}
    {Array.from({ length: 6 }, (_, uIdx) => (
      <Solid
        key={`uplink-${uIdx}`}
        paths={slab(
          {
            x: CHASSIS_X + CHASSIS_W - 12 + uIdx * 1.8,
            y: CHASSIS_Y + CHASSIS_D - 1,
            w: 1.4,
            d: 1.8,
            r: 0.2,
          },
          SWITCH_Z + 3,
          6,
          2,
        )}
        tone="hi"
        lit
      />
    ))}

    {/* Horizontal Cable Organizer Comb & Fiber Optic Patch Jumpers */}
    <Solid
      paths={slab(
        { x: CHASSIS_X, y: CHASSIS_Y + CHASSIS_D + 1, w: CHASSIS_W, d: 3, r: 0.5 },
        SWITCH_Z,
        2,
        2,
      )}
      tone="lo"
    />
    {/* Fiber Jumper loops (Aqua OM4 fiber cables) */}
    {Array.from({ length: 8 }, (_, jIdx) => {
      const jx = CHASSIS_X + 8 + jIdx * 8;
      return (
        <Wire
          key={`fiber-${jIdx}`}
          from={at(jx, CHASSIS_Y + CHASSIS_D + 3, SWITCH_Z + 1)}
          to={at(jx + 4, CHASSIS_Y + CHASSIS_D + 0.5, SWITCH_Z + 4)}
          via={[at(jx + 2, CHASSIS_Y + CHASSIS_D + 6, SWITCH_Z - 1)]}
          size={0.8}
          tone="lit"
        />
      );
    })}
  </g>
);

// ---------------------------------------------------------------------------
// 5. FRONT PERFORATED HEX-MESH DOOR & TANDRIX INTERFACE (`DOOR_ART`)
// ---------------------------------------------------------------------------
const DOOR_ART = (
  <g>
    {/* Outer Structural Door Frame */}
    <Solid paths={slab(DOOR_PLAN, DOOR_Z, DOOR_H, 4, 1.4)} tone="hi" />
    <Line d={planOutline(insetPlan(DOOR_PLAN, 5), DOOR_Z + 6, P)} tone="lo" />

    {/* Hexagonal Ventilation Mesh Perforation Lattice */}
    <Dots
      points={dotGrid(DOOR_PLAN.x + 8, DOOR_PLAN.y + 4.2, 18, 22, 4.2, DOOR_Z + 12, P)}
      size={0.4}
      tone="mid"
    />

    {/* Recessed Ergonomic Swing Latch & Key Cylinder */}
    <Solid paths={slab({ x: 30, y: DOOR_PLAN.y + 3.8, w: 9, d: 2, r: 1 }, 68, 26, 2)} tone="lo" />
    {/* Latch swing handle lever */}
    <Solid paths={cylinder(34.5, DOOR_PLAN.y + 5.2, 2.2, 72, 18, P, 14)} tone="hi" />
    {/* Keyhole cylinder slot */}
    <Line d={ring(34.5, DOOR_PLAN.y + 5.2, 1.2, 86, P, 12)} tone="lo" />

    {/* Tandrix Signature Diagnostic Status Ring */}
    <Line d={ring(-16, DOOR_PLAN.y + 4.5, 9, 108, P, 36)} tone="lit" />
    <Line d={ring(-16, DOOR_PLAN.y + 4.5, 6.5, 108, P, 28)} tone="faint" />
    <Dots points={[at(-16, DOOR_PLAN.y + 4.5, 108)]} size={0.9} tone="hi" />

    {/* Top and Bottom Steel Hinge Pins */}
    <Solid paths={cylinder(-46, DOOR_PLAN.y + 2, 1.8, DOOR_Z + 8, 8, P, 12)} tone="hi" />
    <Solid paths={cylinder(-46, DOOR_PLAN.y + 2, 1.8, DOOR_Z + DOOR_H - 16, 8, P, 12)} tone="hi" />
  </g>
);

// ---------------------------------------------------------------------------
// GHOSTS (Blueprint-blue docking outlines for each assembly)
// ---------------------------------------------------------------------------
const ghost = (d: string) => (
  <g>
    <path className="iso-line stroke-[6px] opacity-[0.18]" data-tone="blue" d={d} />
    <path className="iso-line stroke-[1.6px]" data-tone="blue" d={d} />
  </g>
);

export const RACK_LAYERS: React.ReactNode[] = [
  FRAME_ART,
  PDU_ART,
  STORAGE_ART,
  COMPUTE_ART,
  SWITCH_ART,
  DOOR_ART,
];

export const RACK_GHOSTS: React.ReactNode[] = [
  null,
  // PDU docking ghost on rear uprights
  ghost(
    planOutline(PDU_L, PDU_Z, P) +
      planOutline(PDU_R, PDU_Z, P) +
      planOutline(PDU_L, PDU_Z + PDU_H, P) +
      planOutline(PDU_R, PDU_Z + PDU_H, P),
  ),
  // 4U Storage chassis docking footprint
  ghost(planOutline(STORAGE_PLAN, STORAGE_Z, P)),
  // 2U Compute node docking footprint
  ghost(planOutline(COMPUTE_PLAN, COMPUTE_Z, P)),
  // 1U ToR switch docking footprint
  ghost(planOutline(SWITCH_PLAN, SWITCH_Z, P)),
  // Front door perimeter footprint
  ghost(planOutline(DOOR_PLAN, DOOR_Z, P)),
];
