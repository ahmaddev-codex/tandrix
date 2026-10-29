"use client";
// Try it: over this real spreadsheet your cursor becomes the Tandrix pointer, and the ring settles
// on whichever control you're near, saying what it is. Without a pointer (touch), it tours the
// controls by itself.
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { HearIt } from "./HearIt";
import styles from "./TryIt.module.css";

/** The photo and the part of it shown, in its own pixels. */
const IMG = { src: "/photos/budget-laptop.jpeg", w: 736, h: 1308 };
const CROP = { x: 44, y: 378, w: 530, h: 440 };

/** Controls on the screen, in the photo's pixels, with what Tandrix says about each. */
const spots = [
  { x: 76, y: 447, w: 30, h: 16, say: "Insert. Tables, charts and PivotTables live here." },
  { x: 80, y: 516, w: 88, h: 22, say: "Your budget table. Totals update as you type." },
  { x: 278, y: 500, w: 134, h: 128, say: "A chart of the budget. Click a bar to edit its data." },
  { x: 412, y: 480, w: 120, h: 112, say: "This one compares months. Double-click to change it." },
  { x: 294, y: 616, w: 126, h: 118, say: "The trend over the year, from the same table." },
];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function TryIt() {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);

  // No pointer over it: tour the controls, slowly.
  useEffect(() => {
    if (hovering || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % spots.length), 2600);
    return () => clearInterval(t);
  }, [hovering]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = box.current!.getBoundingClientRect();
    const x = CROP.x + ((e.clientX - r.left) / r.width) * CROP.w;
    const y = CROP.y + ((e.clientY - r.top) / r.height) * CROP.h;
    let best = active;
    let bestD = Infinity;
    spots.forEach((s, i) => {
      const dx = Math.max(s.x - x, 0, x - (s.x + s.w));
      const dy = Math.max(s.y - y, 0, y - (s.y + s.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) [best, bestD] = [i, d];
    });
    if (best !== active) setActive(best);
  };

  const s = spots[active]!;
  return (
    <div className={styles.wrap}>
      <div
        ref={box}
        className={styles.screen}
        style={{ aspectRatio: `${CROP.w} / ${CROP.h}` }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerMove={move}
        aria-hidden="true"
      >
        <img
          src={IMG.src}
          alt=""
          className={styles.img}
          style={{
            width: pct(IMG.w, CROP.w),
            left: pct(-CROP.x, CROP.w),
            top: pct(-CROP.y, CROP.h),
          }}
        />
        <span
          className={styles.ring}
          style={{
            left: pct(s.x - CROP.x, CROP.w),
            top: pct(s.y - CROP.y, CROP.h),
            width: pct(s.w, CROP.w),
            height: pct(s.h, CROP.h),
          }}
        >
          {/* On the right half, the caption hangs from the ring's right edge, inside the screen. */}
          <span
            key={active}
            className={`${styles.say} ${s.x - CROP.x > CROP.w / 2 ? styles.sayRight : ""}`}
          >
            {s.say}
          </span>
        </span>
      </div>
      <div className={styles.side}>
        <p className={styles.hint}>
          <span className={styles.mouse} aria-hidden="true" />
          Move your pointer over the screen. Tandrix shows you what each thing is.
        </p>
        <HearIt line="pivot" label="Hear it say a step" tone="light" />
      </div>
    </div>
  );
}
