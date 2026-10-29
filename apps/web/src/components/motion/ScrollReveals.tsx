"use client";
// Scroll-driven reveals for marketing pages. Mount once per page; it batch-processes
// [data-reveal] blocks and staggers [data-stagger] children on viewport entry.
// Uses gsap.from so SSR/no-JS always renders the readable final state.
import { useEffect, useRef, type ReactNode } from "react";
import { REDUCED_MOTION_QUERY, ensureGsap } from "./gsap-setup";

export function ScrollReveals({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const root = scope.current;
    if (!root) return;
    const { gsap, ScrollTrigger } = ensureGsap();
    const ctx = gsap.context(() => {
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.from(batch, {
            opacity: 0,
            y: 14,
            duration: 0.45,
            ease: "power1.out",
            stagger: 0.06,
            overwrite: true,
          }),
      });
      root.querySelectorAll<HTMLElement>("[data-stagger]").forEach((list) => {
        gsap.from(list.children, {
          opacity: 0,
          y: 10,
          duration: 0.35,
          ease: "power1.out",
          stagger: 0.05,
          overwrite: true,
          scrollTrigger: { trigger: list, start: "top 88%", once: true },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={scope} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
