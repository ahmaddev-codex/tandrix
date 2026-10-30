import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme's own names (globals.css @theme), so a later class of the same kind wins over an
// earlier one: `mb-0` over `mb-head`, `bg-ink` over `bg-paper`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["gutter", "frame", "gap", "band", "head"],
      color: [
        "ink",
        "page",
        "paper",
        "mist",
        "line",
        "line-strong",
        "text",
        "text-2",
        "text-3",
        "soft",
        "highlight",
        "highlight-tint",
        "highlight-halo",
        "overlay",
        "overlay-ink",
        "focus",
      ],
    },
  },
});

/** Joins class names, letting a later Tailwind class override an earlier one of the same kind. */
export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));
