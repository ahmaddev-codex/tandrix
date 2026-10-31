// "Tandrix active": the presence pill from the Mac, as the site's section labels. Same markup and
// styles as the real one (@tandrix/ui tx-presence), set in the page flow instead of the screen top.
import type { PresenceState } from "@tandrix/ui/web";
import { cn } from "@/lib/cn";

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
    <span
      data-state={state}
      className={cn(
        "tx-presence pointer-events-auto relative inset-auto inline-flex [--tx-level:0.6] [&_.tx-presence-pill]:h-9 [&_.tx-presence-pill]:text-[13px]",
        state === "listening" &&
          "motion-safe:[&_.tx-presence-pill]:before:animate-[tx-presence-turn_3.2s_linear_infinite]",
        className,
      )}
    >
      <span className="tx-presence-pill">
        {state === "listening" ? (
          <span className="tx-presence-meter" aria-hidden>
            {BARS.map((b, i) => (
              <span
                key={i}
                className="h-[calc(4px+12px*var(--tx-bar))] motion-safe:animate-meter"
                style={{ ["--tx-bar" as string]: b, animationDelay: `${i * 0.12}s` }}
              />
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
