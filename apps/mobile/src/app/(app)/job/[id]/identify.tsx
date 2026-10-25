// Read the nameplate, then let the user confirm or correct the details before saving.
import { NAMEPLATE_CONFIDENT, type IdentifyAssetResponse } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Input, Notice, Text, useTheme, type NoticeTone } from "@tandrix/ui/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "@/lib/api";

export default function Identify() {
  const { id, evidenceId } = useLocalSearchParams<{ id: string; evidenceId: string }>();
  const t = useTheme();
  const [result, setResult] = useState<IdentifyAssetResponse>();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .identifyAsset(id, evidenceId)
      .then((r) => {
        if (!live) return;
        setResult(r);
        if (r.status === "read") {
          setMake(r.reading.make ?? "");
          setModel(r.reading.model ?? "");
          setSerial(r.reading.serial ?? "");
        }
      })
      .catch((e: Error) => {
        if (live)
          setResult({ status: "unavailable", reason: "model_unavailable", message: e.message });
      });
    return () => {
      live = false;
    };
  }, [id, evidenceId]);

  const reading = result?.status === "read" ? result.reading : undefined;
  const confident = !!reading && reading.confidence >= NAMEPLATE_CONFIDENT;

  const save = async () => {
    if (!make.trim() || !model.trim()) return setError("Enter the make and the model.");
    const edited =
      !!reading &&
      (make.trim() !== (reading.make ?? "") ||
        model.trim() !== (reading.model ?? "") ||
        serial.trim() !== (reading.serial ?? ""));
    setSaving(true);
    setError(undefined);
    try {
      await api.saveAsset(id, {
        make: make.trim(),
        model: model.trim(),
        ...(serial.trim() ? { serial: serial.trim() } : {}),
        nameplateEvidenceId: evidenceId,
        source: !reading ? "manual" : edited ? "model_edited" : "model",
        ...(reading ? { confidence: reading.confidence } : {}),
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (!result) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space["space-3"] }}
      >
        <Stack.Screen options={{ title: "Equipment" }} />
        <ActivityIndicator color={t.color["text-secondary"]} />
        <Text variant="field-body" color="text-secondary">
          Reading the nameplate
        </Text>
      </View>
    );
  }

  // Green means verified only, so a confident reading is info, an unsure one needs attention.
  const banner: { tone: NoticeTone; text: string } =
    result.status === "unavailable"
      ? { tone: "neutral", text: result.message }
      : confident
        ? { tone: "info", text: "Read from the nameplate. Check the details, then save." }
        : { tone: "attention", text: "Possible match. Check these against the nameplate." };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Equipment" }} />
      <ScrollView
        contentContainerStyle={{ padding: space["space-6"], gap: space["space-4"] }}
        keyboardShouldPersistTaps="handled"
      >
        <Notice tone={banner.tone} testID="identify-banner">
          {banner.text}
        </Notice>
        <Input
          testID="asset-make"
          label="Make"
          value={make}
          onChangeText={setMake}
          placeholder="FlowSet"
          autoCapitalize="words"
          maxLength={120}
        />
        <Input
          testID="asset-model"
          label="Model"
          value={model}
          onChangeText={setModel}
          placeholder="CR 3-10 A-A-A-E"
          mono
          autoCapitalize="characters"
          maxLength={120}
        />
        <Input
          testID="asset-serial"
          label="Serial number"
          hint="Optional"
          value={serial}
          onChangeText={setSerial}
          mono
          autoCapitalize="characters"
          maxLength={120}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button variant="primary" block disabled={saving} onPress={save} testID="save-asset">
          {saving ? "Saving…" : "Save equipment"}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
