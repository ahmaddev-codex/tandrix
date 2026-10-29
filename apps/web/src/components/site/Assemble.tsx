"use client";
// The robot kit assembling as you scroll: the manual's exploded diagram is cut into bands that slide
// together, and each part is checked off as it lands, the way Tandrix checks a build step by step.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HearIt } from "./HearIt";
import styles from "./Assemble.module.css";

/** The diagram, and the part of it shown, in its own pixels. */
const IMG = { src: "/photos/robot-manual.jpeg", w: 735, h: 563 };
const CROP = { x: 150, w: 505 };

/**
 * Bands of the diagram, top to bottom, with how far each moves to sit on the chassis (fraction of
 * the picture's height) and when it lands (in scroll progress).
 */
const bands = [
  { from: 0, to: 138, move: 0.17, at: 0.7, name: "Top cover" },
  { from: 138, to: 228, move: 0.11, at: 0.5, name: "Main control board" },
  { from: 228, to: 304, move: 0.05, at: 0.3, name: "Clear plate" },
  { from: 304, to: 470, move: 0, at: 0.1, name: "Chassis and wheels" },
  { from: 470, to: 563, move: -0.07, at: 0.88, name: "Sensors and motors" },
];
const order = [...bands].sort((a, b) => a.at - b.at);
const SPAN = 0.16;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function Assemble() {
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

  const landed = order.filter((b) => p >= b.at + SPAN).length;
  return (
    <div ref={section} className={styles.section}>
      <div className={styles.sticky}>
        <div
          className={styles.diagram}
          style={{ aspectRatio: `${CROP.w} / ${IMG.h}` }}
          aria-hidden="true"
        >
          {bands.map((b) => {
            const t = clamp((p - b.at) / SPAN);
            return (
              <div
                key={b.name}
                className={`${styles.band} ${t >= 1 ? styles.bandIn : ""}`}
                style={
                  {
                    clipPath: `inset(${Math.max(0, (b.from - 1) / IMG.h) * 100}% 0 ${Math.max(0, 100 - ((b.to + 1) / IMG.h) * 100)}% 0)`,
                    transform: `translateY(${b.move * t * 100}%)`,
                  } as CSSProperties
                }
              >
                <img
                  src={IMG.src}
                  alt=""
                  style={{
                    width: `${(IMG.w / CROP.w) * 100}%`,
                    left: `${(-CROP.x / CROP.w) * 100}%`,
                  }}
                />
              </div>
            );
          })}
          {landed === bands.length ? <span className={styles.done}>Verified</span> : null}
        </div>
        <div className={styles.side}>
          <p className={styles.kicker}>
            Step {Math.min(landed + 1, bands.length)} of {bands.length}
          </p>
          <ol className={styles.list}>
            {order.map((b) => {
              const ok = p >= b.at + SPAN;
              const now = !ok && p >= b.at - 0.02;
              return (
                <li key={b.name} className={ok ? styles.ok : now ? styles.now : undefined}>
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
                  {b.name}
                  <span className={styles.state}>{ok ? "Checked" : now ? "Fitting" : ""}</span>
                </li>
              );
            })}
          </ol>
          <div className={styles.bar}>
            <i style={{ width: `${(landed / bands.length) * 100}%` }} />
          </div>
          <HearIt line="sensor" label="Hear a step" tone="light" />
        </div>
      </div>
    </div>
  );
}
