// Sign in a Mac: scan the QR the Mac shows (or open its link from the camera app, or type the
// code), check which Mac it is, and approve it.
import { normalizePairingCode, PairingCode } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { ActionCard, Button, Input, Notice, Text } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { codeFromScan } from "@/lib/pairing";

type Phase =
  | { kind: "find" }
  | { kind: "checking" }
  | { kind: "confirm"; code: string; deviceName: string }
  | { kind: "approving"; code: string; deviceName: string }
  | { kind: "done"; deviceName: string };

const NOT_FOUND =
  "That code didn't work. It may have run out: your Mac shows a new one every two minutes.";

export default function Pair() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: "find" });
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string>();
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const check = useCallback(async (raw: string) => {
    const parsed = PairingCode.safeParse(raw);
    if (!parsed.success) return setProblem("Enter the 8-character code your Mac shows.");
    setProblem(undefined);
    setPhase({ kind: "checking" });
    try {
      const found = await api.lookupPairing(parsed.data);
      setPhase({ kind: "confirm", code: parsed.data, deviceName: found.deviceName });
    } catch (e) {
      scanned.current = false;
      setProblem(e instanceof ApiError && e.status === 404 ? NOT_FOUND : (e as Error).message);
      setPhase({ kind: "find" });
    }
  }, []);

  // Opened from the Mac's QR with the phone's camera app.
  useEffect(() => {
    if (params.code) void check(params.code);
  }, [params.code, check]);

  const approve = async (code: string, deviceName: string) => {
    setPhase({ kind: "approving", code, deviceName });
    try {
      const r = await api.approvePairing(code);
      setPhase({ kind: "done", deviceName: r.deviceName });
    } catch (e) {
      setProblem(e instanceof ApiError && e.status === 404 ? NOT_FOUND : (e as Error).message);
      setPhase({ kind: "find" });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-6"] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {problem ? (
          <Notice tone="error" testID="pair-problem">
            {problem}
          </Notice>
        ) : null}

        {phase.kind === "find" || phase.kind === "checking" ? (
          <>
            <Text variant="copy-14" color="text-secondary">
              Open Tandrix on your Mac and scan the code it shows.
            </Text>
            {permission?.granted ? (
              <View style={{ height: 280, borderRadius: 12, overflow: "hidden" }}>
                <CameraView
                  testID="pair-scanner"
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data }) => {
                    if (scanned.current) return;
                    const code = codeFromScan(data);
                    if (!code) return setProblem("That isn't a Tandrix sign-in code.");
                    scanned.current = true;
                    void check(code);
                  }}
                />
              </View>
            ) : permission?.canAskAgain !== false ? (
              <Button variant="secondary" size="lg" icon="camera" onPress={requestPermission}>
                Allow camera to scan
              </Button>
            ) : (
              <Notice testID="pair-no-camera">
                The camera is off for Tandrix, so it can't scan. Enter the code instead, or turn the
                camera on in Settings.
              </Notice>
            )}
            <View style={{ gap: space["space-3"] }}>
              <Input
                testID="pair-code"
                label="Or enter the code"
                value={typed}
                onChangeText={(v) => setTyped(normalizePairingCode(v).slice(0, 8))}
                placeholder="K7P4QXJ9"
                autoCapitalize="characters"
                mono
                returnKeyType="go"
                onSubmitEditing={() => void check(typed)}
              />
              <Button
                variant="primary"
                block
                disabled={phase.kind === "checking" || typed.length !== 8}
                onPress={() => void check(typed)}
                testID="pair-continue"
              >
                {phase.kind === "checking" ? "Checking…" : "Continue"}
              </Button>
            </View>
          </>
        ) : phase.kind === "confirm" || phase.kind === "approving" ? (
          <ActionCard
            testID="pair-confirm"
            icon="laptop"
            title={`Sign in ${phase.deviceName}?`}
            body="It will see and change your Tandrix jobs. Only approve a Mac you're using right now."
            actionLabel={phase.kind === "approving" ? "Signing in…" : "Sign in this Mac"}
            actionTestID="pair-approve"
            onAction={() =>
              phase.kind === "confirm" ? void approve(phase.code, phase.deviceName) : undefined
            }
            secondaryLabel="Cancel"
            onSecondary={() => router.back()}
          />
        ) : (
          <View style={{ gap: space["space-4"] }} testID="pair-done">
            <Text variant="heading-18">{phase.deviceName} is signed in</Text>
            <Text variant="copy-14" color="text-secondary">
              Your jobs are on your Mac now. You can sign it out from there.
            </Text>
            <Button variant="primary" block onPress={() => router.back()} testID="pair-back">
              Back to jobs
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
