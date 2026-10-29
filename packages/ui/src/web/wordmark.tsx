"use client";
import type { AnchorHTMLAttributes } from "react";
import { cx } from "./cx";

export interface BrandWordmarkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  size?: "sm" | "md" | "lg";
  /** Optional link href. Defaults to "#top" when clickable. */
  href?: string;
  /** Whether to show the subtle binary brand mark alongside the wordmark text. Defaults to true. */
  showGlyph?: boolean;
  className?: string;
}

/**
 * The official Tandrix binary-inspired wordmark.
 * Combines a minimalist binary mark (the '0' ring of holistic vision + '1' pulse of execution)
 * with the refined Tandrix typographic brand.
 */
export function BrandWordmark({
  size = "md",
  href = "#top",
  showGlyph = true,
  className,
  ...rest
}: BrandWordmarkProps) {
  const glyphSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  const content = (
    <span className={cx("tx-wordmark", `tx-wordmark-${size}`, className)}>
      {showGlyph ? (
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="tx-wordmark-glyph"
          aria-hidden="true"
        >
          {/* Binary '0' ring: represents the Tandrix scanning ring and holistic understanding */}
          <circle
            cx="7"
            cy="12"
            r="4.8"
            stroke="currentColor"
            strokeWidth="2.2"
            className="tx-wordmark-ring"
          />
          {/* Binary spark link: digital-to-physical connection */}
          <circle
            cx="12.5"
            cy="12"
            r="1.2"
            fill="var(--highlight, #0066ff)"
            className="tx-wordmark-spark"
          />
          {/* Binary '1' pulse: represents purposeful execution and verified outcome */}
          <rect
            x="16.5"
            y="6.5"
            width="2.5"
            height="11"
            rx="1.25"
            fill="currentColor"
            className="tx-wordmark-bar"
          />
        </svg>
      ) : null}
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

