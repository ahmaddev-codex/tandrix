// The 12U Server Rack isometric figure, assembled with Tandrix verification interface.
import { iso, type Point3 } from "@/vendor/anatomy/iso-kit";
import { RACK_LAYERS } from "./art";
import { FRAME, FRAME_TOP, HEIGHT, P, WIDTH } from "./view";

const bounds: Point3[] = [-12, FRAME_TOP + 8].flatMap((z) =>
  [
    [FRAME.x, FRAME.y],
    [FRAME.x + FRAME.w, FRAME.y],
    [FRAME.x, FRAME.y + FRAME.d],
    [FRAME.x + FRAME.w, FRAME.y + FRAME.d],
  ].map(([x, y]) => [x!, y!, z] as Point3),
);

const flat = bounds.map((c) => iso(c, P));
const PAD = 16;
const X = Math.min(...flat.map((f) => f[0])) - PAD;
const Y = Math.min(...flat.map((f) => f[1])) - PAD;
const W = Math.max(...flat.map((f) => f[0])) + PAD - X;
const H = Math.max(...flat.map((f) => f[1])) + PAD - Y;

export function RackFigure({
  label = "A 12U enterprise server rack assembled with Tandrix verification",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`iso flex size-full min-h-0 justify-center [--anatomy-card:var(--fig-ground,var(--background-100))] [--anatomy-paper:var(--fig-ground,var(--background-100))] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full ${className ?? ""}`}
    >
      <svg className="iso-svg" viewBox={`${X} ${Y} ${W} ${H}`} role="img" aria-label={label}>
        {RACK_LAYERS}
      </svg>
    </div>
  );
}

export function RackExplodedStill({
  label = "Exploded view of 12U server rack hardware components",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`iso flex size-full min-h-0 justify-center [--anatomy-card:var(--fig-ground,var(--background-100))] [--anatomy-paper:var(--fig-ground,var(--background-100))] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full ${className ?? ""}`}
    >
      <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
        {RACK_LAYERS}
      </svg>
    </div>
  );
}
