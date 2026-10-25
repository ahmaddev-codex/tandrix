// Start a project from one sentence about the goal. Equipment, if there is any, comes next.
import { space } from "@tandrix/ui";
import { Button, Input, Text } from "@tandrix/ui/native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "@/lib/api";
import { exampleGoals } from "@/lib/goals";

export default function NewJob() {
  const params = useLocalSearchParams<{ goal?: string }>();
  const [goal, setGoal] = useState(params.goal ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!goal.trim()) return setError("Say what you're doing, like Assemble a home server rack.");
    setBusy(true);
    setError(undefined);
    try {
      const job = await api.createJob({ title: goal.trim(), surface: "phone" });
      // Straight into the project: its next step is waiting there.
      router.dismiss();
      router.push({ pathname: "/job/[id]", params: { id: job.id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: space["space-6"], gap: space["space-4"] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="field-body" color="text-secondary">
          One sentence is enough. If there's equipment with a nameplate, you can scan it next so the
          steps come from its manual.
        </Text>
        <Input
          testID="job-title"
          label="What are you building or fixing?"
          value={goal}
          onChangeText={setGoal}
          placeholder="Assemble a 12U home server rack"
          autoFocus={!params.goal}
          maxLength={160}
          returnKeyType="done"
          onSubmitEditing={create}
          error={error}
        />
        <Button variant="primary" block disabled={busy} onPress={create} testID="create-job">
          {busy ? "Starting…" : "Start"}
        </Button>
        {!goal ? (
          <View style={{ gap: space["space-2"] }}>
            <Text variant="label-13" color="text-secondary">
              For example
            </Text>
            {exampleGoals.map((g) => (
              <Button key={g} variant="tertiary" size="md" onPress={() => setGoal(g)}>
                {g}
              </Button>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
