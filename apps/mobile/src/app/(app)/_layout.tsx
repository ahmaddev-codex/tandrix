import { nativeFontNames, useTheme } from "@tandrix/ui/native";
import { Stack } from "expo-router";
import { isLocal } from "@/lib/env";

export default function AppLayout() {
  const t = useTheme();
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
      <Stack.Screen name="index" options={{ title: "Jobs" }} />
      <Stack.Screen name="new-job" options={{ title: "New job", presentation: "modal" }} />
      <Stack.Screen name="job/[id]/index" options={{ title: "Job" }} />
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
