import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { nativeFontNames, ThemeProvider, useTheme } from "@tandrix/ui/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

// Each weight is its own family on React Native; names come from @tandrix/ui.
const fonts = {
  [nativeFontNames.sans[400]]: Geist_400Regular,
  [nativeFontNames.sans[500]]: Geist_500Medium,
  [nativeFontNames.sans[600]]: Geist_600SemiBold,
  [nativeFontNames.sans[700]]: Geist_700Bold,
  [nativeFontNames.mono[400]]: GeistMono_400Regular,
  [nativeFontNames.mono[500]]: GeistMono_500Medium,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Navigator ready={fontsLoaded || !!fontError} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator({ ready }: { ready: boolean }) {
  const { session } = useAuth();
  const t = useTheme();
  const loaded = ready && session !== undefined;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  return (
    <>
      <StatusBar style={t.name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.color["background-100"] },
          headerTintColor: t.color.text,
          headerTitleStyle: { fontFamily: nativeFontNames.sans[600] },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.color["background-200"] },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          {/* First run: what Tandrix does, then sign in (welcome skips itself once seen). */}
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
