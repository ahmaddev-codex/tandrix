import { nativeFontNames, useTheme } from "@tandrix/ui/native";
import { Stack } from "expo-router";
import { isLocal } from "@/lib/env";
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
      <Stack.Screen name="pair" options={{ title: "Sign in a Mac", presentation: "modal" }} />
      <Stack.Screen name="job/[id]/index" options={{ title: "Project" }} />
      <Stack.Screen name="job/[id]/identify" options={{ title: "Equipment" }} />
      <Stack.Screen
        name="job/[id]/capture"
        options={{ title: "Add photo", presentation: "fullScreenModal" }}
      />
      <Stack.Protected guard={isLocal}>
        <Stack.Screen name="gallery" options={{ title: "Design system" }} />
      </Stack.Protected>
    </Stack>
  );
}
