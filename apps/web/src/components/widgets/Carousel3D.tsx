// The hero's ring of cards, seen from outside: the front half faces you and slowly turns; the back
// half is hidden. Pure CSS, so it starts with the page; it holds still for less motion.
import type { CSSProperties, ReactNode } from "react";

export function Carousel3D({ items }: { items: ReactNode[] }) {
  const step = 360 / items.length;
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mt-[clamp(8px,2vh,24px)] mb-auto h-[calc(var(--size)*1.6)] w-[min(100%,1100px)] flex-none [--r:64vw] [--size:27vw] [perspective-origin:50%_20%] [perspective:2600px] sm:[--r:clamp(260px,30vw,470px)] sm:[--size:clamp(112px,min(13vw,19vh),196px)]"
    >
      <div className="absolute top-[40%] left-1/2 size-0 transform-3d [transform:rotateX(-9deg)_rotateY(0deg)] will-change-transform motion-safe:animate-ring">
        {items.map((node, i) => (
          <div
            key={i}
            style={{ "--a": `${i * step}deg` } as CSSProperties}
            // Each card on its own layer, so the turn stays smooth while clips play.
            className="absolute top-[calc(var(--size)/-2)] left-[calc(var(--size)/-2)] size-(--size) overflow-hidden rounded-[20px] bg-white [contain:layout_paint] shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)] backface-hidden will-change-transform [transform:rotateY(var(--a))_translateZ(var(--r))]"
          >
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}
