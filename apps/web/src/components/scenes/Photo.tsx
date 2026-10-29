// A real photo, cropped, with Tandrix's ring on the exact control and the step it says. Every
// position is in the photo's own pixels, so the ring lands where the control really is at any size.
import type { CSSProperties } from "react";
import { Ring } from "./parts";
import p from "./Photo.module.css";

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
  /** Patches over private details in a macOS screenshot (its #f7f7f7 grey), with neutral text. */
  patches?: Array<Rect & { text?: string; size?: number }>;
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
      className={`${p.box} ${className ?? ""}`}
      style={{ aspectRatio: `${c.w} / ${c.h}` }}
      aria-hidden="true"
    >
      <img
        src={spec.src}
        alt=""
        loading="lazy"
        decoding="async"
        className={p.img}
        style={{
          width: pct(spec.w, c.w),
          left: pct(-c.x, c.w),
          top: pct(-c.y, c.h),
        }}
      />
      {spec.patches?.map((pa, i) => (
        <span
          key={i}
          className={p.patch}
          style={{
            ...at(pa),
            fontSize: pa.size ? `${(pa.size / c.w) * 100}cqw` : undefined,
          }}
        >
          {pa.text}
        </span>
      ))}
      {spec.boxes?.map((b, i) => (
        <span key={i} className={p.part} style={at(b)}>
          {b.label ? <em>{b.label}</em> : null}
        </span>
      ))}
      {spec.ring ? (
        <span className={p.target} style={at(spec.ring)}>
          <Ring
            caption={spec.ring.caption}
            {...(spec.ring.place ? { place: spec.ring.place } : {})}
          />
        </span>
      ) : null}
    </div>
  );
}
