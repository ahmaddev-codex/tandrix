// What Tandrix is, in one heading and a bento: hold to talk, Show me, real manuals, asks first.
import { Icon } from "@tandrix/ui/web";
import type { ReactNode } from "react";
import { DeskFigure } from "@/components/figures/desk/figure";
import { PointerArrow } from "@/components/scenes/Scenes";
import { Clip } from "@/components/ui/Clip";
import { cn } from "@/lib/cn";
import { Section, SectionHead, Soft } from "./Section";

/** A round icon set into a word of the heading. */
const Chip = ({ tone, children }: { tone: "blue" | "ink"; children: ReactNode }) => (
  <span
    aria-hidden="true"
    className={cn(
      "mx-[0.12em] inline-grid size-[0.92em] place-items-center rounded-full align-[-0.1em] [&_svg]:size-[0.42em]",
      tone === "blue" ? "bg-highlight text-white" : "bg-ink fill-page text-page",
    )}
  >
    {children}
  </span>
);

const tile =
  "relative grid min-h-[170px] content-start gap-2.5 overflow-hidden rounded-3xl p-6 transition-transform duration-300 ease-out-soft hover:-translate-y-1";
const label = "text-[15px] font-medium";
const stat = "text-[clamp(32px,3.2vw,46px)] leading-none font-normal tracking-[-0.04em]";
const body = "mt-auto text-[15px] leading-[1.45] opacity-[0.88]";

export function WhatItDoes() {
  return (
    <Section
      id="what"
      labelledBy="what-title"
      presence={{ state: "looking", label: "Looking at your screen" }}
    >
      <SectionHead
        id="what-title"
        title={
          <>
            An assistant that{" "}
            <span className="whitespace-nowrap">
              sees
              <Chip tone="blue">
                <Icon name="camera" size={24} />
              </Chip>
            </span>{" "}
            what you see and{" "}
            <span className="whitespace-nowrap">
              points
              <Chip tone="ink">
                <PointerArrow size={24} />
              </Chip>
            </span>{" "}
            <Soft>at the way through.</Soft>
          </>
        }
      />

      <div data-stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article className={cn(tile, "min-h-[380px] content-end bg-[#1b2a40] p-5")}>
          <Clip name="typing-on-laptop" className="absolute inset-0 size-full object-cover" />
          <span className="absolute top-5 right-5 grid size-[42px] place-items-center rounded-xl bg-white text-[#0b0b0c]">
            <Icon name="mic" size={20} />
          </span>
          <div className="relative grid gap-2.5 rounded-[18px] bg-white/[0.94] p-[22px] text-[15px] leading-[1.45] text-[#0b0b0c] backdrop-blur-[10px]">
            <p className="flex gap-2">
              {["⌥", "⌘"].map((k) => (
                <kbd
                  key={k}
                  className="grid h-[60px] min-w-[60px] place-items-center rounded-[14px] bg-[#0b0b0c] font-sans text-[30px] text-white shadow-[inset_0_-3px_0_rgba(255,255,255,0.14),0_0_0_2px_var(--highlight)]"
                >
                  {k}
                </kbd>
              ))}
            </p>
            <p>Hold to talk from any app. Let go, and Tandrix answers out loud.</p>
          </div>
        </article>
        <article className={cn(tile, "group bg-mist")}>
          <p className={label}>Show me</p>
          <p className={stat}>Points, then waits</p>
          <div className="mt-[18px] -rotate-2 transition-transform duration-[400ms] ease-out-soft group-hover:scale-[1.02] group-hover:rotate-0">
            <DeskFigure
              focus="sheet"
              only={["laptop"]}
              label="PivotTable ringed on the spreadsheet"
            />
          </div>
        </article>
        <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1 lg:grid-rows-[1fr_auto]">
          <article className={cn(tile, "bg-blue-glow text-white")}>
            <p className={label}>From the real manual</p>
            <p className={stat}>p. 12</p>
            <p className={body}>Every step cites the page it came from.</p>
          </article>
          <article className={cn(tile, "min-h-0 bg-[#0b0b0c] text-white")}>
            <p className={label}>Asks first</p>
            <p className={body}>Before anything that sends, pays or deletes.</p>
          </article>
        </div>
      </div>
    </Section>
  );
}
