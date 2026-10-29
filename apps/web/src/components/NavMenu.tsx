"use client";
// Section navigation on small screens, where the inline links don't fit.
import { useState } from "react";
import styles from "./NavMenu.module.css";

const links: Array<[string, string]> = [
  ["#what", "What it does"],
  ["#uses", "Uses"],
  ["#how", "How it works"],
  ["#faq", "Questions"],
  ["#get", "Download"],
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={styles.menuWrap}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open ? (
        <nav aria-label="Primary" className={styles.menuPanel}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
