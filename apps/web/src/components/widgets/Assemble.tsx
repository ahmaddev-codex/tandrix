"use client";
// Build it: a mechanical assembly comes together as you scroll. Each part waits along its
// exploded trajectory, its landing outline lights in blue, then it docks onto the structure
// below and is checked off, the way Tandrix verifies a physical build from a photo.
import { Icon } from "@tandrix/ui/web";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { translateAlong, type Projection } from "@/vendor/anatomy/iso-kit";
import { HEIGHT, P, PARTS, WIDTH } from "../figures/kit/view";
import { HearIt } from "@/components/ui/HearIt";
import { cn } from "@/lib/cn";

export interface AssemblePart {
  name: string;
  apart: number;
  offset?: [number, number, number];
  role?: string;
  at?: number;
}

export interface AssembleProps {
  parts?: readonly AssemblePart[];
  projection?: Projection;
  width?: number;
  height?: number;
  layers: ReactNode[];
  ghosts: ReactNode[];
  hearLine?: string;
  hearLabel?: string;
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export function Assemble({
  parts: customParts,
  projection = P,
  width = WIDTH,
  height = HEIGHT,
  layers,
  ghosts,
  hearLine = "seated",
  hearLabel = "Hear a check",
}: AssembleProps) {
  const section = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  const rawParts: readonly AssemblePart[] = customParts ?? PARTS;
  const count = rawParts.length;
  const stepInterval = count > 1 ? 0.82 / (count - 1) : 0.8;
  const dropWindow = clamp(0.72 / Math.max(1, count), 0.08, 0.15);

  const parts = rawParts.map((part, i) => ({
    ...part,
    at: i === 0 ? -1 : 0.04 + (i - 1) * stepInterval,
  }));

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

  const landed = parts.filter((x) => p >= x.at + dropWindow).length;

  return (
    // A tall section; its content stays pinned while the scroll drives the assembly.
    <div ref={section} className="relative h-[175vh] min-[861px]:h-[190vh]">
      <div className="sticky top-0 mx-auto grid h-screen max-w-[1240px] grid-cols-1 content-center items-center gap-2 pt-14 pb-4 min-[861px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[861px]:content-normal min-[861px]:gap-[clamp(24px,5vw,72px)] min-[861px]:p-0">
        {/* The assembly, drawn in isometric projection: each tier waits along its trajectory until it drops */}
        <div
          aria-hidden="true"
          className="iso relative flex h-[44vh] justify-center [--anatomy-paper:var(--fig-ground,var(--background-100))] min-[861px]:h-[min(74vh,620px)] [&_.iso-svg]:h-full [&_.iso-svg]:w-auto [&_.iso-svg]:max-w-full"
        >
          <svg className="iso-svg" viewBox={`0 0 ${width} ${height}`}>
            {parts.map((x, i) => {
              // 1 while waiting above/apart, 0 once landed.
              const lift = 1 - clamp((p - x.at) / dropWindow);
              const now = lift > 0 && p >= x.at - 0.08;
              const offset = x.offset ?? [0, 0, x.apart];
              return (
                <g key={x.name}>
                  <g style={{ opacity: now ? 1 : 0, transition: "opacity 240ms ease" }}>
                    {ghosts[i]}
                  </g>
                  <g
                    transform={translateAlong(projection, [
                      offset[0] * lift,
                      offset[1] * lift,
                      offset[2] * lift,
                    ])}
                  >
                    {layers[i]}
                  </g>
                </g>
              );
            })}
          </svg>
          {landed === parts.length ? (
            <span className="absolute bottom-[4%] left-1/2 -translate-x-1/2 animate-pop rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-highlight/20">
              Verified
            </span>
          ) : null}
        </div>

        <div className="grid justify-items-start gap-[18px]">
          <p className="text-sm font-medium text-highlight">
            Step {Math.min(landed + 1, parts.length)} of {parts.length}
          </p>
          <ol className="m-0 grid w-full max-w-[460px] list-none gap-2 p-0">
            {parts.map((x) => {
              const ok = p >= x.at + dropWindow;
              const now = !ok && p >= x.at;
              return (
                <li
                  key={x.name}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] bg-mist px-3.5 py-2.5 text-sm text-soft transition-colors duration-300 min-[861px]:py-3 min-[861px]:text-base",
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
                      <Icon name="sealCheck" size={16} weight="fill" className="text-white" />
                    ) : null}
                  </span>
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{x.name}</span>
                    {x.role ? (
                      <span className="truncate text-xs text-soft opacity-85">{x.role}</span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "ml-auto flex-none text-[13px] font-medium",
                      ok && "text-highlight",
                    )}
                  >
                    {ok ? "Checked" : now ? "Fitting" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="h-1 w-full max-w-[460px] rounded-[2px] bg-mist">
            <i
              className="block h-full rounded-[inherit] bg-highlight transition-[width] duration-300"
              style={{ width: `${(landed / parts.length) * 100}%` }}
            />
          </div>
          <HearIt line={hearLine} label={hearLabel} tone="light" />
        </div>
      </div>
    </div>
  );
}
