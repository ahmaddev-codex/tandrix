"use client";
// Theme toggle following modern-web-guidance: switches between light and dark, persists only when
// diverging from the OS scheme, and syncs across OS changes and tabs.
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Scheme = "light" | "dark";

function getSystemScheme(): Scheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getRenderedScheme(): Scheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyScheme(stored: Scheme | null) {
  const resolved = stored ?? getSystemScheme();
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? "light dark";
  }
  return resolved;
}

export function ThemeToggle() {
  const [scheme, setScheme] = useState<Scheme>("light");

  useEffect(() => {
    setScheme(getRenderedScheme());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      try {
        const stored = localStorage.getItem("color-scheme");
        if (stored === "light" || stored === "dark") {
          setScheme(stored);
          return;
        }
      } catch {
        // Ignore storage errors
      }
      setScheme(applyScheme(null));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "color-scheme") return;
      const next = e.newValue === "light" || e.newValue === "dark" ? e.newValue : null;
      setScheme(applyScheme(next));
    };

    mq.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = () => {
    const current = getRenderedScheme();
    const target: Scheme = current === "dark" ? "light" : "dark";
    const system = getSystemScheme();
    try {
      if (target === system) {
        localStorage.removeItem("color-scheme");
        setScheme(applyScheme(null));
      } else {
        localStorage.setItem("color-scheme", target);
        setScheme(applyScheme(target));
      }
    } catch {
      setScheme(applyScheme(target));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={styles.toggle}
      aria-label={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <svg
        className={styles.sun}
        viewBox="0 0 20 20"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
      </svg>
      <svg
        className={styles.moon}
        viewBox="0 0 20 20"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15.5 12.8A6.5 6.5 0 0 1 7.2 4.5a6.5 6.5 0 1 0 8.3 8.3Z" />
      </svg>
    </button>
  );
}
