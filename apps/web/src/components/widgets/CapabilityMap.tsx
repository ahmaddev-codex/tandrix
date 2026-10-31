"use client";
// Everything Tandrix does, around it: six groups in two columns, joined to the mark by curves
// measured from the real layout (so they meet each card exactly at any size). The curves draw in
// the first time the map is on screen, then a pulse runs along each one.
import { BrandMark, Icon, type IconProps } from "@tandrix/ui/web";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface Group {
  name: string;
  icon: IconProps["name"];
  items: string[];
}

const left: Group[] = [
  {
    name: "Sees what you see",
    icon: "camera",
    items: ["Your screen", "The camera", "Labels and nameplates", "Manuals and PDFs"],
  },
  {
    name: "Shows you the way",
    icon: "pointer",
    items: ["Rings the control", "Says the next step", "Teach me, one step at a time"],
  },
  {
    name: "Checks the work",
    icon: "check",
    items: ["Photo checks", "Parts check", "Safety gates"],
  },
];
const right: Group[] = [
  {
    name: "Does it for you",
    icon: "laptop",
    items: ["Opens your apps", "Takes the steps", "Queues the next task"],
  },
  {
    name: "Keeps you in control",
    icon: "hand",
    items: [
      "Asks before it sends or pays",
      "Esc or the mouse stops it",
      "Wake word stays on the Mac",
    ],
  },
  {
    name: "Works where you are",
    icon: "phone",
    items: ["Mac", "iPhone", "A shared report"],
  },
];

function Card({ g, side, order }: { g: Group; side: "l" | "r"; order: number }) {
  return (
    <article
      data-card
      data-side={side}
      style={{ animationDelay: `${order * 120}ms` }}
      className="grid gap-3.5 rounded-[20px] bg-paper px-[22px] py-5 shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)] transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-[3px] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--highlight)_50%,var(--line)),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)] motion-safe:translate-y-3.5 motion-safe:opacity-0 motion-safe:group-data-shown:animate-card-in"
    >
      <header className="flex items-center gap-2.5">
        <Icon name={g.icon} size={20} weight="fill" className="flex-none text-highlight" />
        <h3 className="text-[19px] font-medium tracking-[-0.02em]">{g.name}</h3>
      </header>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {g.items.map((it) => (
          <li
            key={it}
            className="rounded-full bg-mist px-[11px] py-[5px] text-[13.5px] text-text-2"
          >
            {it}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function CapabilityMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shown, setShown] = useState(false);

  // Curves from the mark to the inner edge of each card, from where they really are.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const core = el.querySelector("[data-core]")?.getBoundingClientRect();
      if (!core) return;
      const cx = core.left + core.width / 2 - box.left;
      const cy = core.top + core.height / 2 - box.top;
      const next: string[] = [];
      el.querySelectorAll<HTMLElement>("[data-card]").forEach((card) => {
        const r = card.getBoundingClientRect();
        const leftSide = card.dataset.side === "l";
        const x = (leftSide ? r.right : r.left) - box.left;
        const y = r.top + r.height / 2 - box.top;
        const sx = cx + (leftSide ? -1 : 1) * (core.width / 2 - 6);
        const mx = (sx + x) / 2;
        next.push(`M ${sx} ${cy} C ${mx} ${cy}, ${mx} ${y}, ${x} ${y}`);
      });
      setPaths(next);
      setSize({ w: box.width, h: box.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      data-shown={shown || undefined}
      className="group relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-[18px] min-[901px]:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_minmax(0,1fr)] min-[901px]:gap-x-[clamp(32px,6vw,96px)] min-[901px]:gap-y-0"
    >
      <svg
        className="pointer-events-none absolute inset-0 hidden overflow-visible min-[901px]:block"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        aria-hidden="true"
      >
        {paths.map((d, i) => (
          <g key={i} style={{ "--i": i } as CSSProperties}>
            <path
              d={d}
              pathLength={1}
              style={{ animationDelay: `${i * 90}ms` }}
              className="fill-none stroke-[color-mix(in_srgb,var(--highlight)_45%,var(--line-strong))] stroke-[1.4] [stroke-dasharray:1] [stroke-dashoffset:0] motion-safe:[stroke-dashoffset:1] motion-safe:group-data-shown:animate-draw"
            />
            <circle
              r="4"
              style={{ offsetPath: `path("${d}")`, animationDelay: `${1 + i * 0.6}s` }}
              className="fill-highlight opacity-0 [offset-distance:0%] drop-shadow-[0_0_6px_var(--highlight)] motion-safe:group-data-shown:animate-travel"
            />
          </g>
        ))}
      </svg>
      <div className="relative grid gap-[18px]">
        {left.map((g, i) => (
          <Card key={g.name} g={g} side="l" order={i} />
        ))}
      </div>
      <div className="relative -order-1 mb-3 grid justify-items-center gap-2.5 text-center min-[901px]:order-none min-[901px]:mb-0">
        <div
          data-core
          className="relative grid size-[132px] place-items-center rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--highlight)_16%,transparent),transparent_70%)]"
        >
          {[0, 1.6].map((delay) => (
            <span
              key={delay}
              aria-hidden="true"
              style={{ animationDelay: `${delay}s` }}
              className="absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--highlight)_45%,transparent)] motion-safe:animate-orbit"
            />
          ))}
          <BrandMark size={72} />
        </div>
        <p className="text-[clamp(30px,3vw,40px)] font-medium tracking-[-0.04em]">Tandrix</p>
        <p className="max-w-[24ch] text-[15px] leading-[1.45] text-text-2">
          One assistant, everything it takes to get it done.
        </p>
      </div>
      <div className="relative grid gap-[18px]">
        {right.map((g, i) => (
          <Card key={g.name} g={g} side="r" order={i} />
        ))}
      </div>
    </div>
  );
}
