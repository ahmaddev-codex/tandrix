import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "../scripts/build-tokens";
import { colors, contrastRatio, resolveTheme, themeNames, type ColorToken } from "../src";

const root = join(__dirname, "..");
const tokensJson = readFileSync(join(root, "tokens/tokens.json"), "utf8");
// docs/ stays on the machine it was written on, so a clean checkout has no mirror to compare.
const mirrorPath = join(root, "../../docs/design/system/tokens.json");

describe("generated tokens", () => {
  it("are up to date with tokens.json", () => {
    const { ts, css } = compile(JSON.parse(tokensJson));
    expect(readFileSync(join(root, "src/generated/tokens.ts"), "utf8")).toBe(ts);
    expect(readFileSync(join(root, "src/generated/tokens.css"), "utf8")).toBe(css);
  });

  it.skipIf(!existsSync(mirrorPath))("match the design system mirror in docs/design/system", () => {
    const mirror = readFileSync(mirrorPath, "utf8");
    expect(JSON.parse(tokensJson)).toEqual(JSON.parse(mirror));
  });
});

describe("contrast", () => {
  const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  const pairs: Array<[ColorToken, ColorToken, number]> = [];
  for (const bg of ["background-100", "background-200", "gray-100"] as const) {
    pairs.push(["text", bg, 4.5], ["text-secondary", bg, 4.5], ["text-tertiary", bg, 4.5]);
  }
  for (const bg of ["background-100", "background-200"] as const) {
    pairs.push(
      ["border-control", bg, 3],
      ["focus-ring", bg, 3],
      ["link", bg, 4.5],
      ["green-900", bg, 4.5],
      ["amber-900", bg, 4.5],
      ["red-900", bg, 4.5],
    );
  }
  for (const c of ["blue", "green", "amber", "red"] as const) {
    pairs.push([`${c}-900`, `${c}-100`, 4.5], [`on-${c}`, `${c}-700`, 4.5]);
  }
  pairs.push(
    ["on-primary", "primary", 4.5],
    ["ink-on-paper", "surface-paper", 4.5],
    ["ink-on-paper-secondary", "surface-paper", 4.5],
    ["ink-on-surface", "surface-ink", 4.5],
    ["ink-on-surface-secondary", "surface-ink", 4.5],
    ["toggle-thumb", "gray-600", 3],
    ["toggle-thumb", "blue-700", 3],
    ["overlay-ink", "overlay-ground", 7],
    ["overlay-warn", "overlay-ground", 7],
    ["overlay-focus", "overlay-ground", 3],
    ["lens-ink", "lens-ground", 7],
    ["lens-accent", "lens-ground", 7],
  );

  for (const theme of themeNames) {
    it(`meets minimums in ${theme}`, () => {
      const failures = pairs
        .map(([fg, bg, min]) => {
          const need = theme === "sunlight" && min === 4.5 ? 7 : min;
          const a = colors[theme][fg];
          const b = colors[theme][bg];
          if (!isHex(a) || !isHex(b)) throw new Error(`Non-hex pair ${fg}/${bg}`);
          const r = contrastRatio(a, b);
          return r < need ? `${fg} on ${bg}: ${r.toFixed(2)} < ${need}` : null;
        })
        .filter(Boolean);
      expect(failures).toEqual([]);
    });
  }
});

describe("resolveTheme", () => {
  it("prefers an explicit choice", () => {
    expect(resolveTheme({ scheme: "dark", override: "light", ambientLux: 50_000 })).toBe("light");
  });
  it("switches to sunlight in bright light", () => {
    expect(resolveTheme({ scheme: "dark", ambientLux: 20_000 })).toBe("sunlight");
  });
  it("follows the OS scheme otherwise", () => {
    expect(resolveTheme({ scheme: "dark" })).toBe("dark");
    expect(resolveTheme({ scheme: null, ambientLux: 300 })).toBe("light");
  });
});
