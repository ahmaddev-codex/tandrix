// The parts check: photograph the laid-out parts, see each one found, possible or missing against
// the parts list, and correct any. Missing parts hold the steps that need them.
import type { Detection, PartSpec, PartsCheck, PartStatus } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import {
  ActionCard,
  Button,
  CaptureView,
  Notice,
  PartHighlight,
  PartsList,
  useTheme,
} from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";

type Phase = "live" | "preview" | "analyzing" | "result";

export default function PartsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [parts, setParts] = useState<PartSpec[]>();
  const [phase, setPhase] = useState<Phase>("live");
  const [photo, setPhoto] = useState<PreparedPhoto>();
  const [check, setCheck] = useState<PartsCheck>();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [asking, setAsking] = useState<PartSpec>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => {
    api
      .getJob(id)
      .then((d) => setParts(d.procedure?.parts ?? []))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const take = async () => {
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 1, exif: false });
      if (!shot) return;
      setPhoto(await preparePhoto(shot.uri, shot));
      setPhase("preview");
    } catch {
      setError("Couldn't take the photo. Try again, or choose one from your photos.");
    }
  };

  const choose = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const a = r.canceled ? undefined : r.assets[0];
    if (!a) return;
    setPhoto(await preparePhoto(a.uri, { width: a.width, height: a.height }));
    setPhase("preview");
  };

  const analyse = async () => {
    if (!photo) return;
    setPhase("analyzing");
    setError(undefined);
    setMessage(undefined);
    try {
      const evidence = await uploadPhoto(id, photo);
      const r = await api.partsCheck(id, evidence.id);
      if (r.status === "checked") {
        setCheck(r.partsCheck);
        setDetections(r.detections);
        setPhase("result");
      } else {
        setMessage(r.status === "no_parts" ? "This job's steps don't list any parts." : r.message);
        setPhase("preview");
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("preview");
    }
  };

  const correct = async (part: PartSpec, status: PartStatus) => {
    if (!check) return;
    setAsking(undefined);
    try {
      const r = await api.correctPart(id, check.id, part.id, status);
      setCheck(r.partsCheck);
      // A corrected part's highlight no longer stands for what's on the photo.
      setDetections((ds) => ds.filter((d) => d.partSpecId !== part.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const retake = () => {
    setPhoto(undefined);
    setCheck(undefined);
    setDetections([]);
    setAsking(undefined);
    setPhase("live");
  };

  const usable = permission?.granted && !cameraFailed;
  const rows =
    check && parts
      ? check.results.map((r) => {
          const p = parts.find((x) => x.id === r.partSpecId)!;
          return {
            ...(p.partNumber ? { part: p.partNumber } : {}),
            name: p.name,
            qty: p.qty,
            status: r.status,
          };
        })
      : [];

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: t.color["background-200"] }}
    >
      <Stack.Screen options={{ title: "Parts" }} />
      <ScrollView contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"] }}>
        {phase === "result" && photo && check ? (
          <View style={{ height: 300 }}>
            <PartHighlight
              testID="parts-highlight"
              size={{ width: photo.width, height: photo.height }}
              alt={`Parts found: ${detections.map((d) => d.label).join(", ") || "none"}`}
              targets={detections.slice(0, 3).map((d) => ({
                id: d.id,
                label: d.label,
                possible:
                  check.results.find((r) => r.partSpecId === d.partSpecId)?.status === "possible",
                box: d.box,
              }))}
            >
              <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="contain" />
            </PartHighlight>
          </View>
        ) : usable || phase !== "live" ? (
          <View style={{ height: 360 }}>
            <CaptureView
              state={phase === "result" ? "preview" : phase}
              hint={
                phase === "live" ? "Lay the parts out flat, apart, and fit them all in" : undefined
              }
              analyzingLabel="Checking the parts against the list"
              useLabel="Check these parts"
              canCapture={cameraReady}
              onCapture={take}
              onRetake={retake}
              onUse={analyse}
              secondaryAction={
                <Button variant="tertiary" size="lg" onPress={choose} testID="choose-photo">
                  Choose photo
                </Button>
              }
            >
              {phase === "live" ? (
                <CameraView
                  ref={camera}
                  style={{ flex: 1 }}
                  facing="back"
                  onCameraReady={() => setCameraReady(true)}
                  onMountError={() => setCameraFailed(true)}
                />
              ) : photo ? (
                <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="contain" />
              ) : null}
            </CaptureView>
          </View>
        ) : (
          <ActionCard
            icon="camera"
            title="Photograph the parts"
            body="Lay the parts out flat and apart, with every part in the photo."
            {...(permission?.canAskAgain !== false && !cameraFailed
              ? {
                  actionLabel: "Allow camera",
                  actionTestID: "allow-camera",
                  onAction: requestPermission,
                  secondaryLabel: "Choose photo",
                  secondaryTestID: "choose-photo",
                  onSecondary: choose,
                }
              : { actionLabel: "Choose photo", actionTestID: "choose-photo", onAction: choose })}
          />
        )}

        {message ? <Notice testID="parts-unavailable">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        {asking ? (
          // A correction is the one thing to answer now.
          <ActionCard
            testID="part-correction"
            title={`Is the ${asking.name.toLowerCase()} here?`}
            body="Check the parts you laid out."
            actionLabel="Yes, it's here"
            actionTestID="part-here"
            onAction={() => correct(asking, "found")}
            secondaryLabel="No, it's missing"
            secondaryTestID="part-missing"
            onSecondary={() => correct(asking, "missing")}
          />
        ) : null}

        {check && parts ? (
          <PartsList
            testID="parts-list"
            parts={rows}
            onSelect={(_row, i) =>
              setAsking(parts.find((p) => p.id === check.results[i]!.partSpecId))
            }
          />
        ) : null}

        {phase === "result" ? (
          <Button variant="secondary" block icon="retake" onPress={retake} testID="retake-parts">
            Check them again
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
