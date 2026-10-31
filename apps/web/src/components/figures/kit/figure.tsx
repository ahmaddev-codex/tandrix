// The kit, still, for the "Is this part seated right?" card: the cooler stands proud on its left
// pin. Cropped to the case and cooler, not the room the explode needs.
import { iso, type Point3 } from "@/vendor/anatomy/iso-kit";
import { SeatedStill } from "./art";
import { CASE, COOLER_Z, P } from "./view";

const corners: Point3[] = [-3, COOLER_Z + 30].flatMap((z) =>
  [
    [CASE.x, CASE.y],
    [CASE.x + CASE.w, CASE.y],
    [CASE.x, CASE.y + CASE.d],
    [CASE.x + CASE.w, CASE.y + CASE.d],
  ].map(([x, y]) => [x!, y!, z] as Point3),
);
const flat = corners.map((c) => iso(c, P));
const PAD = 10;
const X = Math.min(...flat.map((f) => f[0])) - PAD;
const Y = Math.min(...flat.map((f) => f[1])) - PAD;
const W = Math.max(...flat.map((f) => f[0])) + PAD - X;
const H = Math.max(...flat.map((f) => f[1])) + PAD - Y;

export function SeatedFigure() {
  return (
    <div className="iso flex size-full min-h-0 justify-center [--anatomy-card:var(--fig-ground,var(--background-100))] [--anatomy-paper:var(--fig-ground,var(--background-100))] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full">
      <svg
        className="iso-svg"
        viewBox={`${X} ${Y} ${W} ${H}`}
        role="img"
        aria-label="The cooler sitting high on its left pin, ringed"
      >
        <SeatedStill />
      </svg>
    </div>
  );
}
