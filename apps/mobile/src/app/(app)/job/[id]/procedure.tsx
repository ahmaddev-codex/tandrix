// Write the job's steps. Reading a whole manual takes a while, so the screen says what is
// happening as time passes, and offers a retry when the model can't help.
import { radius, space } from "@tandrix/ui";
import { Button, Icon, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "@/lib/api";

/** What the user sees while waiting, by seconds elapsed. */
const stages: Array<[number, string]> = [
  [0, "Reading the manual"],
  [8, "Writing the steps"],
  [30, "Still writing. Long manuals can take a couple of minutes."],
];
const genericStages: Array<[number, string]> = [
  [0, "Writing general steps"],
  [30, "Still writing. This can take a minute."],
];

export default function ProcedureScreen() {
  const { id, generic } = useLocalSearchParams<{ id: string; generic?: string }>();
  const allowGeneric = generic === "1";
  const t = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    setFailure(undefined);
    setElapsed(0);
    try {
      const r = await api.generateProcedure(id, { allowGeneric });
      if (r.status === "created") router.back();
      else setFailure(r.message);
    } catch (e) {
      setFailure((e as Error).message);
    }
  }, [id, allowGeneric]);

  useEffect(() => {
    run();
  }, [run, attempt]);

  useEffect(() => {
    if (failure) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [failure, attempt]);

  const list = allowGeneric ? genericStages : stages;
  const message = [...list].reverse().find(([at]) => elapsed >= at)![1];

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: space["space-6"],
        gap: space["space-4"],
      }}
    >
      <Stack.Screen options={{ title: "Steps" }} />
      {failure ? (
        <>
          <View
            testID="procedure-unavailable"
            style={{
              flexDirection: "row",
              gap: space["space-2"],
              alignItems: "flex-start",
              padding: space["space-4"],
              borderRadius: radius["radius-lg"],
              backgroundColor: t.color["gray-100"],
            }}
          >
            <Icon name="alert" size={20} />
            <View style={{ flex: 1 }}>
              <Text variant="copy-16">{failure}</Text>
            </View>
          </View>
          <Button
            variant="primary"
            block
            onPress={() => setAttempt((n) => n + 1)}
            testID="retry-procedure"
          >
            Try again
          </Button>
          <Button variant="secondary" block onPress={() => router.back()}>
            Back to the job
          </Button>
        </>
      ) : (
        <View
          testID="procedure-progress"
          accessibilityRole="progressbar"
          accessibilityLabel={message}
          style={{ alignItems: "center", gap: space["space-3"] }}
        >
          <ActivityIndicator color={t.color["text-secondary"]} />
          <Text variant="field-body" color="text-secondary">
            {message}
          </Text>
        </View>
      )}
    </View>
  );
}
