// The site's buttons: pills, with the arrow in its own disc on the ones that lead somewhere.
import type { ReactNode } from "react";
import styles from "./Cta.module.css";

export function ArrowUpRight({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M5 11L11 5M6 5h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Cta({
  href,
  children,
  tone = "ink",
  arrow = true,
  block = false,
  external = false,
}: {
  href: string;
  children: ReactNode;
  /** ink or blue on white, light for the second action, white or glass on the sky. */
  tone?: "ink" | "light" | "blue" | "white" | "glass" | "outline";
  arrow?: boolean;
  block?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={`${styles.cta} ${styles[`cta-${tone}`]} ${arrow ? styles.ctaArrowed : ""} ${block ? styles.ctaBlock : ""}`}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{children}</span>
      {arrow ? (
        <span className={styles.ctaDisc}>
          <ArrowUpRight />
        </span>
      ) : null}
    </a>
  );
}
