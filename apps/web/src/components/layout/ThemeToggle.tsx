"use client";
// Theme toggle following modern-web-guidance: switches between light and dark, persists only when
// diverging from the OS scheme, and syncs across OS changes and tabs.
import { Icon } from "@tandrix/ui/web";
import { useEffect, useState } from "react";

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
      className="inline-grid size-[38px] cursor-pointer place-items-center rounded-full border-0 bg-gray-100 p-0 text-text transition-colors duration-150 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon name="sun" size={16} weight="outline" className="hidden dark:block" />
      <Icon name="moon" size={16} weight="outline" className="block dark:hidden" />
    </button>
  );
}
