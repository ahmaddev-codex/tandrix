// Tandrix Server Rack Assembly: A 12U/42U high-density enterprise server rack.
// World units are millimetres; x right, y toward the viewer, z up.
// Each tier rests precisely on the structure below; exploded, it waits along its trajectory.
import { fitProjection, type Plan, type Point3 } from "@/vendor/anatomy/iso-kit";

export const WIDTH = 640;
export const HEIGHT = 600;

// Base structural frame dimensions
export const FRAME: Plan = { x: -50, y: -55, w: 100, d: 110, r: 6 };
export const BASE_H = 6;
export const POST_H = 140;
export const CROWN_H = 6;
export const FRAME_TOP = BASE_H + POST_H + CROWN_H; // 152

// 4 Corner EIA Mounting Posts (EIA-310 19" rack uprights)
export const POST_FL: Plan = { x: -50, y: 47, w: 8, d: 8, r: 1 };
export const POST_FR: Plan = { x: 42, y: 47, w: 8, d: 8, r: 1 };
export const POST_RL: Plan = { x: -50, y: -55, w: 8, d: 8, r: 1 };
export const POST_RR: Plan = { x: 42, y: -55, w: 8, d: 8, r: 1 };

// Internal chassis envelope (standard 19" rackmount equipment)
export const CHASSIS_W = 84;
export const CHASSIS_D = 96;
export const CHASSIS_X = -42;
export const CHASSIS_Y = -48; // spans from y = -48 to y = +48

// Assembly 1: Dual Zero-U PDUs & Rear Cable Harness
export const PDU_W = 7;
export const PDU_D = 6;
export const PDU_H = 120;
export const PDU_Z = 12;
export const PDU_L: Plan = { x: -45, y: -53, w: 7, d: 6, r: 1 };
export const PDU_R: Plan = { x: 38, y: -53, w: 7, d: 6, r: 1 };

// Assembly 2: 4U SAS/NVMe High-Density Storage Chassis
export const STORAGE_Z = 14;
export const STORAGE_H = 32;
export const STORAGE_PLAN: Plan = { x: CHASSIS_X, y: CHASSIS_Y, w: CHASSIS_W, d: CHASSIS_D, r: 2 };

// Assembly 3: 2U Accelerator / Compute Node (GPU Server)
export const COMPUTE_Z = 54;
export const COMPUTE_H = 20;
export const COMPUTE_PLAN: Plan = { x: CHASSIS_X, y: CHASSIS_Y, w: CHASSIS_W, d: CHASSIS_D, r: 2 };

// Assembly 4: 1U Top-of-Rack Fiber Switch
export const SWITCH_Z = 124;
export const SWITCH_H = 12;
export const SWITCH_PLAN: Plan = {
  x: CHASSIS_X,
  y: CHASSIS_Y + 4,
  w: CHASSIS_W,
  d: CHASSIS_D - 4,
  r: 1.5,
};

// Assembly 5: Front Perforated Hex-Mesh Door & Tandrix Interface
export const DOOR_Z = 8;
export const DOOR_H = 136;
export const DOOR_PLAN: Plan = { x: -47, y: 50, w: 94, d: 4, r: 3 };

export interface RackPart {
  name: string;
  apart: number;
  offset: [number, number, number];
  role: string;
}

/**
 * Bottom to top assembly tiers, with 3D translation offsets [dx, dy, dz]
 * when the server rack is in exploded view.
 */
export const RACK_PARTS: readonly RackPart[] = [
  {
    name: "Base Frame & EIA Posts",
    apart: 0,
    offset: [0, 0, 0],
    role: "4-post EIA-310 structural frame, casters, leveling feet & roof grommets",
  },
  {
    name: "Dual Zero-U PDUs & Harness",
    apart: 65,
    offset: [0, -28, 65],
    role: "Dual vertical power distribution units, C13/C19 banks & 3-phase whips",
  },
  {
    name: "4U SAS Storage Chassis",
    apart: 145,
    offset: [0, 48, 80],
    role: "24 hot-swap NVMe/SAS drive caddies, slide rails & redundant PSUs",
  },
  {
    name: "2U GPU Accelerator Node",
    apart: 235,
    offset: [0, 40, 165],
    role: "Dual CPU heatsinks, 6-fan mid-wall, DDR5 DIMMs & 4 PCIe GPU accelerators",
  },
  {
    name: "1U Top-of-Rack Fiber Switch",
    apart: 325,
    offset: [0, 18, 255],
    role: "48 SFP28/QSFP optical ports, activity LEDs & fiber patch organizer comb",
  },
  {
    name: "Front Locking Mesh Door",
    apart: 420,
    offset: [0, 65, 350],
    role: "Perforated hex-mesh ventilation door, swing latch & Tandrix interface",
  },
] as const;

// Bounding points for isometric camera projection fitting
const BOUNDS: Point3[] = [
  [-52, -57, -12],
  [52, -57, -12],
  [-52, 57, -12],
  [52, 57, -12],
  [-52, -57, 154],
  [52, 57, 154],
  // Exploded highest and furthest points
  [-47, 57 + 65, 136 + 350],
  [47, 57 + 65, 136 + 350],
  [0, -57 - 28, 120 + 65],
  [0, 57 + 48, 32 + 80],
];

export const P = fitProjection(BOUNDS, WIDTH, HEIGHT, {
  pad: 28,
  azimuth: 40,
});
