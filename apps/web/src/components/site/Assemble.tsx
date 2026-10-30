"use client";
// Build it: a small computer kit comes together as you scroll. Each part waits above its place,
// its landing outline lights in blue, then it drops onto the one below and is checked off, the way
// Tandrix checks a real build from a photo. The parts are drawn on the server; this only moves them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { translateAlong } from "../iso/iso-kit";
import { HEIGHT, P, PARTS, WIDTH } from "../figures/kit/view";
import "../iso/iso.css";
import { HearIt } from "./HearIt";
import styles from "./Assemble.module.css";

/** When each part starts dropping, in scroll progress. */
const parts = PARTS.map((part, i) => ({ ...part, at: i === 0 ? -1 : 0.04 + (i - 1) * 0.2 }));
const DROP = 0.14;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function Assemble({ layers, ghosts }: { layers: ReactNode[]; ghosts: ReactNode[] }) {
  const section = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setP(1);
    const el = section.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / Math.max(1, r.height - innerHeight)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const landed = parts.filter((x) => p >= x.at + DROP).length;
  return (
    <div ref={section} className={styles.section}>
      <div className={styles.sticky}>
        <div className={`iso ${styles.stage}`} aria-hidden="true">
          <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
            {parts.map((x, i) => {
              // 1 while waiting above, 0 once landed.
              const lift = 1 - clamp((p - x.at) / DROP);
              const now = lift > 0 && p >= x.at - 0.08;
              return (
                <g key={x.name}>
                  <g style={{ opacity: now ? 1 : 0, transition: "opacity 240ms ease" }}>{ghosts[i]}</g>
                  <g transform={translateAlong(P, [0, 0, lift * x.apart])}>{layers[i]}</g>
                </g>
              );
            })}
          </svg>
          {landed === parts.length ? <span className={styles.done}>Verified</span> : null}
        </div>
        <div className={styles.side}>
          <p className={styles.kicker}>
            Step {Math.min(landed + 1, parts.length)} of {parts.length}
          </p>
          <ol className={styles.list}>
            {parts.map((x) => {
              const ok = p >= x.at + DROP;
              const now = !ok && p >= x.at;
              return (
                <li key={x.name} className={ok ? styles.ok : now ? styles.now : undefined}>
                  <span className={styles.tick} aria-hidden="true">
                    {ok ? (
                      <svg viewBox="0 0 16 16" width="14" height="14">
                        <path
                          d="M3.5 8.4l2.8 2.8 6.2-6.4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  {x.name}
                  <span className={styles.state}>{ok ? "Checked" : now ? "Fitting" : ""}</span>
                </li>
              );
            })}
          </ol>
          <div className={styles.bar}>
            <i style={{ width: `${(landed / parts.length) * 100}%` }} />
          </div>
          <HearIt line="seated" label="Hear a check" tone="light" />
        </div>
      </div>
    </div>
  );
}
