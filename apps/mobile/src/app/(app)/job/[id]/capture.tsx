import { space } from "@tandrix/ui";
import { Button, CaptureView, Text, useTheme } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";

type Phase = "live" | "preview" | "saving";

export default function Capture() {
  // purpose=nameplate: after saving, go straight to reading it.
  const { id, purpose } = useLocalSearchParams<{ id: string; purpose?: "nameplate" }>();
  const isNameplate = purpose === "nameplate";
  const t = useTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [photo, setPhoto] = useState<PreparedPhoto>();
  const [error, setError] = useState<string>();

  const usable = permission?.granted && !cameraFailed;

  const take = async () => {
    setError(undefined);
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
    setError(undefined);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setPhoto(await preparePhoto(a.uri, { width: a.width, height: a.height }));
    setPhase("preview");
  };

  const save = async () => {
    if (!photo) return;
    setPhase("saving");
    setError(undefined);
    try {
      const evidence = await uploadPhoto(id, photo);
      if (isNameplate) {
        router.replace({ pathname: "/job/[id]/identify", params: { id, evidenceId: evidence.id } });
      } else {
        router.back();
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("preview");
    }
  };

  const chooseButton = (
    <Button variant="tertiary" size="lg" onPress={choose} testID="choose-photo">
      Choose photo
    </Button>
  );

  // No camera access: explain, offer to fix it, and keep the photo route open.
  if (!usable && phase === "live") {
    const denied = permission && !permission.granted && !permission.canAskAgain;
    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: space["space-6"],
          gap: space["space-4"],
          justifyContent: "center",
        }}
      >
        <Stack.Screen options={{ title: isNameplate ? "Nameplate" : "Add photo" }} />
        <Text variant="heading-24">{cameraFailed ? "No camera available" : "Camera access"}</Text>
        <Text variant="field-body" color="text-secondary">
          {cameraFailed
            ? "This device can't open the camera. Choose a photo you've already taken instead."
            : denied
              ? "Camera access is off for Tandrix. Turn it on in Settings, or choose a photo you've already taken."
              : "Tandrix uses the camera to photograph equipment and check each step."}
        </Text>
        {!cameraFailed && !denied ? (
          <Button variant="primary" block onPress={requestPermission} testID="allow-camera">
            Allow camera
          </Button>
        ) : null}
        {denied ? (
          <Button variant="secondary" block onPress={() => Linking.openSettings()}>
            Open Settings
          </Button>
        ) : null}
        <Button
          variant={cameraFailed || denied ? "primary" : "secondary"}
          block
          onPress={choose}
          testID="choose-photo"
        >
          Choose photo
        </Button>
        {error ? (
          <Text variant="copy-16" color="red-900">
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        padding: space["space-4"],
        gap: space["space-3"],
        backgroundColor: t.color["background-200"],
      }}
    >
      <Stack.Screen options={{ title: isNameplate ? "Nameplate" : "Add photo" }} />
      <CaptureView
        state={phase === "saving" ? "analyzing" : phase}
        hint={
          phase === "live"
            ? isNameplate
              ? "Fill the frame with the nameplate, straight on"
              : "Fill the frame with the part"
            : undefined
        }
        analyzingLabel="Saving the photo"
        useLabel="Use photo"
        canCapture={cameraReady}
        onCapture={take}
        onRetake={() => {
          setPhoto(undefined);
          setPhase("live");
        }}
        onUse={save}
        secondaryAction={chooseButton}
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
          <Image
            source={{ uri: photo.uri }}
            style={{ flex: 1 }}
            contentFit="contain"
            accessibilityLabel="Photo preview"
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </CaptureView>
      {error ? (
        <Text variant="copy-16" color="red-900">
          {error}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
