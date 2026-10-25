// First run, signed out: what Tandrix does on the phone, in a few lines, then sign in.
import { space, type IconName } from "@tandrix/ui";
import { Button, Icon, Text } from "@tandrix/ui/native";
import { Redirect, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useWelcomeSeen, WELCOME_SEEN as SEEN } from "@/lib/welcome";

const points: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "camera",
    title: "Point your camera at the work",
    body: "Tandrix writes the steps for what you're building or fixing, and marks the right part on the real thing.",
  },
  {
    icon: "check",
    title: "It checks your work",
    body: "Take a photo when a step is done. Tandrix says whether it looks right, and why.",
  },
  {
    icon: "mic",
    title: "Hands busy? Just ask",
    body: "Ask out loud and hear the answer. Safety checks come before anything risky.",
  },
  {
    icon: "laptop",
    title: "Software too? Use your Mac",
    body: "Tandrix on the Mac points at what to click, and picks up where the phone leaves off.",
  },
];

export default function Welcome() {
  const seen = useWelcomeSeen();
  if (seen === undefined) return null;
  if (seen) return <Redirect href="/sign-in" />;

  const start = async () => {
    await SecureStore.setItemAsync(SEEN, "1").catch(() => undefined);
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space["space-6"],
          gap: space["space-8"],
          justifyContent: "center",
        }}
      >
        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-32">Tandrix</Text>
          <Text variant="field-body" color="text-secondary">
            An AI engineer at your side for real-world work.
          </Text>
        </View>
        <View style={{ gap: space["space-6"] }}>
          {points.map((p) => (
            <View key={p.title} style={{ flexDirection: "row", gap: space["space-4"] }}>
              <Icon name={p.icon} size={24} />
              <View style={{ flex: 1, gap: space["space-1"] }}>
                <Text variant="heading-16">{p.title}</Text>
                <Text variant="copy-14" color="text-secondary">
                  {p.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ gap: space["space-3"] }}>
          <Button variant="primary" block size="field" onPress={start} testID="get-started">
            Get started
          </Button>
          <Text variant="copy-13" color="text-tertiary">
            Tandrix asks for the camera and microphone when you first use them.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
