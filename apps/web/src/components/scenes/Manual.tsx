// A printed assembly manual page: an isometric line drawing of the step, the parts it needs, and a
// close-up, with Tandrix marking the step it's on. The drawing is computed from simple boxes.
import { Ring } from "./parts";
import m from "./Manual.module.css";

type P = [number, number];
const S = 2.35;
const O: P = [138, 150];
/** Isometric projection: +x runs right-down, +y left-down, +z up. */
const iso = (x: number, y: number, z: number): P => [
  O[0] + (x - y) * 0.866 * S,
  O[1] + (x + y) * 0.5 * S - z * S,
];
const pts = (ps: P[]) => ps.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");

/** The three faces of a box a viewer sees: top, front (+y) and side (+x). */
function Box({
  x,
  y,
  z,
  w,
  d,
  h,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}) {
  const top = [
    iso(x, y, z + h),
    iso(x + w, y, z + h),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  ];
  const front = [
    iso(x, y + d, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  ];
  const side = [
    iso(x + w, y, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x + w, y, z + h),
  ];
  return (
    <g>
      <polygon points={pts(top)} className={m.faceTop} />
      <polygon points={pts(front)} className={m.faceFront} />
      <polygon points={pts(side)} className={m.faceSide} />
    </g>
  );
}

function Dowel({ y, z }: { y: number; z: number }) {
  const a = iso(2, y, z);
  const b = iso(6, y, z);
  return (
    <g className={m.dowel}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <ellipse cx={b[0]} cy={b[1]} rx="2.2" ry="1.4" />
    </g>
  );
}

export function ManualScene({ ring = true }: { ring?: boolean }) {
  const arrowFrom = iso(30, 15, 47);
  const arrowTo = iso(14, 15, 47);
  return (
    <div className={m.box} aria-hidden="true">
      <div className={m.page}>
        <div className={m.head}>
          <span className={m.stepWrap}>
            <span className={m.step}>4</span>
            {ring ? <Ring caption="Step 4: slide the shelf onto the pegs" /> : null}
          </span>
          <span className={m.parts}>
            <span className={m.part}>
              <svg viewBox="0 0 40 16">
                <rect x="4" y="5" width="32" height="6" rx="3" />
                <path d="M10 5v6M16 5v6M22 5v6M28 5v6" />
              </svg>
              <b>4x</b>
              <em>101350</em>
            </span>
            <span className={m.part}>
              <svg viewBox="0 0 40 16">
                <path d="M6 8h22" />
                <path d="M28 4h6v8h-6z" />
                <path d="M8 6l-2 2 2 2M12 6l-2 2 2 2M16 6l-2 2 2 2M20 6l-2 2 2 2M24 6l-2 2 2 2" />
              </svg>
              <b>4x</b>
              <em>118331</em>
            </span>
          </span>
        </div>

        <svg className={m.drawing} viewBox="0 0 300 220">
          <Box x={0} y={0} z={0} w={2} d={30} h={62} />
          <Box x={2} y={0} z={10} w={44} d={30} h={2} />
          <Dowel y={7} z={47} />
          <Dowel y={23} z={47} />
          <Box x={18} y={0} z={45} w={44} d={30} h={2} />
          <defs>
            <marker
              id="mh"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" className={m.markerHead} />
            </marker>
          </defs>
          <line
            className={m.arrow}
            x1={arrowFrom[0]}
            y1={arrowFrom[1] - 26}
            x2={arrowTo[0]}
            y2={arrowTo[1] - 26}
            markerEnd="url(#mh)"
          />
          <g className={m.detail}>
            <circle cx="248" cy="58" r="40" />
            <rect x="214" y="52" width="26" height="14" className={m.faceSide} />
            <rect x="240" y="48" width="30" height="22" className={m.faceTop} />
            <rect x="228" y="56" width="22" height="6" rx="3" className={m.pegBig} />
            <path d="M262 30l6-6M270 36l8-4M256 26l2-8" className={m.click} />
          </g>
          <line x1="196" y1="70" x2="209" y2="64" className={m.leader} />
        </svg>

        <div className={m.foot}>
          <span>Lindholm shelf, 4 tiers</span>
          <span>12</span>
        </div>
      </div>
    </div>
  );
}
