"use client";
// A short silent clip that plays only while it's on screen, at its natural speed, and not at all
// for people who ask for less motion (they see the still).
import { useEffect, useRef } from "react";

export function Clip({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className={className}
      src={`/videos/${name}.mp4`}
      poster={`/videos/${name}.jpg`}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  );
}
