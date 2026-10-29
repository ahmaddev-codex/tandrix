"use client";
// Scroll reveals for the marketing pages: [data-reveal] blocks rise in as they come on screen, and
// the children of [data-stagger] follow one another. Uses the browser's own animations, so each
// element always ends exactly where the layout put it; without JS everything is simply visible.
import { useEffect, useRef, type ReactNode } from "react";

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

export function ScrollReveals({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = scope.current;
    if (!root) return;
    const targets: Array<{ el: Element; items: HTMLElement[] }> = [
      ...[...root.querySelectorAll<HTMLElement>("[data-reveal]")].map((el) => ({
        el,
        items: [el],
      })),
      ...[...root.querySelectorAll<HTMLElement>("[data-stagger]")].map((el) => ({
        el,
        items: [...el.children] as HTMLElement[],
      })),
    ];
    // Only what's still below the fold waits for its reveal.
    const pending = targets.filter(({ el }) => el.getBoundingClientRect().top > innerHeight);
    pending.forEach(({ items }) => items.forEach((i) => (i.style.opacity = "0")));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const t = pending.find((p) => p.el === e.target);
          t?.items.forEach((item, n) => {
            item.style.opacity = "";
            item.animate(
              [
                { opacity: 0, transform: "translateY(16px)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: 600, delay: n * 70, easing: EASE, fill: "backwards" },
            );
          });
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    pending.forEach(({ el }) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={scope} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
