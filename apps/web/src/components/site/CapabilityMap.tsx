"use client";
// Everything Tandrix does, around it: six groups in two columns, joined to the mark by curves
// measured from the real layout (so they meet each card exactly at any size). The curves draw in
// the first time the map is on screen, then a pulse runs along each one.
import { BrandMark, Icon, type IconProps } from "@tandrix/ui/web";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./CapabilityMap.module.css";

interface Group {
  name: string;
  icon: IconProps["name"];
  items: string[];
}

const left: Group[] = [
  {
    name: "Sees what you see",
    icon: "camera",
    items: ["Your screen", "The camera", "Labels and nameplates", "Manuals and PDFs"],
  },
  {
    name: "Shows you the way",
    icon: "pointer",
    items: ["Rings the control", "Says the next step", "Teach me, one step at a time"],
  },
  {
    name: "Checks the work",
    icon: "check",
    items: ["Photo checks", "Parts check", "Safety gates"],
  },
];
const right: Group[] = [
  {
    name: "Does it for you",
    icon: "laptop",
    items: ["Opens your apps", "Takes the steps", "Queues the next task"],
  },
  {
    name: "Keeps you in control",
    icon: "hand",
    items: [
      "Asks before it sends or pays",
      "Esc or the mouse stops it",
      "Wake word stays on the Mac",
    ],
  },
  {
    name: "Works where you are",
    icon: "phone",
    items: ["Mac", "iPhone", "A shared report"],
  },
];

function Card({ g, side }: { g: Group; side: "l" | "r" }) {
  return (
    <article className={styles.card} data-side={side}>
      <header>
        <span className={styles.icon}>
          <Icon name={g.icon} size={20} />
        </span>
        <h3>{g.name}</h3>
      </header>
      <ul>
        {g.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </article>
  );
}

export function CapabilityMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shown, setShown] = useState(false);

  // Curves from the mark to the inner edge of each card, from where they really are.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const core = el.querySelector(`.${styles.core}`)?.getBoundingClientRect();
      if (!core) return;
      const cx = core.left + core.width / 2 - box.left;
      const cy = core.top + core.height / 2 - box.top;
      const next: string[] = [];
      el.querySelectorAll<HTMLElement>(`.${styles.card}`).forEach((card) => {
        const r = card.getBoundingClientRect();
        const leftSide = card.dataset.side === "l";
        const x = (leftSide ? r.right : r.left) - box.left;
        const y = r.top + r.height / 2 - box.top;
        const sx = cx + (leftSide ? -1 : 1) * (core.width / 2 - 6);
        const mx = (sx + x) / 2;
        next.push(`M ${sx} ${cy} C ${mx} ${cy}, ${mx} ${y}, ${x} ${y}`);
      });
      setPaths(next);
      setSize({ w: box.width, h: box.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={`${styles.map} ${shown ? styles.shown : ""}`}>
      <svg
        className={styles.lines}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        aria-hidden="true"
      >
        {paths.map((d, i) => (
          <g key={i} style={{ "--i": i } as CSSProperties}>
            <path d={d} pathLength={1} className={styles.curve} />
            <circle r="4" className={styles.pulse} style={{ offsetPath: `path("${d}")` }} />
          </g>
        ))}
      </svg>
      <div className={styles.col}>
        {left.map((g) => (
          <Card key={g.name} g={g} side="l" />
        ))}
      </div>
      <div className={styles.center}>
        <div className={styles.core}>
          <span className={styles.orbit} aria-hidden="true" />
          <span className={`${styles.orbit} ${styles.orbit2}`} aria-hidden="true" />
          <BrandMark size={72} />
        </div>
        <p className={styles.name}>Tandrix</p>
        <p className={styles.tag}>One assistant, everything it takes to get it done.</p>
      </div>
      <div className={styles.col}>
        {right.map((g) => (
          <Card key={g.name} g={g} side="r" />
        ))}
      </div>
    </div>
  );
}
