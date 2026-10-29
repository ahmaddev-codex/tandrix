// Pieces every scene shares: a Mac window that scales as one picture, and Tandrix's ring, pointer
// and caption, attached to whatever control they sit in.
import type { ReactNode } from "react";
import p from "./parts.module.css";

/** The Tandrix pointer, the same rounded shape the Mac overlay draws. */
export function PointerArrow({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z" />
    </svg>
  );
}

/**
 * A Mac window. Everything inside is sized in em and the window sets its font size from its own
 * width, so the whole picture scales as one at any size.
 */
export function Win({
  title,
  app,
  children,
  className,
}: {
  title: string;
  app?: "excel" | "settings" | "calendar";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${p.box} ${className ?? ""}`} aria-hidden="true">
      <div className={`${p.win} ${app ? p[app] : ""}`}>
        <div className={p.bar}>
          <span className={p.lights}>
            <i />
            <i />
            <i />
          </span>
          <span className={p.title}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Tandrix's ring around its parent control, with the pointer and the spoken step under it. */
export function Ring({
  caption,
  place = "below",
}: {
  caption: string;
  /** Where the spoken step sits: under the control, to its right, or under it aligned right. */
  place?: "below" | "right" | "belowEnd";
}) {
  return (
    <span className={p.ring}>
      <PointerArrow className={p.arrow} />
      <span className={`${p.caption} ${p[place]}`}>{caption}</span>
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
