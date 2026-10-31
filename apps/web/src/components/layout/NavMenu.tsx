"use client";
// The site's pages on small screens, where the header's links don't fit.
import { Icon } from "@tandrix/ui/web";
import { useState } from "react";
import { primary, product } from "@/content/site";
import { GET_LABEL } from "@/lib/downloads";

const links: Array<[string, string]> = [
  ...[...product, ...primary].map((l): [string, string] => [l.href, l.label]),
  ["/#get", GET_LABEL],
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative block lg:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="inline-grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-[rgba(10,14,24,0.75)] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "x" : "menu"} size={20} />
      </button>
      {open ? (
        <nav
          aria-label="Primary"
          className="absolute top-[calc(100%+8px)] right-0 z-20 grid min-w-[200px] gap-0.5 rounded-2xl bg-[rgba(10,14,24,0.92)] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.14)] backdrop-blur-[12px]"
        >
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-medium text-white no-underline hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
