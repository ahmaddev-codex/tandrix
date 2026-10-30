"use client";
// Build it: a small computer kit comes together as you scroll. Each part waits above its place,
// its landing outline lights in blue, then it drops onto the one below and is checked off, the way
// Tandrix checks a real build from a photo. The parts are drawn on the server; this only moves them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { translateAlong } from "@/vendor/anatomy/iso-kit";
import { HEIGHT, P, PARTS, WIDTH } from "../figures/kit/view";
import { HearIt } from "@/components/ui/HearIt";
import { cn } from "@/lib/cn";

/** When each part starts dropping, in scroll progress. */
const parts = PARTS.map((part, i) => ({ ...part, at: i === 0 ? -1 : 0.04 + (i - 1) * 0.2 }));
const DROP = 0.14;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function Assemble({ layers, ghosts }: { layers: ReactNode[]; ghosts: ReactNode[] }) {
  const section = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setP(1);
    const el = section.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / Math.max(1, r.height - innerHeight)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const landed = parts.filter((x) => p >= x.at + DROP).length;
  return (
    // A tall section; its content stays pinned while the scroll drives the assembly.
    <div ref={section} className="relative h-[170vh] min-[861px]:h-[180vh]">
      <div className="sticky top-0 mx-auto grid h-screen max-w-[1240px] grid-cols-1 content-center items-center gap-2 pt-14 pb-4 min-[861px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[861px]:content-normal min-[861px]:gap-[clamp(24px,5vw,72px)] min-[861px]:p-0">
        {/* The kit, drawn straight on the page: each part waits above its place until it drops. */}
        <div
          aria-hidden="true"
          className="iso relative flex h-[42vh] justify-center [--anatomy-paper:var(--fig-ground,var(--background-100))] min-[861px]:h-[min(72vh,600px)] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full"
        >
          <svg className="iso-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
            {parts.map((x, i) => {
              // 1 while waiting above, 0 once landed.
              const lift = 1 - clamp((p - x.at) / DROP);
              const now = lift > 0 && p >= x.at - 0.08;
              return (
                <g key={x.name}>
                  <g style={{ opacity: now ? 1 : 0, transition: "opacity 240ms ease" }}>
                    {ghosts[i]}
                  </g>
                  <g transform={translateAlong(P, [0, 0, lift * x.apart])}>{layers[i]}</g>
                </g>
              );
            })}
          </svg>
          {landed === parts.length ? (
            <span className="absolute bottom-[4%] left-1/2 -translate-x-1/2 animate-pop rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-white">
              Verified
            </span>
          ) : null}
        </div>
        <div className="grid justify-items-start gap-[18px]">
          <p className="text-sm font-medium text-highlight">
            Step {Math.min(landed + 1, parts.length)} of {parts.length}
          </p>
          <ol className="m-0 grid w-full max-w-[420px] list-none gap-1.5 p-0">
            {parts.map((x) => {
              const ok = p >= x.at + DROP;
              const now = !ok && p >= x.at;
              return (
                <li
                  key={x.name}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] bg-mist px-3 py-2 text-sm text-soft transition-colors duration-300 min-[861px]:px-3.5 min-[861px]:py-3 min-[861px]:text-base",
                    (ok || now) && "text-ink",
                    now && "bg-[color-mix(in_srgb,var(--highlight)_10%,var(--mist))]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-[22px] flex-none place-items-center rounded-full text-white shadow-[inset_0_0_0_1.5px_var(--line-strong)] transition-colors duration-300",
                      ok && "bg-highlight shadow-none",
                      now && "shadow-[inset_0_0_0_2px_var(--highlight)]",
                    )}
                  >
                    {ok ? (
                      <svg viewBox="0 0 16 16" width="14" height="14">
                        <path
                          d="M3.5 8.4l2.8 2.8 6.2-6.4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  {x.name}
                  <span className={cn("ml-auto text-[13px]", ok && "text-highlight")}>
                    {ok ? "Checked" : now ? "Fitting" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="h-1 w-full max-w-[420px] rounded-[2px] bg-mist">
            <i
              className="block h-full rounded-[inherit] bg-highlight transition-[width] duration-300"
              style={{ width: `${(landed / parts.length) * 100}%` }}
            />
          </div>
          <HearIt line="seated" label="Hear a check" tone="light" />
        </div>
      </div>
    </div>
  );
}
