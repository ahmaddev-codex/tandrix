import type { ThemeName } from "@tandrix/ui";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = ThemeName | "system";

interface Preferences {
  theme: ThemePreference;
  ready: boolean;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

const KEY = "tandrix.theme";
const choices: ThemePreference[] = ["system", "light", "dark", "sunlight"];
const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((value) => {
        if (value && choices.includes(value as ThemePreference))
          setThemeState(value as ThemePreference);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setTheme = useCallback(async (value: ThemePreference) => {
    await SecureStore.setItemAsync(KEY, value);
    setThemeState(value);
  }, []);

  return (
    <PreferencesContext.Provider value={{ theme, ready, setTheme }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
