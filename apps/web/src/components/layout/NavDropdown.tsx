"use client";
// A header menu: opens on hover or click, closes on Esc, a click elsewhere, or leaving it.
import { useEffect, useRef, useState } from "react";
import type { NavLink } from "@/content/site";

export function NavDropdown({ label, links }: { label: string; links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[15px] font-medium text-white opacity-90 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        {label}
        <svg
          viewBox="0 0 12 12"
          width={12}
          height={12}
          aria-hidden="true"
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        // The gap above is part of the menu, so moving down onto it doesn't close it.
        <div className="absolute top-full left-1/2 z-20 -translate-x-1/2 pt-3">
          <ul className="m-0 grid w-[320px] list-none gap-0.5 rounded-2xl bg-[rgba(10,14,24,0.92)] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_18px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[12px]">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="grid gap-0.5 rounded-[10px] px-3.5 py-2.5 text-white no-underline hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="text-[15px] font-medium">{l.label}</span>
                  {l.blurb ? <span className="text-[13px] text-white/60">{l.blurb}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
