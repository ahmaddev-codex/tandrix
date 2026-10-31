// The hero carousel's cards: each one idea, readable at a glance. Real photos and footage of people
// at it, between the moments Tandrix shows on screen.
import { BrandMark } from "@tandrix/ui/web";
import type { ReactNode } from "react";
import { Clip } from "@/components/ui/Clip";
import { cn } from "@/lib/cn";

const Tile = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div
    className={cn(
      "relative grid size-full content-center justify-items-start gap-2 overflow-hidden bg-white p-4 font-sans text-[#0b0b0c]",
      className,
    )}
  >
    {children}
  </div>
);

const media = "absolute inset-0 size-full object-cover";
const Label = ({ children }: { children: ReactNode }) => (
  <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[rgba(11,11,12,0.62)] px-2.5 py-1 text-xs font-medium text-white backdrop-blur-[8px]">
    {children}
  </span>
);
const kicker = "text-xs font-medium opacity-70";
const title = "text-xl font-semibold tracking-[-0.02em]";
const sub = "text-[13px] leading-[1.35] opacity-[0.78]";
const light = "bg-[linear-gradient(170deg,#ffffff,#eef4ff)]";
const dark = "bg-[#0b0b0c] text-white";

export function PhotoTile({
  src,
  at = "50% 50%",
  label,
}: {
  src: string;
  at?: string;
  label: string;
}) {
  return (
    <Tile>
      <img src={src} alt="" loading="lazy" className={media} style={{ objectPosition: at }} />
      <Label>{label}</Label>
    </Tile>
  );
}

export function VideoTile({ name, label }: { name: string; label: string }) {
  return (
    <Tile>
      <Clip name={name} className={media} />
      <Label>{label}</Label>
    </Tile>
  );
}

/** Listening: the pill, the waveform, and what was said. */
export function ListeningTile() {
  return (
    <Tile className={dark}>
      <span className="inline-flex items-center gap-[7px] rounded-full bg-[#18181a] px-2.5 py-1.5 text-xs font-medium shadow-[0_0_0_1.5px_var(--highlight),0_0_16px_-2px_color-mix(in_srgb,var(--highlight)_70%,transparent)]">
        <i className="size-[7px] rounded-full bg-highlight motion-safe:animate-blink" /> Listening{" "}
        <kbd className="rounded-[5px] bg-[#2a2a2d] px-[5px] py-px font-sans text-[11px]">⌥⌘</kbd>
      </span>
      <span className="my-1.5 flex h-[34px] items-center gap-[3px]">
        {Array.from({ length: 16 }, (_, i) => (
          <i
            key={i}
            className={cn(
              "h-[40%] w-1 rounded-[2px] bg-highlight motion-safe:animate-wave",
              i % 3 === 2 && "h-[90%]",
              i % 4 === 0 && "h-[65%]",
            )}
            style={{ animationDelay: `${(i % 8) * 90}ms` }}
          />
        ))}
      </span>
      <p className="m-0 text-[15px] leading-[1.3] font-medium">“Teach me pivot tables”</p>
    </Tile>
  );
}

/** A step checked from a photo. */
export function VerifiedTile() {
  return (
    <Tile className={light}>
      <span className={kicker}>Step 3 of 6</span>
      <span className="grid size-[52px] place-items-center rounded-full bg-highlight text-white shadow-[0_10px_24px_-10px_var(--highlight)]">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <b className={title}>Verified</b>
      <span className={sub}>Cooler seated on all four posts</span>
    </Tile>
  );
}

/** The keys you hold to talk. */
export function KeysTile() {
  return (
    <Tile className="bg-tile-blue text-white">
      <span className={kicker}>Any app</span>
      <span className="flex gap-2">
        {["⌥", "⌘"].map((k) => (
          <kbd
            key={k}
            className="grid size-[54px] place-items-center rounded-[13px] bg-white font-sans text-[28px] text-[#0b0b0c] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className={sub}>Hold to talk. Let go to ask.</span>
    </Tile>
  );
}

/** Do it for me: what Tandrix has done, and what it asks first. */
export function DoingTile() {
  const step =
    "flex items-center gap-2 before:size-3.5 before:flex-none before:rounded-full before:content-['']";
  return (
    <Tile className={dark}>
      <span className={kicker}>Do it for me</span>
      <ul className="mt-1 grid list-none gap-1.5 p-0 text-[13px]">
        {["Open Calendar", "Thursday, 10:00", "Dentist"].map((s) => (
          <li key={s} className={cn(step, "before:bg-tick")}>
            {s}
          </li>
        ))}
        <li className={cn(step, "opacity-70 before:shadow-[inset_0_0_0_1.5px_currentColor]")}>
          Send invite? Asks you
        </li>
      </ul>
    </Tile>
  );
}

/** A safety gate: the step waits for you. */
export function GateTile() {
  return (
    <Tile className={light}>
      <span className="grid size-9 place-items-center rounded-[10px] bg-[#0b0b0c] font-bold text-white">
        !
      </span>
      <b className={title}>Unplug it first</b>
      <span className={sub}>The next step waits until you say it’s safe.</span>
      <span className="mt-1 inline-flex items-center gap-2 text-xs font-medium">
        <i className="relative h-[18px] w-[30px] rounded-full bg-highlight after:absolute after:top-0.5 after:right-0.5 after:size-3.5 after:rounded-full after:bg-white after:content-['']" />
        It’s unplugged
      </span>
    </Tile>
  );
}

/** The mark, as the carousel's anchor card. */
export function MarkTile() {
  return (
    <Tile className="bg-tile-mark justify-items-center text-white">
      <BrandMark size={64} />
      <span className={sub}>Tandrix is active</span>
    </Tile>
  );
}
