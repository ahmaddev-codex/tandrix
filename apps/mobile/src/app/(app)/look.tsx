// Point the camera: hold the phone up to something and ask "what is this?" or "where does this
// go?", by tapping or by voice. Tandrix freezes the frame, outlines what its answer is about and
// says the answer. Inside a project (job and step params), the step in hand is the context.
import type { LookResponse } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Icon, Notice, PartHighlight, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackPill } from "@/components/back-pill";
import { Pill } from "@/components/kit";
import { api } from "@/lib/api";
import { prepareFrame, type Frame } from "@/lib/look";
import { markReply } from "@/lib/timings";
import { usePushToTalk } from "@/voice/ptt";
import { speak, stopSpeaking } from "@/voice/tts";

type Phase = "live" | "asking" | "answered";
type Answered = Extract<LookResponse, { status: "answered" }>;

const QUESTIONS = ["What is this?", "Where does this go?"] as const;

export default function Look() {
  const { jobId, stepId } = useLocalSearchParams<{ jobId?: string; stepId?: string }>();
  const t = useTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  /** A photo chosen instead of the camera: asked about until cleared. */
  const [picked, setPicked] = useState<Frame | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [answer, setAnswer] = useState<Answered | null>(null);
  const [problem, setProblem] = useState<string>();

  const usable = permission?.granted && !cameraFailed;

  useEffect(() => () => stopSpeaking(), []);

  const say = (message: string) => {
    setProblem(message);
    speak(message);
  };

  const ask = async (question: string) => {
    if (phase === "asking") return;
    setProblem(undefined);
    setAnswer(null);
    stopSpeaking();
    setPhase("asking");
    try {
      let f = picked;
      if (!f) {
        const shot = await camera.current?.takePictureAsync({ quality: 0.8, exif: false });
        if (!shot) throw new Error("Couldn't take the picture. Try again.");
        f = await prepareFrame(shot.uri, shot);
      }
      setFrame(f);
      markReply("captured");
      const r = await api.look({
        photo: { mimeType: "image/jpeg", data: f.base64 },
        width: f.width,
        height: f.height,
        question,
        ...(jobId ? { jobId } : {}),
        ...(stepId ? { stepId } : {}),
      });
      markReply("answered");
      if (r.status !== "answered") {
        setPhase("live");
        setFrame(null);
        return say(r.message);
      }
      setAnswer(r);
      setPhase("answered");
      speak(r.reply);
    } catch (e) {
      setPhase("live");
      setFrame(null);
      say((e as Error).message);
    }
  };

  const talk = usePushToTalk({ keywords: [], onHeard: (q) => void ask(q), onProblem: say });

  const again = () => {
    stopSpeaking();
    setAnswer(null);
    setFrame(null);
    setProblem(undefined);
    setPhase("live");
  };

  const choose = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const a = r.canceled ? undefined : r.assets[0];
    if (!a) return;
    try {
      const f = await prepareFrame(a.uri, { width: a.width, height: a.height });
      setPicked(f);
      again();
    } catch (e) {
      say((e as Error).message);
    }
  };

  const still = frame ?? picked;
  const highlight = answer?.highlight;

  return (
    <View style={{ flex: 1, backgroundColor: t.color["surface-ink"] }}>
      <Stack.Screen options={{ headerShown: false }} />
      {still ? (
        <PartHighlight
          testID="look-frame"
          size={{ width: still.width, height: still.height }}
          fit="cover"
          alt={highlight ? `Outlined: ${highlight.label}` : "The frame Tandrix looked at"}
          targets={
            highlight && phase === "answered"
              ? [
                  {
                    id: "look",
                    label: highlight.label,
                    box: highlight.box,
                    ...(highlight.mask ? { mask: highlight.mask } : {}),
                  },
                ]
              : []
          }
        >
          <Image
            source={{ uri: still.uri }}
            style={{ flex: 1 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        </PartHighlight>
      ) : usable ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={() => setCameraFailed(true)}
        />
      ) : null}

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: space["space-4"],
            paddingTop: space["space-2"],
          }}
        >
          <BackPill />
          {picked ? (
            <Pill tone="mist" icon="camera" onPress={() => (setPicked(null), again())}>
              Use the camera
            </Pill>
          ) : null}
        </View>

        <View style={{ flex: 1 }} pointerEvents="box-none" />

        <View
          style={{
            margin: space["space-3"],
            padding: space["space-5"],
            gap: space["space-4"],
            borderRadius: 28,
            backgroundColor: t.color["background-100"],
          }}
        >
          {!usable && !picked ? (
            <Notice tone="info" testID="look-no-camera">
              {permission?.granted === false && !permission.canAskAgain
                ? "Camera access is off for Tandrix. Turn it on in Settings, or use a photo."
                : cameraFailed
                  ? "The camera isn't available here. Use a photo instead."
                  : "Tandrix needs the camera to see what you're pointing at."}
            </Notice>
          ) : null}

          {phase === "asking" ? (
            <ProgressState label="Looking at your photo" testID="look-asking" />
          ) : phase === "answered" && answer ? (
            <>
              <View testID="look-answer">
                <Text variant="field-instruction">{answer.reply}</Text>
              </View>
              <Pill tone="ink" icon="retake" block onPress={again} testID="look-again">
                Ask about something else
              </Pill>
            </>
          ) : (
            <>
              <Text variant="heading-18">
                {picked ? "Ask about this photo." : "Point at something and ask."}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
                {QUESTIONS.map((q, i) => (
                  <Pill
                    key={q}
                    tone="mist"
                    icon={null}
                    disabled={!usable && !picked}
                    onPress={() => void ask(q)}
                    testID={i === 0 ? "look-what" : "look-where"}
                  >
                    {q}
                  </Pill>
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-3"] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hold to ask"
                  testID="look-mic"
                  disabled={(!usable && !picked) || talk.state === "working"}
                  onPressIn={talk.start}
                  onPressOut={talk.finish}
                  style={({ pressed }) => ({
                    width: 64,
                    height: 64,
                    borderRadius: 32,
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
                    ? "Listening. Let go to ask."
                    : talk.state === "working"
                      ? "Hearing what you said"
                      : "Or hold the mic and ask anything about it."}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: space["space-2"] }}>
                {!usable && permission?.canAskAgain !== false && !cameraFailed ? (
                  <Pill tone="ink" icon="camera" onPress={requestPermission} testID="look-allow">
                    Allow the camera
                  </Pill>
                ) : null}
                {permission?.granted === false && !permission.canAskAgain ? (
                  <Pill tone="mist" icon={null} onPress={() => void Linking.openSettings()}>
                    Open Settings
                  </Pill>
                ) : null}
                <Pill tone="mist" icon="image" onPress={() => void choose()} testID="look-photo">
                  Use a photo
                </Pill>
              </View>
            </>
          )}
          {problem && phase === "live" ? (
            <Notice tone="error" testID="look-problem">
              {problem}
            </Notice>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
