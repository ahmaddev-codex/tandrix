// A real photo, cropped, with Tandrix's ring on the exact control and the step it says. Every
// position is in the photo's own pixels, so the ring lands where the control really is at any size.
import type { CSSProperties } from "react";
import { Ring } from "./parts";
import { cn } from "@/lib/cn";

type Rect = { x: number; y: number; w: number; h: number };

export interface PhotoSpec {
  src: string;
  /** The photo's pixel size. */
  w: number;
  h: number;
  /** The part of the photo to show (defaults to all of it). */
  crop?: Rect;
  ring?: Rect & { caption: string; place?: "below" | "right" | "belowEnd" };
  /** Parts Tandrix outlined, with their names. */
  boxes?: Array<Rect & { label?: string }>;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function Photo({ spec, className }: { spec: PhotoSpec; className?: string }) {
  const c = spec.crop ?? { x: 0, y: 0, w: spec.w, h: spec.h };
  const at = (r: Rect): CSSProperties => ({
    left: pct(r.x - c.x, c.w),
    top: pct(r.y - c.y, c.h),
    width: pct(r.w, c.w),
    height: pct(r.h, c.h),
  });
  return (
    <div
      // The ring and its caption scale with the picture, within reason.
      className={cn(
        "@container relative w-full overflow-hidden text-[clamp(9px,2.4cqw,15px)] select-none",
        className,
      )}
      style={{ aspectRatio: `${c.w} / ${c.h}` }}
      aria-hidden="true"
    >
      <img
        src={spec.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute block h-auto max-w-none"
        style={{
          width: pct(spec.w, c.w),
          left: pct(-c.x, c.w),
          top: pct(-c.y, c.h),
        }}
      />
      {spec.boxes?.map((b, i) => (
        <span
          key={i}
          style={{ ...at(b), animationDelay: `${i * 120}ms` }}
          className="absolute rounded-[0.5em] border-[0.16em] border-highlight bg-[color-mix(in_srgb,var(--highlight)_12%,transparent)] shadow-[0_0_0_0.06em_rgba(255,255,255,0.8)] motion-safe:animate-outline-in"
        >
          {b.label ? (
            <em className="absolute bottom-[calc(100%+0.3em)] -left-[0.16em] rounded-[0.45em] bg-highlight px-[0.55em] py-[0.2em] text-[0.85em] font-semibold whitespace-nowrap text-white not-italic">
              {b.label}
            </em>
          ) : null}
        </span>
      ))}
      {spec.ring ? (
        <span className="absolute" style={at(spec.ring)}>
          <Ring
            caption={spec.ring.caption}
            {...(spec.ring.place ? { place: spec.ring.place } : {})}
          />
        </span>
      ) : null}
    </div>
  );
}
