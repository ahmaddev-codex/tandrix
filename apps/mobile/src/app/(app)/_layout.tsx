import { nativeFontNames, useTheme } from "@tandrix/ui/native";
import { Stack } from "expo-router";
import { useOfflineSync } from "@/offline";

export default function AppLayout() {
  const t = useTheme();
  // Work done offline is sent from here, for every screen.
  useOfflineSync();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.color["background-100"] },
        headerTintColor: t.color.text,
        headerTitleStyle: { fontFamily: nativeFontNames.sans[600] },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.color["background-200"] },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Tandrix" }} />
      <Stack.Screen name="actions" options={{ title: "Actions" }} />
      <Stack.Screen name="projects" options={{ title: "Projects" }} />
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
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
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
  );
}
