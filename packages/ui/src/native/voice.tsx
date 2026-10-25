// VoiceTranscript (design system): what Tandrix heard and what it said back, under the StepCard.
// The transcript is shown as well as spoken, because a site is loud.
import { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, View } from "react-native";
import { radius, space } from "../generated/tokens";
import { Icon, SourceChip, Text } from "./components";
import { useTheme } from "./theme";

export interface VoiceTurn {
  speaker: "you" | "tandrix";
  text: string;
  /** refusal: work Tandrix won't guide. general: advice not from the step or its manual. */
  kind?: "refusal" | "general";
}

export interface VoiceTranscriptProps {
  state?: "idle" | "listening" | "working";
  /** Oldest first; the last few are shown. */
  turns: VoiceTurn[];
  testID?: string;
}

const SHOWN = 4;

export function VoiceTranscript({ state = "idle", turns, testID }: VoiceTranscriptProps) {
  const t = useTheme();
  if (state === "idle" && !turns.length) return null;
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        gap: space["space-3"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color["background-100"],
        boxShadow: t.shadow["shadow-sm"],
      }}
    >
      {turns.slice(-SHOWN).map((turn, i) => (
        <View key={i} style={{ gap: space["space-1"] }}>
          <Text variant="label-12" color="text-secondary">
            {turn.speaker === "you" ? "You" : "Tandrix"}
          </Text>
          {turn.kind === "refusal" ? (
            <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "flex-start" }}>
              <Icon name="stop" size={20} color="red-900" />
              <View style={{ flex: 1 }}>
                <Text variant="copy-14" color="red-900">
                  {turn.text}
                </Text>
              </View>
            </View>
          ) : (
            <Text variant="copy-14">{turn.text}</Text>
          )}
          {turn.kind === "general" ? <SourceChip kind="generic" /> : null}
        </View>
      ))}
      {state === "listening" ? (
        <View
          accessibilityRole="text"
          accessibilityLabel="Listening"
          style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}
        >
          <ListeningDot />
          <Text variant="label-13" color="text-secondary">
            Listening. Let go to send.
          </Text>
        </View>
      ) : state === "working" ? (
        <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}>
          <ActivityIndicator color={t.color["text-secondary"]} />
          <Text variant="label-13" color="text-secondary">
            Working it out
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The one thing that moves on its own here; still under reduced motion. */
function ListeningDot() {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      live = false;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color["red-700"], opacity }}
    />
  );
}
