// Platform-neutral definitions shared by the web and native components.
import { colors, type ThemeName } from "./generated/tokens";

// Icons: 24-unit grid, 1.5 stroke, round caps and joins (Lucide-compatible geometry).
export const iconPaths = {
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5"],
  alert: ["M12 3.5l9.5 16.5h-19z", "M12 10v4", "M12 17.2v.1"],
  eyeOff: [
    "M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z",
    "M12 14.5a2.5 2.5 0 1 0 0-5",
    "M4 20L20 4",
  ],
  stop: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5.6 5.6l12.8 12.8"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3 2"],
  progress: ["M12 3a9 9 0 1 1-9 9"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.8v.1"],
  book: [
    "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z",
    "M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3",
  ],
  video: ["M3 7h12v10H3z", "M15 10.5l6-3.5v10l-6-3.5"],
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"],
  monitor: ["M3 4h18v12H3z", "M8 20h8", "M12 16v4"],
  file: ["M6 3h8l4 4v14H6z", "M14 3v4h4", "M9 12h6", "M9 16h6"],
  mic: [
    "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z",
    "M5.5 11a6.5 6.5 0 0 0 13 0",
    "M12 17.5V21",
  ],
  power: ["M12 3v8", "M6.6 6.6a8 8 0 1 0 10.8 0"],
  gauge: ["M4 15a8 8 0 1 1 16 0", "M12 15l4-5"],
  arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
  retake: ["M4 12a8 8 0 1 0 2.3-5.6", "M4 4v4.5h4.5"],
  glasses: [
    "M2.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z",
    "M14.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z",
    "M9.5 12.5c1.5-1 3.5-1 5 0",
    "M2.5 12L4 6h3",
    "M21.5 12L20 6h-3",
  ],
  laptop: ["M4.5 5h15v10h-15z", "M2.5 19h19"],
  phone: ["M7.5 3h9v18h-9z", "M11 18h2"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  pointer: ["M5 3l5 16 2.5-6.5L19 10z"],
  hand: [
    "M9 11V5.5a1.5 1.5 0 0 1 3 0V11",
    "M12 10V4.5a1.5 1.5 0 0 1 3 0V11",
    "M15 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.3-2.8L3 14.5a1.6 1.6 0 0 1 2.5-2L9 15V8a1.5 1.5 0 0 1 3 0",
  ],
} as const satisfies Record<string, readonly string[]>;
export type IconName = keyof typeof iconPaths;

export type StepStatus =
  "verified" | "confirmed" | "attention" | "unverifiable" | "blocked" | "pending" | "progress";

export const statusMeta: Record<StepStatus, { icon: IconName; label: string }> = {
  verified: { icon: "check", label: "Verified" },
  confirmed: { icon: "user", label: "You confirmed" },
  attention: { icon: "alert", label: "Needs attention" },
  unverifiable: { icon: "eyeOff", label: "Can't check from a photo" },
  blocked: { icon: "stop", label: "Blocked" },
  pending: { icon: "clock", label: "Pending" },
  progress: { icon: "progress", label: "In progress" },
};

export type SourceKind = "manual" | "expert" | "generic" | "screen" | "photo";
export const sourceIcon: Record<SourceKind, IconName> = {
  manual: "book",
  expert: "video",
  generic: "file",
  screen: "monitor",
  photo: "camera",
};
export const genericSourceLabel = "Generic, not from the manufacturer";

export type PartStatus = "found" | "possible" | "missing";
export const partStatusMeta: Record<
  PartStatus,
  { icon: IconName; label: string; chip: StepStatus }
> = {
  found: { icon: "check", label: "Found", chip: "verified" },
  possible: { icon: "alert", label: "Possible match", chip: "attention" },
  missing: { icon: "stop", label: "Missing", chip: "blocked" },
};

export type CheckOutcome = "pass" | "fail" | "not_verifiable";
export const checkMeta: Record<CheckOutcome, { icon: IconName; title: string }> = {
  pass: { icon: "check", title: "Looks right" },
  fail: { icon: "alert", title: "Needs attention" },
  not_verifiable: { icon: "eyeOff", title: "Can't check this from a photo" },
};

export type ControlMode = "show" | "do";

/**
 * Picks the theme for a surface. An explicit user choice wins; otherwise the phone switches to
 * `sunlight` above the ambient-light threshold, and everything else follows the OS scheme.
 */
export const SUNLIGHT_LUX_THRESHOLD = 10_000;
export function resolveTheme(input: {
  scheme: "light" | "dark" | null | undefined;
  override?: ThemeName | "system";
  ambientLux?: number | null;
}): ThemeName {
  if (input.override && input.override !== "system") return input.override;
  if (input.ambientLux != null && input.ambientLux >= SUNLIGHT_LUX_THRESHOLD) return "sunlight";
  return input.scheme === "dark" ? "dark" : "light";
}

export function palette(theme: ThemeName) {
  return colors[theme];
}

/** WCAG 2 contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
