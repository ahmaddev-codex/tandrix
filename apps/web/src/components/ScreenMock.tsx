// A Mac app window drawn with plain shapes (an image editor's canvas and layers panel), with
// Tandrix's real pointer on the control it's explaining.
import { PointerBuddy } from "@tandrix/ui/web";
import styles from "./ScreenMock.module.css";

export function ScreenMock({ caption = "Click Add layer mask" }: { caption?: string }) {
  return (
    <figure className={styles.window} aria-label="Tandrix pointing at a button in an image editor">
      <div className={styles.bar} aria-hidden>
        <span />
        <span />
        <span />
        <em>Image editor</em>
      </div>
      <div className={styles.body} aria-hidden>
        <div className={styles.panel}>
          <p>Layers</p>
          {["Sky", "Mountains", "Background"].map((l, i) => (
            <div key={l} className={i === 1 ? `${styles.layer} ${styles.selected}` : styles.layer}>
              <span className={styles.thumb} />
              {l}
            </div>
          ))}
          <div className={styles.tools}>
            <span />
            <span />
            <span className={styles.target}>
              {/* Add layer mask: the pointer sits on it, its caption over the canvas. */}
              <PointerBuddy x="55%" y="55%" caption={caption} />
            </span>
            <span />
          </div>
        </div>
        <div className={styles.canvas}>
          <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
            <rect width="320" height="200" fill="var(--gray-200)" />
            <circle cx="236" cy="56" r="22" fill="var(--gray-100)" />
            <path
              d="M0 160 L80 92 L140 140 L200 80 L320 168 L320 200 L0 200 Z"
              fill="var(--gray-400)"
            />
            <path
              d="M0 178 L110 128 L190 172 L250 140 L320 186 L320 200 L0 200 Z"
              fill="var(--gray-600)"
            />
          </svg>
        </div>
      </div>
    </figure>
  );
}
