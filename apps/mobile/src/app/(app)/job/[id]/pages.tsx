// Photograph a paper manual page by page. Each page uploads as it's taken; "Make manual" combines
// them, in order, into a private PDF.
import { radius, space } from "@tandrix/ui";
import { Button, CaptureView, Icon, Text, useTheme, Notice } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { preparePhoto, uploadPhoto } from "@/lib/evidence";

/** Matches the API's limit for one manual. */
const MAX_PAGES = 60;

export default function Pages() {
  const { id, equipment } = useLocalSearchParams<{ id: string; equipment?: string }>();
  const t = useTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState<string>();

  const usable = permission?.granted && !cameraFailed;
  const full = pages.length >= MAX_PAGES;

  const addPages = async (shots: Array<{ uri: string; width: number; height: number }>) => {
    setError(undefined);
    const room = shots.slice(0, MAX_PAGES - pages.length);
    for (const [i, shot] of room.entries()) {
      setSaving(room.length > 1 ? `Saving page ${i + 1} of ${room.length}` : "Saving the page");
      try {
        const evidence = await uploadPhoto(id, await preparePhoto(shot.uri, shot));
        setPages((p) => [...p, evidence.id]);
      } catch (e) {
        setError((e as Error).message);
        break;
      }
    }
    setSaving(undefined);
  };

  const take = async () => {
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 1, exif: false });
      if (shot) await addPages([shot]);
    } catch {
      setError("Couldn't take the photo. Try again, or choose photos you've already taken.");
    }
  };

  const choose = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: MAX_PAGES - pages.length,
    });
    if (!r.canceled) await addPages(r.assets);
  };

  const make = async () => {
    setSaving("Making the manual");
    setError(undefined);
    try {
      await api.manualFromPhotos(id, {
        evidenceIds: pages,
        title: equipment ? `${equipment} manual (photographed)` : "Photographed manual",
      });
      router.dismissTo({ pathname: "/job/[id]", params: { id } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(undefined);
    }
  };

  const chooseButton = (
    <Button
      variant={usable ? "tertiary" : "secondary"}
      {...(usable ? { size: "lg" as const } : { block: true })}
      disabled={!!saving || full}
      onPress={choose}
      testID="choose-pages"
    >
      Choose photos
    </Button>
  );

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{
        flex: 1,
        padding: space["space-4"],
        gap: space["space-3"],
        backgroundColor: t.color["background-200"],
      }}
    >
      <Stack.Screen options={{ title: "Manual pages" }} />
      {usable ? (
        <CaptureView
          state={saving ? "analyzing" : "live"}
          hint={
            full
              ? "That's the most pages for one manual"
              : "One page at a time, flat and straight on"
          }
          analyzingLabel={saving}
          canCapture={cameraReady && !full}
          onCapture={take}
          secondaryAction={chooseButton}
        >
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => setCameraFailed(true)}
          />
        </CaptureView>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", gap: space["space-4"] }}>
          <Text variant="heading-18">Photograph the pages</Text>
          <Text variant="field-body" color="text-secondary">
            {cameraFailed || (permission && !permission.canAskAgain)
              ? "The camera isn't available. Choose photos of the pages instead, in page order."
              : "Tandrix uses the camera to photograph each page of the manual."}
          </Text>
          {!cameraFailed && permission?.canAskAgain !== false ? (
            <Button variant="primary" block onPress={requestPermission} testID="allow-camera">
              Allow camera
            </Button>
          ) : null}
          {chooseButton}
          {saving ? (
            <Text variant="field-body" color="text-secondary">
              {saving}
            </Text>
          ) : null}
        </View>
      )}

      <View
        testID="page-count"
        accessibilityLabel={`${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space["space-2"],
          padding: space["space-3"],
          borderRadius: radius["radius-md"],
          backgroundColor: t.color["background-100"],
          borderWidth: 1,
          borderColor: t.color.border,
        }}
      >
        <Icon name="file" size={20} color="text-secondary" />
        <Text variant="label-14">
          {pages.length === 0
            ? "No pages yet"
            : `${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
        </Text>
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        variant="primary"
        block
        disabled={!pages.length || !!saving}
        onPress={make}
        testID="make-manual"
      >
        Make manual
      </Button>
    </SafeAreaView>
  );
}
