"use client";
// The anatomy of Tandrix, as an exploded product view: the layers it puts over what you're doing,
// stacked in 3D, pulling apart the first time the view is on screen, each with its callout.
import { BrandMark } from "@tandrix/ui/web";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PointerArrow } from "@/components/scenes/Scenes";
import styles from "./Anatomy.module.css";

interface Layer {
  name: string;
  says: string;
  plate: ReactNode;
}

/** Bottom to top: what you're working on, then each thing Tandrix adds on top of it. */
const layers: Layer[] = [
  {
    name: "Your screen or your camera",
    says: "What Tandrix looks at: the app you're in, or the thing in front of you.",
    plate: <img src="/photos/budget-laptop.jpeg" alt="" className={styles.photo} />,
  },
  {
    name: "The ring",
    says: "Settles on the exact control or part, so you know where to look.",
    plate: <span className={styles.ring} />,
  },
  {
    name: "The pointer and the step",
    says: "Points at it and shows the next step in a few words.",
    plate: (
      <span className={styles.pointer}>
        <PointerArrow size={34} />
        <span className={styles.caption}>Click Insert, then PivotTable</span>
      </span>
    ),
  },
  {
    name: "The voice",
    says: "Says the step out loud, so your eyes can stay on the work.",
    plate: (
      <span className={styles.wave}>
        {Array.from({ length: 22 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 11) * 80}ms` }} />
        ))}
      </span>
    ),
  },
  {
    name: "The check",
    says: "Looks again when you're done and only moves on when it's right.",
    plate: (
      <span className={styles.check}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Verified
      </span>
    ),
  },
  {
    name: "Tandrix is active",
    says: "The pill at the top of your screen: listening, thinking or in control. Esc stops it.",
    plate: (
      <span className={styles.pill}>
        <BrandMark size={22} />
        Listening <kbd>⌥⌘</kbd>
      </span>
    ),
  },
];

export function Anatomy() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setOpen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Callouts read top to bottom, matching the stack.
  const top = [...layers].reverse();
  return (
    <div ref={ref} className={`${styles.wrap} ${open ? styles.open : ""}`}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.stack}>
          {layers.map((l, i) => (
            <div key={l.name} className={styles.plate} style={{ "--i": i } as CSSProperties}>
              {l.plate}
              <span className={styles.badge}>{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </div>
      <ol className={styles.callouts}>
        {top.map((l, i) => (
          <li key={l.name} style={{ "--i": i } as CSSProperties}>
            <span className={styles.num}>{String(layers.length - i).padStart(2, "0")}</span>
            <span>
              <b>{l.name}</b>
              <span className={styles.says}>{l.says}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
