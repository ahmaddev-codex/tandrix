// The site's buttons: pills, with the arrow in its own disc on the ones that lead somewhere.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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

type Tone = "ink" | "light" | "blue" | "white" | "glass" | "outline";

/** Each tone: the pill, then the arrow's disc. */
const tones: Record<Tone, [string, string]> = {
  ink: [
    "bg-ink text-page hover:bg-[color-mix(in_srgb,var(--ink)_84%,var(--page-bg))]",
    "bg-highlight text-white",
  ],
  white: ["bg-white text-[#0b0b0c] shadow-soft hover:bg-[#f1f6ff]", "bg-highlight text-white"],
  glass: [
    "bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] backdrop-blur-[12px] hover:bg-white/[0.26]",
    "",
  ],
  light: [
    "bg-mist text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--line-strong)]",
    "bg-ink text-page",
  ],
  blue: ["bg-highlight text-white hover:bg-blue-700", "bg-white text-highlight"],
  outline: [
    "bg-transparent text-inherit shadow-[inset_0_0_0_1px_color-mix(in_srgb,currentColor_32%,transparent)]",
    "bg-[color-mix(in_srgb,currentColor_14%,transparent)]",
  ],
};

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
  tone?: Tone;
  arrow?: boolean;
  block?: boolean;
  external?: boolean;
}) {
  const [pill, disc] = tones[tone];
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-[22px] font-sans text-[15px] font-medium whitespace-nowrap no-underline transition-[background-color,box-shadow,transform] duration-150 ease-[ease] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-focus active:scale-[0.98]",
        arrow && "py-1 pr-1 pl-[22px]",
        block && "w-full",
        pill,
      )}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span>{children}</span>
      {arrow ? (
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full transition-transform duration-[220ms] ease-[ease] group-hover:rotate-45",
            disc,
          )}
        >
          <ArrowUpRight />
        </span>
      ) : null}
    </a>
  );
}
