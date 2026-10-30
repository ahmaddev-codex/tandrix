"use client";
// Plays a line in Tandrix's real voice (recorded from the product's own speech). One line at a time
// across the page: starting one stops any other.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

let current: HTMLAudioElement | null = null;

export function HearIt({
  line,
  label = "Hear Tandrix",
  tone = "dark",
}: {
  /** File name in /audio, without the extension. */
  line: string;
  label?: string;
  tone?: "dark" | "light";
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );

  const toggle = () => {
    if (!audio.current) {
      const a = new Audio(`/audio/${line}.m4a`);
      a.addEventListener("ended", () => setPlaying(false));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("play", () => setPlaying(true));
      audio.current = a;
    }
    const a = audio.current;
    if (playing) return a.pause();
    if (current && current !== a) current.pause();
    current = a;
    a.currentTime = 0;
    void a.play().catch(() => setPlaying(false));
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-0 py-1 pr-3.5 pl-1 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        tone === "dark" ? "bg-[#0b0b0c] text-white hover:bg-[#26262a]" : "bg-mist text-ink",
      )}
      onClick={toggle}
      aria-pressed={playing}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center rounded-full bg-highlight text-white",
          playing && "shadow-[0_0_0_4px_var(--highlight-tint)]",
        )}
      >
        {playing ? (
          <span className="inline-flex h-3 items-center gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <i
                key={i}
                className="h-full w-0.5 rounded-[1px] bg-white motion-safe:animate-eq"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
          </svg>
        )}
      </span>
      {playing ? "Playing" : label}
    </button>
  );
}
