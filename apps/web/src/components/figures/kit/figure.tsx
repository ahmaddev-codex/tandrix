// The kit, still, for the "Is this part seated right?" card: the cooler stands proud on its left
// pin. Cropped to the case and cooler, not the room the explode needs.
import "@/vendor/anatomy/iso.css";
import { iso, type Point3 } from "@/vendor/anatomy/iso-kit";
import { SeatedStill } from "./art";
import { CASE, COOLER_Z, P } from "./view";
import styles from "../desk/desk.module.css";

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
    <div className={`iso ${styles.wrap}`}>
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
