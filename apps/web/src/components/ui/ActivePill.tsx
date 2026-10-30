// "Tandrix active": the presence pill from the Mac, as the site's section labels. Same markup and
// styles as the real one (@tandrix/ui tx-presence), set in the page flow instead of the screen top.
import type { PresenceState } from "@tandrix/ui/web";
import styles from "./ActivePill.module.css";

const BARS = [0.55, 0.85, 1, 0.8, 0.5];

export function ActivePill({
  state,
  label,
  keys,
  hint,
  className,
}: {
  state: PresenceState;
  label: string;
  keys?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <span className={`tx-presence ${styles.pillHost} ${className ?? ""}`} data-state={state}>
      <span className="tx-presence-pill">
        {state === "listening" ? (
          <span className={`tx-presence-meter ${styles.meter}`} aria-hidden>
            {BARS.map((b, i) => (
              <span key={i} style={{ ["--tx-bar" as string]: b }} />
            ))}
          </span>
        ) : state === "thinking" || state === "looking" ? (
          <span className="tx-presence-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        ) : (
          <span className="tx-ctl-dot" aria-hidden />
        )}
        <span>{label}</span>
        {keys ? (
          <span className="tx-presence-keys">
            <kbd>{keys}</kbd>
            {hint ? <span>{hint}</span> : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}
