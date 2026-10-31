// Record mode: someone who knows the job does it once. At each moment they take a picture and
// say (or type) what they're doing; Tandrix turns the moments into the project's steps, each one
// citing the moment it came from, with that moment's photo as its reference picture.
import { nextPhrase } from "@tandrix/core";
import { space } from "@tandrix/ui";
import { Button, Icon, Input, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";
import { usePushToTalk } from "@/voice/ptt";

interface Moment {
  photo: PreparedPhoto;
  atSec: number;
  said: string;
}

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export default function Record() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const startedAt = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState("Planning the steps");
  const [problem, setProblem] = useState<string>();

  const usable = permission?.granted && !cameraFailed;
  const last = moments.at(-1);
  const ready = moments.length >= 2 && moments.every((m) => m.said.trim().length > 1);

  useEffect(() => {
    if (!busy) return;
    const recent: string[] = [];
    const timer = setInterval(() => {
      const p = nextPhrase("steps procedure photo", recent);
      recent.push(p);
      setPhrase(p);
    }, 2200);
    return () => clearInterval(timer);
  }, [busy]);

  const add = (photo: PreparedPhoto) => {
    const now = Date.now();
    startedAt.current ??= now;
    setMoments((m) => [...m, { photo, atSec: (now - startedAt.current!) / 1000, said: "" }]);
  };

  const capture = async () => {
    setProblem(undefined);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.8, exif: false });
      if (shot) add(await preparePhoto(shot.uri, shot));
    } catch {
      setProblem("Couldn't take the picture. Try again.");
    }
  };

  const choose = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const a = r.canceled ? undefined : r.assets[0];
    if (a) add(await preparePhoto(a.uri, { width: a.width, height: a.height }));
  };

  /** What was said goes with the latest moment. */
  const setSaid = (i: number, said: string) =>
    setMoments((m) => m.map((x, j) => (j === i ? { ...x, said } : x)));
  const talk = usePushToTalk({
    keywords: [],
    onHeard: (said) => moments.length && setSaid(moments.length - 1, said),
    onProblem: setProblem,
  });

  const write = async () => {
    setBusy(true);
    setProblem(undefined);
    try {
      const uploaded = await Promise.all(moments.map((m) => uploadPhoto(id, m.photo)));
      const r = await api.recordedProcedure(id, {
        moments: moments.map((m, i) => ({
          evidenceId: uploaded[i]!.id,
          said: m.said.trim(),
          atSec: Math.round(m.atSec * 10) / 10,
        })),
      });
      if (r.status !== "created") throw new Error(r.message);
      router.back();
    } catch (e) {
      setProblem((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: t.color["background-200"] }}
    >
      <Stack.Screen options={{ title: "Record it" }} />
      {busy ? (
        <View style={{ flex: 1, justifyContent: "center", padding: space["space-6"] }}>
          <ProgressState label={phrase} testID="record-writing" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space["space-4"], gap: space["space-4"] }}>
          <Text variant="copy-15" color="text-secondary">
            Do the job as you normally would. At each step, take a picture, then hold the mic and
            say what you&apos;re doing and anything to watch out for.
          </Text>

          {usable ? (
            <View style={{ height: 300, borderRadius: 20, overflow: "hidden" }}>
              <CameraView
                ref={camera}
                style={{ flex: 1 }}
                facing="back"
                onMountError={() => setCameraFailed(true)}
              />
            </View>
          ) : (
            <Notice
              icon="camera"
              testID="record-no-camera"
              action={
                permission?.canAskAgain !== false && !cameraFailed ? (
                  <Button variant="secondary" size="lg" onPress={requestPermission}>
                    Allow camera
                  </Button>
                ) : undefined
              }
            >
              {cameraFailed
                ? "The camera isn't available here. Choose photos instead."
                : "Tandrix needs the camera to record the steps, or choose photos instead."}
            </Notice>
          )}

          <View style={{ flexDirection: "row", gap: space["space-2"] }}>
            {usable ? (
              <View style={{ flex: 1 }}>
                <Button icon="camera" size="lg" block onPress={capture} testID="record-capture">
                  {moments.length ? "Next moment" : "First moment"}
                </Button>
              </View>
            ) : null}
            <View style={{ flex: usable ? 0 : 1 }}>
              <Button
                variant="secondary"
                icon="image"
                size="lg"
                block={!usable}
                onPress={() => void choose()}
                testID="record-choose"
              >
                Choose photo
              </Button>
            </View>
          </View>

          {moments.map((m, i) => (
            <View
              key={m.photo.uri}
              testID={`record-moment-${i}`}
              style={{
                flexDirection: "row",
                gap: space["space-3"],
                padding: space["space-3"],
                borderRadius: 18,
                backgroundColor: t.color["background-100"],
              }}
            >
              <Image
                source={{ uri: m.photo.uri }}
                style={{ width: 72, height: 72, borderRadius: 12 }}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: space["space-1"] }}>
                <Text variant="label-12" color="text-secondary">
                  {`Moment ${i + 1} · ${clock(m.atSec)}`}
                </Text>
                <Input
                  label="What you're doing"
                  value={m.said}
                  onChangeText={(v) => setSaid(i, v)}
                  placeholder="Peel the backing off both pads"
                  maxLength={600}
                  testID={`record-said-${i}`}
                />
              </View>
            </View>
          ))}

          {last ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-3"] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hold to say what you're doing"
                testID="record-mic"
                disabled={talk.state === "working"}
                onPressIn={talk.start}
                onPressOut={talk.finish}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    talk.state === "listening" ? t.color.highlight : t.color["surface-ink"],
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon name="mic" size={24} color="ink-on-surface" />
              </Pressable>
              <Text variant="copy-14" color="text-secondary" style={{ flex: 1 }}>
                {talk.state === "listening"
                  ? "Listening. Let go when you're done."
                  : `Hold to say what you're doing in moment ${moments.length}.`}
              </Text>
            </View>
          ) : null}

          {problem ? (
            <Notice tone="error" testID="record-problem">
              {problem}
            </Notice>
          ) : null}

          <Button
            size="lg"
            block
            disabled={!ready}
            onPress={() => void write()}
            testID="record-write"
          >
            Write the steps
          </Button>
          {!ready ? (
            <Text variant="copy-13" color="text-secondary">
              At least two moments, each with what you did.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
