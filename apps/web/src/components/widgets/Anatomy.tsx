"use client";
// The anatomy of Tandrix, as an exploded product view: the layers it puts over what you're doing,
// stacked in 3D, pulling apart the first time the view is on screen, each with its callout.
import { BrandMark, Icon } from "@tandrix/ui/web";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PointerArrow } from "@/components/scenes/Scenes";
import { cn } from "@/lib/cn";

interface Layer {
  name: string;
  says: string;
  plate: ReactNode;
}

/** Bottom to top: what you're working on, then each thing Tandrix adds on top of it. */
const layers: Layer[] = [
  {
    name: "Your screen or your camera",
    says: "What Tandrix looks at: the app you're in, or the thing in front of you.",
    plate: (
      <img
        src="/photos/budget-laptop.jpeg"
        alt=""
        className="size-full object-cover object-[45%_42%]"
      />
    ),
  },
  {
    name: "The ring",
    says: "Settles on the exact control or part, so you know where to look.",
    plate: (
      <span className="h-[26%] w-[34%] rounded-[14px] border-[3px] border-highlight shadow-[0_0_0_7px_var(--highlight-tint),0_0_26px_4px_color-mix(in_srgb,var(--highlight)_40%,transparent)]" />
    ),
  },
  {
    name: "The pointer and the step",
    says: "Points at it and shows the next step in a few words.",
    plate: (
      <span className="relative grid translate-x-[10%] translate-y-[8%] justify-items-start gap-2">
        <PointerArrow
          size={34}
          className="fill-[#0b0b0c] stroke-white stroke-[1.4] drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
        />
        <span className="rounded-[10px] bg-[#0b0b0c] px-3 py-2 text-[13px] font-medium whitespace-nowrap text-white shadow-[0_0_0_1.5px_var(--highlight)]">
          Click Insert, then PivotTable
        </span>
      </span>
    ),
  },
  {
    name: "The voice",
    says: "Says the step out loud, so your eyes can stay on the work.",
    plate: (
      <span className="flex h-[46px] items-center gap-1">
        {Array.from({ length: 22 }, (_, i) => (
          <i
            key={i}
            style={{ animationDelay: `${(i % 11) * 80}ms` }}
            className={cn(
              "h-[45%] w-[5px] rounded-[3px] bg-highlight motion-safe:group-data-open:animate-wave",
              i % 3 === 2 && "h-[95%]",
              i % 4 === 0 && "h-[70%]",
            )}
          />
        ))}
      </span>
    ),
  },
  {
    name: "The check",
    says: "Looks again when you're done and only moves on when it's right.",
    plate: (
      <span className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pr-4 pl-2.5 text-[15px] font-semibold text-[#0b0b0c] shadow-soft">
        <span className="grid size-[38px] place-items-center rounded-full bg-highlight text-white">
          <Icon name="check" size={24} />
        </span>
        Verified
      </span>
    ),
  },
  {
    name: "Tandrix is active",
    says: "The pill at the top of your screen: listening, looking or in control. Esc stops it.",
    plate: (
      <span className="inline-flex items-center gap-2.5 rounded-full bg-[#0b0b0c] py-2 pr-3.5 pl-2 text-sm font-medium text-white shadow-[0_0_0_2px_var(--highlight),0_0_26px_-2px_color-mix(in_srgb,var(--highlight)_75%,transparent)]">
        <BrandMark size={22} />
        Listening <kbd className="rounded-md bg-[#2a2a2d] px-1.5 py-0.5 font-sans text-xs">⌥⌘</kbd>
      </span>
    ),
  },
];

export function Anatomy() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setOpen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Callouts read top to bottom, matching the stack.
  const top = [...layers].reverse();
  return (
    <div
      ref={ref}
      data-open={open || undefined}
      className="group grid grid-cols-1 items-center gap-[clamp(24px,5vw,72px)] min-[901px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      {/* The exploded stack: plates on an isometric plane, pulled apart along their depth. */}
      <div
        aria-hidden="true"
        className="relative h-[calc(var(--plate)*1.45)] [--gap:0px] [--plate:min(64vw,300px)] [perspective:2400px] group-data-open:[--gap:42px] motion-reduce:[--gap:clamp(46px,6vw,78px)] min-[901px]:h-[calc(var(--plate)*1.9)] min-[901px]:[--plate:clamp(220px,30vw,380px)] min-[901px]:group-data-open:[--gap:clamp(46px,6vw,78px)]"
      >
        <div className="absolute top-[62%] left-1/2 h-[calc(var(--plate)*0.66)] w-(--plate) transform-3d [transform:translate(-50%,-50%)_rotateX(58deg)_rotateZ(-38deg)]">
          {layers.map((l, i) => (
            <div
              key={l.name}
              style={{ "--i": i } as CSSProperties}
              className="absolute inset-0 grid place-items-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),rgba(220,234,255,0.08))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.85),0_0_0_1px_color-mix(in_srgb,var(--highlight)_35%,transparent),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)] transition-transform delay-[calc(var(--i)*70ms)] duration-[1100ms] ease-[cubic-bezier(0.2,0.7,0.15,1)] [transform:translateZ(calc(var(--i)*var(--gap)))] first:bg-white"
            >
              {l.plate}
              <span className="absolute top-3 left-3 rounded-full bg-highlight px-2 py-[3px] text-[11px] font-semibold text-white tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Callouts, top of the stack first. */}
      <ol className="m-0 grid list-none gap-1 p-0">
        {top.map((l, i) => (
          <li
            key={l.name}
            style={{ "--i": i } as CSSProperties}
            className="grid grid-cols-[auto_1fr] gap-4 border-t border-line py-4 transition-[opacity,transform] delay-[calc(300ms+var(--i)*80ms)] duration-[600ms,700ms] ease-out-soft last:border-b motion-safe:not-group-data-open:translate-x-3 motion-safe:not-group-data-open:opacity-0"
          >
            <span className="pt-0.5 text-[13px] font-semibold text-highlight tabular-nums">
              {String(layers.length - i).padStart(2, "0")}
            </span>
            <span>
              <b className="block text-[17px] font-medium tracking-[-0.01em]">{l.name}</b>
              <span className="mt-1 block text-[15px] leading-normal text-text-2">{l.says}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
