// The hero's ring of cards, seen from inside: the far side faces you and slowly turns. Pure CSS,
// so it starts with the page; it holds still for people who ask for less motion.
import type { CSSProperties, ReactNode } from "react";
import styles from "./Carousel3D.module.css";

export function Carousel3D({ items }: { items: ReactNode[] }) {
  const step = 360 / items.length;
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.ring}>
        {items.map((node, i) => (
          <div key={i} className={styles.card} style={{ "--a": `${i * step}deg` } as CSSProperties}>
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}
