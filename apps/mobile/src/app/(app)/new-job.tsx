import { space } from "@tandrix/ui";
import { Button, Input, Text } from "@tandrix/ui/native";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "@/lib/api";

export default function NewJob() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) return setError("Give the job a name, like Pump P-100 assembly.");
    setBusy(true);
    setError(undefined);
    try {
      await api.createJob({ title: title.trim(), surface: "phone" });
      router.back();
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
          Name the job after the equipment and the work. Next you'll point the camera at its
          nameplate.
        </Text>
        <Input
          testID="job-title"
          label="Job name"
          value={title}
          onChangeText={setTitle}
          placeholder="Pump P-100 assembly"
          autoFocus
          maxLength={160}
          returnKeyType="done"
          onSubmitEditing={create}
          error={error}
        />
        <Button variant="primary" block disabled={busy} onPress={create} testID="create-job">
          {busy ? "Creating…" : "Create job"}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
