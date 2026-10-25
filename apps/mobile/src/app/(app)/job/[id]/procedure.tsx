// Write the job's steps. Reading a whole manual takes a while, so the screen says what is
// happening as time passes, and offers a retry when the model can't help.
import { space } from "@tandrix/ui";
import { ProgressState } from "@tandrix/ui/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
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
    <View style={{ flex: 1, justifyContent: "center", padding: space["space-6"] }}>
      <Stack.Screen options={{ title: "Steps" }} />
      <ProgressState
        testID="procedure"
        label={message}
        {...(failure ? { failed: failure } : {})}
        onRetry={() => setAttempt((n) => n + 1)}
        backLabel="Back to the project"
        onBack={() => router.back()}
      />
    </View>
  );
}
