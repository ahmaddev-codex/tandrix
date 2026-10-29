"use client";
// Everything Tandrix does, as a map around it. The lines draw themselves the first time the map
// scrolls into view; on narrow screens it becomes grouped lists.
import { useEffect, useRef, useState } from "react";
import styles from "./CapabilityMap.module.css";

type Pt = [number, number];
interface Hub {
  name: string;
  at: Pt;
  leaves: Array<[string, Pt]>;
}

const W = 1200;
const H = 640;
const CENTER: Pt = [600, 310];

const hubs: Hub[] = [
  {
    name: "Sees what you see",
    at: [300, 130],
    leaves: [
      ["Your screen", [110, 60]],
      ["The camera", [100, 170]],
      ["Labels and nameplates", [330, 32]],
      ["Manuals and PDFs", [470, 205]],
    ],
  },
  {
    name: "Shows you the way",
    at: [910, 120],
    leaves: [
      ["Rings the control", [1090, 55]],
      ["Says the next step", [1095, 175]],
      ["Teach me, step by step", [760, 32]],
    ],
  },
  {
    name: "Does it for you",
    at: [1000, 330],
    leaves: [
      ["Opens your apps", [1120, 270]],
      ["Queues the next task", [1110, 395]],
    ],
  },
  {
    name: "Checks the work",
    at: [270, 420],
    leaves: [
      ["Photo checks", [90, 360]],
      ["Parts check", [110, 480]],
      ["Safety gates", [330, 560]],
    ],
  },
  {
    name: "Works where you are",
    at: [600, 520],
    leaves: [
      ["Mac", [500, 610]],
      ["iPhone", [610, 615]],
      ["Shared report", [720, 605]],
    ],
  },
  {
    name: "Keeps you in control",
    at: [880, 470],
    leaves: [
      ["Asks before it acts", [1050, 520]],
      ["Esc or the mouse to stop", [940, 590]],
      ["Wake word heard on the Mac", [800, 395]],
    ],
  },
];

const pct = ([x, y]: Pt) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });
/** Lines stop short of the labels so they don't run through the text. */
function trim(a: Pt, b: Pt, ra: number, rb: number): [Pt, Pt] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [
    [a[0] + (dx / len) * ra, a[1] + (dy / len) * ra],
    [b[0] - (dx / len) * rb, b[1] - (dy / len) * rb],
  ];
}

export function CapabilityMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  let n = 0;
  return (
    <>
      <div ref={ref} className={`${styles.map} ${shown ? styles.shown : ""}`} aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.lines}>
          {hubs.map((h) => {
            const [a, b] = trim(CENTER, h.at, 110, 40);
            return (
              <g key={h.name}>
                <line
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  className={styles.main}
                  style={{ ["--d" as string]: `${n++ * 60}ms` }}
                  pathLength={1}
                />
                {h.leaves.map(([name, at]) => {
                  const [c, d] = trim(h.at, at, 34, 26);
                  return (
                    <line
                      key={name}
                      x1={c[0]}
                      y1={c[1]}
                      x2={d[0]}
                      y2={d[1]}
                      className={styles.leaf}
                      style={{ ["--d" as string]: `${400 + n++ * 40}ms` }}
                      pathLength={1}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
        <span className={styles.center} style={pct(CENTER)}>
          <svg viewBox="0 0 24 24" width="40" height="40">
            <circle cx="7" cy="12" r="4.8" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <circle cx="12.5" cy="12" r="1.5" className={styles.spark} />
            <rect x="16.5" y="6.5" width="2.6" height="11" rx="1.3" fill="currentColor" />
          </svg>
          Tandrix
        </span>
        {hubs.map((h) => (
          <span key={h.name} className={styles.hub} style={pct(h.at)}>
            {h.name}
          </span>
        ))}
        {hubs.flatMap((h) =>
          h.leaves.map(([name, at]) => (
            <span key={name} className={styles.leafLabel} style={pct(at)}>
              {name}
            </span>
          )),
        )}
      </div>
      <div className={styles.list}>
        {hubs.map((h) => (
          <section key={h.name}>
            <h3>{h.name}</h3>
            <ul>
              {h.leaves.map(([name]) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
