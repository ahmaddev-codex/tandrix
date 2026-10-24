import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme, type TextStyle } from "react-native";
import {
  colors,
  shadows,
  textStyles,
  type ColorToken,
  type TextStyleName,
  type ThemeName,
} from "../generated/tokens";
import { resolveTheme } from "../shared";

/**
 * Font names the app must register (expo-font) before rendering, e.g.
 *   useFonts({ "Geist-Regular": require(...), ... })
 * React Native picks a face by family name, not by fontWeight, so each weight is its own family.
 */
export const nativeFontNames = {
  sans: { 400: "Geist-Regular", 500: "Geist-Medium", 600: "Geist-SemiBold", 700: "Geist-Bold" },
  mono: {
    400: "GeistMono-Regular",
    500: "GeistMono-Medium",
    600: "GeistMono-Medium",
    700: "GeistMono-Medium",
  },
} as const;

export function nativeTextStyle(name: TextStyleName): TextStyle {
  const s = textStyles[name];
  return {
    fontFamily: nativeFontNames[s.family][s.fontWeight],
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
  };
}

export interface Theme {
  name: ThemeName;
  color: Record<ColorToken, string>;
  shadow: (typeof shadows)[ThemeName];
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** User choice from settings; "system" follows the OS and the light sensor. */
  override?: ThemeName | "system";
  /** Latest ambient light reading, if the app samples the sensor. */
  ambientLux?: number | null;
}

export function ThemeProvider({ children, override = "system", ambientLux }: ThemeProviderProps) {
  const scheme = useColorScheme();
  const name = resolveTheme({ scheme, override, ambientLux });
  const theme = useMemo<Theme>(
    () => ({ name, color: colors[name], shadow: shadows[name] }),
    [name],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme must be used inside <ThemeProvider>");
  return t;
}
