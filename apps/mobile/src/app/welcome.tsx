// First run, signed out: what Tandrix does on the phone, in a few lines, then sign in.
import { space } from "@tandrix/ui";
import { Button, StepCard, Text } from "@tandrix/ui/native";
import { Redirect, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useWelcomeSeen, WELCOME_SEEN as SEEN } from "@/lib/welcome";

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
          gap: space["space-6"],
          justifyContent: "center",
        }}
      >
        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-32">Build it. Fix it. Know what to do next.</Text>
          <Text variant="field-body" color="text-secondary">
            Tandrix reads the manual and guides each step on your phone. On your Mac, it points to
            the control you need in any app.
          </Text>
        </View>
        <StepCard
          index={2}
          total={5}
          title="Fit the Active Cooler"
          body="Line the pins up with the two holes beside the processor. Press both down until they click."
          status="pending"
          statusLabel="Next step"
          source="Manual p.4"
        />
        <Text variant="copy-14" color="text-secondary">
          See the part on camera. Ask by voice while your hands are busy. Take a photo to check your
          work.
        </Text>
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
