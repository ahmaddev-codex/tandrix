// Sign in a Mac: scan the QR the Mac shows (or open its link from the camera app, or type the
// code), check which Mac it is, and approve it.
import { normalizePairingCode, PairingCode } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Icon, Input, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
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
  const t = useTheme();
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
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"], flexGrow: 1 }}
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
            {permission?.granted ? (
              <View
                style={{
                  height: 188,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: t.color["gray-100"],
                }}
              >
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
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: space["space-3"],
                    right: space["space-3"],
                    bottom: space["space-3"],
                    padding: space["space-2"],
                    borderRadius: 12,
                    backgroundColor: t.color["overlay-scrim"],
                  }}
                >
                  <Text variant="label-13" color="overlay-ink">
                    Point at the code on your Mac
                  </Text>
                </View>
              </View>
            ) : permission?.canAskAgain !== false ? (
              <View
                style={{
                  minHeight: 104,
                  borderRadius: 20,
                  padding: space["space-4"],
                  alignItems: "center",
                  justifyContent: "center",
                  gap: space["space-2"],
                  backgroundColor: t.color["background-100"],
                  borderWidth: 1,
                  borderColor: t.color.border,
                }}
              >
                <Icon name="camera" color="text-secondary" />
                <Button variant="secondary" size="md" onPress={requestPermission}>
                  Turn on camera
                </Button>
              </View>
            ) : (
              <Notice testID="pair-no-camera">Camera off. Enter the code from your Mac.</Notice>
            )}
            {phase.kind === "checking" ? (
              <ProgressState label="Checking the code" testID="pair-checking" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space["space-2"] }}>
                <View style={{ flex: 1 }}>
                  <Input
                    testID="pair-code"
                    label="Code from Mac"
                    value={typed}
                    onChangeText={(v) => setTyped(normalizePairingCode(v).slice(0, 8))}
                    placeholder="K7P4QXJ9"
                    autoCapitalize="characters"
                    mono
                    returnKeyType="go"
                    onSubmitEditing={() => void check(typed)}
                  />
                </View>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={typed.length !== 8}
                  onPress={() => void check(typed)}
                  testID="pair-continue"
                >
                  Continue
                </Button>
              </View>
            )}
          </>
        ) : phase.kind === "confirm" || phase.kind === "approving" ? (
          <View
            testID="pair-confirm"
            style={{
              alignItems: "center",
              gap: space["space-3"],
              padding: space["space-5"],
              borderRadius: 20,
              backgroundColor: t.color["background-100"],
              borderWidth: 1,
              borderColor: t.color.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.color["blue-100"],
              }}
            >
              <Icon name="laptop" color="blue-900" />
            </View>
            <Text variant="heading-18" style={{ textAlign: "center" }}>
              Sign in {phase.deviceName}?
            </Text>
            <Text variant="copy-13" color="text-secondary" style={{ textAlign: "center" }}>
              It can access your projects. Only approve a Mac you’re using.
            </Text>
            <Button
              variant="primary"
              block
              disabled={phase.kind === "approving"}
              onPress={() =>
                phase.kind === "confirm" ? void approve(phase.code, phase.deviceName) : undefined
              }
              testID="pair-approve"
            >
              {phase.kind === "approving" ? "Signing in…" : "Approve this Mac"}
            </Button>
            <Button variant="tertiary" size="md" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: space["space-3"] }} testID="pair-done">
            <Text variant="heading-18">{phase.deviceName} is signed in</Text>
            <Text variant="copy-13" color="text-secondary" style={{ textAlign: "center" }}>
              Your projects are ready on your Mac.
            </Text>
            <Button variant="primary" block onPress={() => router.back()} testID="pair-back">
              Done
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
