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
      <Stack.Screen name="new-job" options={{ title: "New project", presentation: "modal" }} />
      <Stack.Screen
        name="pair"
        options={{
          title: "Sign in a Mac",
          presentation: "formSheet",
          sheetAllowedDetents: [0.48, 0.9],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
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
