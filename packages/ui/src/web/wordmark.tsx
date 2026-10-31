"use client";
import { useId, type AnchorHTMLAttributes } from "react";
import { cx } from "./cx";

export interface BrandWordmarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  size?: "sm" | "md" | "lg";
  /** Optional link href. Defaults to "#top" when clickable. */
  href?: string;
  /** Whether to show the mark (the pointer in its active ring) beside the name. Defaults to true. */
  showGlyph?: boolean;
  className?: string;
}

/** The Tandrix pointer, as the Mac overlay draws it (24-unit grid). */
const POINTER =
  "M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z";

/**
 * The Tandrix mark: the pointer on a dark tile, ringed with the blue border Tandrix wears while
 * it's active (the presence pill's ring).
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx("tx-wordmark-glyph", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-ring`}
          x1="2"
          y1="2"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" className="tx-mark-ring-a" />
          <stop offset="0.5" className="tx-mark-ring-b" />
          <stop offset="1" className="tx-mark-ring-a" />
        </linearGradient>
      </defs>
      <rect x="1.75" y="1.75" width="28.5" height="28.5" rx="9" className="tx-mark-tile" />
      <rect
        x="1.75"
        y="1.75"
        width="28.5"
        height="28.5"
        rx="9"
        stroke={`url(#${id}-ring)`}
        strokeWidth="2.5"
      />
      <path d={POINTER} transform="translate(6.4 6.4) scale(0.82)" className="tx-mark-pointer" />
    </svg>
  );
}

/** The Tandrix wordmark: the mark beside the name. */
export function BrandWordmark({
  size = "md",
  href = "#top",
  showGlyph = true,
  className,
  ...rest
}: BrandWordmarkProps) {
  const glyphSize = size === "sm" ? 20 : size === "lg" ? 30 : 24;

  const content = (
    <span className={cx("tx-wordmark", `tx-wordmark-${size}`, className)}>
      {showGlyph ? <BrandMark size={glyphSize} /> : null}
      <span className="tx-wordmark-text">Tandrix</span>
    </span>
  );

  if (href) {
    return (
      <a href={href} className="tx-wordmark-link" aria-label="Tandrix Home" {...rest}>
        {content}
      </a>
    );
  }

  return (
    <span role="img" aria-label="Tandrix" {...rest}>
      {content}
    </span>
  );
}
