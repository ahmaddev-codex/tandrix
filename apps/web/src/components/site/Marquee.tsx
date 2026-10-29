// Things people ask Tandrix, drifting past under the hero. The list is doubled so the loop is
// seamless; the copy is hidden from screen readers.
import styles from "./Marquee.module.css";

export function Marquee({ items }: { items: string[] }) {
  return (
    <div className={styles.viewport}>
      <div className={styles.track}>
        {[false, true].map((copy) => (
          <ul key={String(copy)} className={styles.row} aria-hidden={copy || undefined}>
            {items.map((q) => (
              <li key={q}>
                <span className={styles.dot} aria-hidden="true" />“{q}”
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
