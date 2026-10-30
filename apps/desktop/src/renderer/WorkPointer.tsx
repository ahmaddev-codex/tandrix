// Tandrix's pointer doing the work: it glides from step to step, ripples where it clicks, and
// says what it's doing beside it, so you can watch the task happen.
import type { OverlayPointer } from "../shared/bridge";

const ARROW =
  "M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z";

export function WorkPointer({ p }: { p: OverlayPointer }) {
  const w = p.working!;
  return (
    <div className="work-ptr" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
      {w.act === "click" ? <span key={w.seq} className="work-ripple" /> : null}
      <svg className="work-arrow" viewBox="0 0 24 24" width={30} height={30} aria-hidden="true">
        <path d={ARROW} />
      </svg>
      {p.caption ? (
        <span key={`c${w.seq}`} className={`work-caption work-${w.act}`}>
          {w.act === "type" || w.act === "keys" ? <span className="work-keys" /> : null}
          {p.caption}
        </span>
      ) : null}
    </div>
  );
}
