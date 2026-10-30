"use client";
// A day with Tandrix: the moments scroll by on the left while the picture beside them changes to
// match: earlier moments slide back into a stack, as on the reference. On narrow screens each
// moment shows its own picture inline.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./DayTimeline.module.css";

export interface Moment {
  time: string;
  tag: string;
  title: string;
  body: ReactNode;
  /** What the user said to start it. */
  ask: string;
  scene: ReactNode;
}

export function DayTimeline({ moments }: { moments: Moment[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.wrap}>
      <ol className={styles.rail} aria-hidden="true">
        {moments.map((m, i) => (
          <li key={m.time} className={i === active ? styles.railOn : undefined}>
            {m.time}
          </li>
        ))}
      </ol>
      <div className={styles.steps}>
        {moments.map((m, i) => (
          <article
            key={m.time}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className={`${styles.step} ${i === active ? styles.stepOn : ""}`}
          >
            <span className={styles.tag}>{m.tag}</span>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
            <div className={styles.inline}>
              <Stage moment={m} />
            </div>
          </article>
        ))}
      </div>
      <div className={styles.sticky}>
        {/* Earlier moments recede into a stack behind the current one; the next rises in. */}
        {moments.map((m, i) => (
          <div
            key={m.time}
            className={`${styles.layer} ${i === active ? styles.layerOn : ""}`}
            style={{ "--d": i - active, zIndex: 10 - Math.abs(i - active) } as CSSProperties}
            aria-hidden={i !== active || undefined}
          >
            <Stage moment={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage({ moment }: { moment: Moment }) {
  return (
    <div className={styles.stage}>
      <div className={styles.sky}>
        <p className={styles.ask}>
          <span className={styles.askDot} />“{moment.ask}”
        </p>
        <div className={styles.scene}>{moment.scene}</div>
      </div>
    </div>
  );
}
