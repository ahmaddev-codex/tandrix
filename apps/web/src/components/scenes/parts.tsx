// Pieces the scenes share: Tandrix's pointer, its ring with the spoken step, and a check mark.
import { cn } from "@/lib/cn";

/** The Tandrix pointer, the same rounded shape the Mac overlay draws. */
export function PointerArrow({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z" />
    </svg>
  );
}

/**
 * Tandrix's ring around its parent control (which is position: relative), with the pointer and
 * the spoken step under it. Sized in em, so it scales with the picture it's in.
 */
export function Ring({
  caption,
  place = "below",
}: {
  caption: string;
  /** Where the spoken step sits: under the control, to its right, or under it aligned right. */
  place?: "below" | "right" | "belowEnd";
}) {
  return (
    <span className="pointer-events-none absolute -inset-[0.35em] z-[5] rounded-[0.7em] border-[0.16em] border-highlight shadow-[0_0_0_0.3em_var(--highlight-tint),0_0_1.4em_0.1em_color-mix(in_srgb,var(--highlight)_35%,transparent)] motion-safe:animate-ring-pulse">
      <PointerArrow className="absolute -right-[1.1em] -bottom-[1.3em] size-[2em] fill-[#111] stroke-white stroke-[1.5] drop-shadow-[0_0.15em_0.25em_rgba(0,0,0,0.35)]" />
      <span
        className={cn(
          "absolute top-[calc(100%+1.2em)] left-0 rounded-[0.7em] bg-[#111] px-[0.85em] py-[0.55em] text-[1em] font-medium whitespace-nowrap text-white shadow-[0_0_0_0.12em_var(--highlight),0_0.4em_1em_-0.5em_rgba(0,0,0,0.25)]",
          place === "right" && "top-1/2 left-[calc(100%+1.6em)]",
          place === "belowEnd" && "right-0 left-auto",
        )}
      >
        {caption}
      </span>
    </span>
  );
}

/** A small check mark. */
export function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <path
        d="M3.5 8.4l2.8 2.8 6.2-6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
