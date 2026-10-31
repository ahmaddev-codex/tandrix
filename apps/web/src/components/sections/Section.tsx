// The homepage's building blocks: a section (plain, edge-to-edge or a grey band), its heading, and
// the grey tray of white cards several sections share.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** What the presence pill says while this section is the one being read. */
export interface Presence {
  state: "looking" | "answering" | "doing" | "thinking" | "listening";
  label: string;
}

interface SectionProps extends Omit<ComponentProps<"section">, "id"> {
  id?: string;
  /** The heading's id, for aria-labelledby. */
  labelledBy: string;
  presence?: Presence;
  /** A grey band, framed in from the page edge. */
  band?: boolean;
  /** Runs to the right edge (for rows that scroll sideways). */
  wide?: boolean;
}

export function Section({
  labelledBy,
  presence,
  band,
  wide,
  className,
  children,
  ...rest
}: SectionProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      data-presence-state={presence?.state}
      data-presence-label={presence?.label}
      className={cn(
        band
          ? "mx-frame mt-gap rounded-[28px] bg-mist px-gutter py-band [&>:last-child]:mx-auto [&>:last-child]:max-w-[1240px]"
          : "mx-auto mt-gap max-w-[1340px] px-gutter",
        wide && "max-w-none pr-0",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

interface SectionHeadProps {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "start";
  className?: string;
  children?: ReactNode;
}

/** A section's heading, its lead line and anything under them (a button). Fades in on scroll. */
export function SectionHead({
  id,
  title,
  lead,
  align = "center",
  className,
  children,
}: SectionHeadProps) {
  return (
    <div
      data-reveal
      className={cn(
        "mb-head grid scroll-mt-[72px] gap-[22px]",
        align === "center"
          ? "mx-auto max-w-[780px] justify-items-center text-center"
          : "max-w-[640px] justify-items-start",
        className,
      )}
    >
      <h2
        id={id}
        className="text-[clamp(36px,4.6vw,60px)] leading-[1.04] font-medium tracking-[-0.05em] text-balance"
      >
        {title}
      </h2>
      {lead ? <p className="max-w-[560px] text-[17px] leading-[1.55] text-text-2">{lead}</p> : null}
      {children}
    </div>
  );
}

/** The quieter second half of a heading. */
export const Soft = ({ children }: { children: ReactNode }) => (
  <span className="text-soft">{children}</span>
);

/** A grey tray of white cards: four across, then two, then one. */
export function Tray({
  three,
  className,
  children,
}: {
  three?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-stagger
      className={cn(
        "grid grid-cols-1 gap-3 rounded-[30px] bg-mist p-3 sm:grid-cols-2",
        three
          ? "lg:grid-cols-3 sm:[&>:last-child]:col-span-2 lg:[&>:last-child]:col-span-1"
          : "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
