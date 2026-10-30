"use client";
// Plays a line in Tandrix's real voice (recorded from the product's own speech). One line at a time
// across the page: starting one stops any other.
import { useEffect, useRef, useState } from "react";
import styles from "./HearIt.module.css";

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
      className={`${styles.btn} ${styles[tone]} ${playing ? styles.on : ""}`}
      onClick={toggle}
      aria-pressed={playing}
    >
      <span className={styles.icon} aria-hidden="true">
        {playing ? (
          <span className={styles.bars}>
            <i />
            <i />
            <i />
            <i />
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
