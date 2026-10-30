"use client";
// Tandrix's presence pill, held at the top of the screen as you read, the way it sits at the top of
// your Mac. It changes with the section you're in (each section says its state with
// data-presence-state and data-presence-label), and stays out of the way of the hero.
import { useEffect, useState } from "react";
import type { PresenceState } from "@tandrix/ui/web";
import { ActivePill } from "@/components/ui/ActivePill";
import styles from "./StickyPresence.module.css";

export function StickyPresence() {
  const [now, setNow] = useState<{ state: PresenceState; label: string } | null>(null);
  const [aside, setAside] = useState(false);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-presence-state]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          setNow({
            state: el.dataset.presenceState as PresenceState,
            label: el.dataset.presenceLabel ?? "",
          });
        }
      },
      // The section crossing the upper middle of the screen is the one you're reading.
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    // Hidden over the hero.
    const hero = document.querySelector<HTMLElement>("[data-presence-off]");
    const heroIo = hero
      ? new IntersectionObserver(([e]) => e?.isIntersecting && setNow(null), { threshold: 0.4 })
      : null;
    if (hero) heroIo!.observe(hero);
    // Step aside while a section's heading passes under it.
    const under = new Set<Element>();
    const headIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) under.add(e.target);
          else under.delete(e.target);
        }
        setAside(under.size > 0);
      },
      { rootMargin: "0px 0px -88% 0px" },
    );
    document.querySelectorAll("main h2").forEach((h) => headIo.observe(h));
    return () => {
      io.disconnect();
      heroIo?.disconnect();
      headIo.disconnect();
    };
  }, []);

  return (
    <div className={`${styles.dock} ${now && !aside ? styles.shown : ""}`} aria-hidden="true">
      {now ? <ActivePill key={now.label} state={now.state} label={now.label} /> : null}
    </div>
  );
}
