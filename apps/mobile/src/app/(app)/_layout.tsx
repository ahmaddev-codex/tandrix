import { nativeFontNames, useTheme } from "@tandrix/ui/native";
import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { BackPill } from "@/components/back-pill";
import { MobileBottomNav, TAB_ROUTES } from "@/components/mobile-bottom-nav";
import { useOfflineSync } from "@/offline";

export default function AppLayout() {
  const t = useTheme();
  // Work done offline is sent from here, for every screen.
  useOfflineSync();
  const pathname = usePathname();
  return (
    <View style={{ flex: 1, backgroundColor: t.color["background-100"] }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.color["background-100"] },
          headerTintColor: t.color.text,
          headerTitleStyle: { fontFamily: nativeFontNames.sans[500] },
          headerShadowVisible: false,
          // A grey pill with dark text instead of the system's blue chevron and title.
          headerBackVisible: false,
          headerLeft: ({ canGoBack }) => (canGoBack ? <BackPill /> : null),
          // iOS 26 wraps header items in its own glass; the grey pill is the button on its own.
          unstable_headerLeftItems: ({ canGoBack }) =>
            canGoBack ? [{ type: "custom", element: <BackPill />, hidesSharedBackground: true }] : [],
          contentStyle: { backgroundColor: t.color["background-200"] },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Tandrix", animation: "fade" }} />
        <Stack.Screen name="actions" options={{ title: "Actions", animation: "fade" }} />
        <Stack.Screen name="projects" options={{ title: "Projects", animation: "fade" }} />
        <Stack.Screen name="new-job" options={{ title: "New project" }} />
        {/* Signing in a Mac is a sheet over the screen you came from, not a new page. */}
        <Stack.Screen
          name="pair"
          options={{
            title: "Sign in a Mac",
            presentation: "formSheet",
            // Compact; it grows when the keyboard opens for the code.
            sheetAllowedDetents: [0.62, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
        <Stack.Screen name="settings" options={{ title: "Settings", animation: "fade" }} />
        <Stack.Screen name="job/[id]/index" options={{ title: "Project" }} />
        <Stack.Screen name="job/[id]/identify" options={{ title: "Equipment" }} />
        <Stack.Screen
          name="job/[id]/capture"
          options={{ title: "Add photo", presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="job/[id]/step/[stepId]"
          options={{ animation: "slide_from_right", animationTypeForReplace: "push" }}
        />
      </Stack>
      {/* One tab bar over the tab screens, so it stays put while they change underneath it. */}
      {TAB_ROUTES.includes(pathname) ? <MobileBottomNav /> : null}
    </View>
  );
}
