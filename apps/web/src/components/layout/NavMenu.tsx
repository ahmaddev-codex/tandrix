"use client";
// Section navigation on small screens, where the inline links don't fit.
import { useState } from "react";

const links: Array<[string, string]> = [
  ["#what", "What it does"],
  ["#day", "A day with it"],
  ["#explore", "Uses"],
  ["#faq", "Questions"],
  ["#get", "Download"],
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
        className="inline-flex size-11 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-full border-0 bg-[rgba(10,14,24,0.75)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&>span]:block [&>span]:h-0.5 [&>span]:w-[18px] [&>span]:rounded-[2px] [&>span]:bg-white"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
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
