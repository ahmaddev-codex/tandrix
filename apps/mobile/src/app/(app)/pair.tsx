// Sign in a Mac: scan the QR the Mac shows (or open its link from the camera app, or type the
// code), check which Mac it is, and approve it.
import { normalizePairingCode, PairingCode } from "@tandrix/contracts";
import { colors, space } from "@tandrix/ui";
import { Button, Icon, Input, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
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

const previewQr = [
  "000000000000000000000000000000000",
  "000000000000000000000000000000000",
  "001111111000101111000010111111100",
  "001000001000010111101010100000100",
  "001011101010001101001110101110100",
  "001011101010011011011010101110100",
  "001011101010001001100100101110100",
  "001000001011001000000010100000100",
  "001111111010101010101010111111100",
  "000000000010011010101100000000000",
  "001011111000110000100100111110000",
  "000011010010010111000011111101100",
  "001111101010010111101011111000000",
  "001011000110011101000010001101100",
  "001111101011011011000110000110100",
  "001001010001001001110100111001100",
  "001100101100100000001011001010000",
  "000010000100001010101011101100000",
  "000111101011101000100001010011000",
  "001110000011010111011110111011100",
  "001000111011001111111000110100000",
  "001010100111100101001010110101000",
  "001010011111011011011011111110000",
  "000000000011100001110010001010100",
  "001111111001010000001110101000000",
  "001000001011011010100110001001000",
  "001011101011111000101011111110100",
  "001011101010111111011110000010000",
  "001011101010010001110111101011000",
  "001000001001011101011011010001000",
  "001111111011010111000100110010000",
  "000000000000000000000000000000000",
  "000000000000000000000000000000000",
];
const qrSize = previewQr.length;
const previewQrPath = previewQr
  .flatMap((row, y) => [...row].map((on, x) => (on === "1" ? `M${x} ${y}h1v1h-1z` : "")))
  .join("");

function MacQrMark() {
  const paper = colors.light;
  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
        style={{
          width: 216,
          height: 190,
          padding: 9,
          borderWidth: 1,
          borderColor: paper.border,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: paper["background-100"],
        }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <View
            style={{
              width: 118,
              height: 118,
              padding: 6,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: paper["background-100"],
            }}
          >
            <Svg
              width={106}
              height={106}
              viewBox={`0 0 ${qrSize} ${qrSize}`}
              accessibilityLabel="Example Tandrix QR code"
              accessibilityRole="image"
            >
              <Path d={previewQrPath} fill={paper.text} />
            </Svg>
          </View>
        </View>
        <Text
          variant="mono-12"
          color="text"
          style={{ fontSize: 13, lineHeight: 17, color: paper.text }}
        >
          K7P4-QXJ9
        </Text>
        <Text
          variant="label-12"
          color="text-secondary"
          style={{ fontSize: 9, lineHeight: 12, color: paper["text-tertiary"] }}
        >
          New code in 1:59
        </Text>
      </View>
      <View
        style={{
          width: 244,
          height: 8,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          backgroundColor: paper.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{ width: 42, height: 2, borderRadius: 2, backgroundColor: paper["gray-500"] }}
        />
      </View>
    </View>
  );
}

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
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        // In the sheet the header floats over the content: start below it.
        contentInsetAdjustmentBehavior="automatic"
      >
        {problem ? (
          <Notice tone="error" testID="pair-problem">
            {problem}
          </Notice>
        ) : null}

        {phase.kind === "find" || phase.kind === "checking" ? (
          <View
            style={{
              height: 270,
              borderRadius: 20,
              backgroundColor: t.color["gray-100"],
              borderWidth: 1,
              borderColor: t.color.border,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {permission?.granted ? (
              <CameraView
                testID="pair-scanner"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
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
            ) : permission?.canAskAgain !== false ? (
              <View
                style={{
                  position: "absolute",
                  bottom: space["space-3"],
                  alignItems: "center",
                  gap: space["space-2"],
                }}
              >
                <Icon name="camera" color="text-secondary" />
                <Button variant="secondary" size="md" onPress={requestPermission}>
                  Turn on camera
                </Button>
              </View>
            ) : null}
            <View pointerEvents="none" style={{ alignItems: "center" }}>
              <MacQrMark />
            </View>
            {permission?.canAskAgain === false && !permission.granted ? (
              <View style={{ position: "absolute", bottom: space["space-3"] }}>
                <Notice testID="pair-no-camera">Camera off. Enter the code below.</Notice>
              </View>
            ) : null}
          </View>
        ) : null}
        {phase.kind === "find" || phase.kind === "checking" ? (
          <>
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
                  style={{ alignSelf: "flex-end" }}
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
