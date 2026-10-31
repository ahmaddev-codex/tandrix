"use client";
// A day with Tandrix: the moments scroll by on the left while the picture beside them changes to
// match: earlier moments slide back into a stack, as on the reference. On narrow screens each
// moment shows its own picture inline.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Moment {
  time: string;
  tag: string;
  title: string;
  body: ReactNode;
  /** What the user said to start it. */
  ask: string;
  scene: ReactNode;
}

export function DayTimeline({ moments }: { moments: Moment[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    // The desk figures are filled with the band's ground.
    <div className="grid grid-cols-1 items-start gap-x-12 [--fig-ground:var(--mist)] md:grid-cols-[72px_minmax(0,360px)_minmax(0,1fr)]">
      <ol
        aria-hidden="true"
        className="sticky top-[140px] m-0 hidden list-none gap-16 pt-2 text-[13px] text-soft tabular-nums md:grid"
      >
        {moments.map((m, i) => (
          <li
            key={m.time}
            className={cn(
              "relative pl-[22px] transition-colors duration-200 before:absolute before:top-1/2 before:left-0 before:h-px before:w-3 before:bg-current before:content-['']",
              i === active &&
                "font-semibold text-ink before:top-[calc(50%-3px)] before:-left-0.5 before:size-[7px] before:rounded-full before:bg-highlight",
            )}
          >
            {m.time}
          </li>
        ))}
      </ol>
      <div className="grid">
        {moments.map((m, i) => (
          <article
            key={m.time}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className={cn(
              "grid content-center gap-4 py-10 transition-opacity duration-300 md:min-h-[78vh] md:py-0 [&_h3]:text-[clamp(30px,3vw,40px)] [&_h3]:leading-[1.08] [&_h3]:font-medium [&_h3]:tracking-[-0.035em] [&_p]:text-[17px] [&_p]:leading-[1.6] [&_p]:text-text-2",
              i !== active && "md:opacity-[0.32]",
            )}
          >
            <span className="justify-self-start rounded-lg px-3 py-[5px] text-[13px] text-text-2 shadow-[inset_0_0_0_1px_var(--line)]">
              {m.tag}
            </span>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
            <div className="mt-3 block h-[clamp(380px,90vw,520px)] md:hidden">
              <Stage moment={m} />
            </div>
          </article>
        ))}
      </div>
      <div className="sticky top-[120px] hidden h-[min(620px,74vh)] md:block">
        {/* Earlier moments recede into a stack behind the current one; the next rises in. */}
        {moments.map((m, i) => (
          <div
            key={m.time}
            className={cn(
              "recede absolute inset-x-0 top-[70px] bottom-0",
              i === active ? "pointer-events-auto" : "pointer-events-none",
            )}
            style={{ "--d": i - active, zIndex: 10 - Math.abs(i - active) } as CSSProperties}
            aria-hidden={i !== active || undefined}
          >
            <Stage moment={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage({ moment }: { moment: Moment }) {
  return (
    <div className="relative grid h-full grid-rows-[auto_1fr] gap-[18px]">
      <p className="inline-flex max-w-full items-center gap-2.5 justify-self-center rounded-full bg-[#111] px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_0_2px_var(--highlight),0_0_24px_-2px_color-mix(in_srgb,var(--highlight)_70%,transparent)]">
        <span className="size-2 flex-none rounded-full bg-highlight shadow-[0_0_0_3px_var(--highlight-tint)]" />
        “{moment.ask}”
      </p>
      <div className="flex min-h-0">{moment.scene}</div>
    </div>
  );
}
