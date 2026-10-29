"use client";
// A short silent clip that plays only while it's on screen, and not at all for people who ask for
// less motion (they see the still).
import { useEffect, useRef } from "react";

export function Clip({
  name,
  className,
  rate = 0.6,
}: {
  name: string;
  className?: string;
  /** Playback speed: slower than real time, so footage reads as calm, not busy. */
  rate?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          v.playbackRate = rate;
          void v.play().catch(() => undefined);
        } else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [rate]);
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
      onLoadedMetadata={(e) => {
        e.currentTarget.playbackRate = rate;
      }}
      aria-hidden="true"
    />
  );
}
