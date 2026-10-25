// PartHighlight: marks parts on a captured camera frame (design system: PartHighlight).
// Stroke stack keyline → halo → highlight so it reads on any background; a SAM mask fills with
// highlight-tint; every highlight carries its label, and tapping the label corrects it.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text as RNText,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { radius, space } from "../generated/tokens";
import { estimateLabelSize, placeLabels } from "./label-layout";
import { Button, Text } from "./components";
import { nativeTextStyle, useTheme } from "./theme";

export interface HighlightBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NativeHighlightTarget {
  id: string;
  label: string;
  /** Part number from the parts list, in mono. */
  partNumber?: string;
  /** Below the confirm threshold: shows "Possible match". */
  possible?: boolean;
  box: HighlightBox;
  /** SAM mask outline in its raster's pixels; the raster covers `box`. */
  mask?: { path: string; raster: { width: number; height: number } };
}

export interface PartHighlightProps {
  /** The frame, filling the view with the same `fit`. */
  children: ReactNode;
  /** The frame's pixel size: the coordinate space of every target. */
  size: { width: number; height: number };
  /** At most three are drawn. */
  targets: NativeHighlightTarget[];
  /** Text alternative, e.g. "Highlighted: impeller, centre of the photo". */
  alt: string;
  /** How the frame is fitted: contain keeps every part and label in view. */
  fit?: "contain" | "cover";
  onLabelPress?: (target: NativeHighlightTarget) => void;
  testID?: string;
}

const MAX_TARGETS = 3;
const LABEL_WIDTH = 240;

/** Screen transform for a frame fitted into a view. */
function fitFrame(
  view: { width: number; height: number },
  frame: { width: number; height: number },
  fit: "contain" | "cover",
) {
  const sx = view.width / frame.width;
  const sy = view.height / frame.height;
  const scale = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  return {
    scale,
    dx: (view.width - frame.width * scale) / 2,
    dy: (view.height - frame.height * scale) / 2,
  };
}

export function PartHighlight({
  children,
  size,
  targets,
  alt,
  fit = "contain",
  onLabelPress,
  testID,
}: PartHighlightProps) {
  const t = useTheme();
  const [view, setView] = useState<{ width: number; height: number } | null>(null);
  const shown = targets.slice(0, MAX_TARGETS);

  // The outline appears over 300ms; no motion under reduced motion.
  const opacity = useRef(new Animated.Value(0)).current;
  const key = shown.map((s) => s.id).join(",");
  useEffect(() => {
    let live = true;
    opacity.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) opacity.setValue(1);
      else Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
    return () => {
      live = false;
    };
  }, [key, opacity]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setView({ width, height });
  };

  const f = view ? fitFrame(view, size, fit) : null;
  const sizes = shown.map((target) =>
    estimateLabelSize(
      `${target.label}${target.partNumber ? `  ${target.partNumber}` : ""}`,
      !!target.possible,
    ),
  );
  const labels =
    f && view
      ? placeLabels(
          shown.map((target, i) => ({
            top: f.dy + target.box.y * f.scale,
            bottom: f.dy + (target.box.y + target.box.h) * f.scale,
            centerX: f.dx + (target.box.x + target.box.w / 2) * f.scale,
            ...sizes[i]!,
          })),
          view,
        ).map((pos, i) => ({ pos, target: shown[i]!, width: sizes[i]!.width }))
      : [];

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={alt}
      onLayout={onLayout}
      style={{
        flex: 1,
        borderRadius: radius["radius-lg"],
        overflow: "hidden",
        backgroundColor: t.color["highlight-keyline"],
      }}
    >
      {children}
      {f && view ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity }}
          >
            <Svg width={view.width} height={view.height}>
              <G transform={`translate(${f.dx} ${f.dy}) scale(${f.scale})`}>
                {shown.map((target) => (
                  <Outline key={target.id} target={target} scale={f.scale} />
                ))}
              </G>
            </Svg>
          </Animated.View>
          {labels.map(({ pos, target, width }) => (
            <View
              key={`label-${target.id}`}
              pointerEvents="box-none"
              style={{
                position: "absolute",
                // A wide wrapper centred on the label's spot, so a label slightly longer than
                // estimated still centres instead of wrapping.
                left: pos.left + width / 2 - LABEL_WIDTH / 2,
                top: pos.top,
                width: LABEL_WIDTH,
                alignItems: "center",
              }}
            >
              <Label target={target} onPress={onLabelPress} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Outline({ target, scale }: { target: NativeHighlightTarget; scale: number }) {
  const t = useTheme();
  const { box, mask } = target;
  // Stroke widths are screen pixels, so divide by the frame's scale.
  const px = (n: number) => n / scale;
  const strokes = [
    { color: t.color["highlight-keyline"], width: 7, opacity: 0.55 },
    { color: t.color["highlight-halo"], width: 5, opacity: 1 },
    { color: t.color.highlight, width: 2.5, opacity: 1 },
  ];
  if (mask) {
    const sx = box.w / mask.raster.width;
    const sy = box.h / mask.raster.height;
    const s = (sx + sy) / 2;
    return (
      <G transform={`translate(${box.x} ${box.y}) scale(${sx} ${sy})`}>
        <Path d={mask.path} fill={t.color["highlight-tint"]} />
        {strokes.map((st, i) => (
          <Path
            key={i}
            d={mask.path}
            fill="none"
            stroke={st.color}
            strokeOpacity={st.opacity}
            strokeWidth={px(st.width) / s}
            strokeLinejoin="round"
          />
        ))}
      </G>
    );
  }
  return (
    <G>
      {strokes.map((st, i) => (
        <Rect
          key={i}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={px(radius["radius-md"])}
          fill="none"
          stroke={st.color}
          strokeOpacity={st.opacity}
          strokeWidth={px(st.width)}
        />
      ))}
    </G>
  );
}

function Label({
  target,
  onPress,
}: {
  target: NativeHighlightTarget;
  onPress?: ((target: NativeHighlightTarget) => void) | undefined;
}) {
  const t = useTheme();
  const ink = { color: t.color["overlay-ink"] };
  return (
    <Pressable
      testID={`highlight-label-${target.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${target.label}${target.possible ? ", possible match" : ""}`}
      accessibilityHint={onPress ? "Confirm or correct this part" : undefined}
      disabled={!onPress}
      onPress={() => onPress?.(target)}
      style={({ pressed }) => ({
        paddingHorizontal: space["space-2"],
        paddingVertical: space["space-1"],
        borderRadius: radius["radius-md"],
        backgroundColor: pressed ? t.color["overlay-raised"] : t.color["overlay-ground"],
        boxShadow: t.shadow["shadow-overlay"],
        alignItems: "center",
      })}
    >
      <RNText numberOfLines={1} style={[nativeTextStyle("field-caption"), ink]}>
        {target.label}
        {target.partNumber ? (
          <RNText style={[nativeTextStyle("mono-13"), ink, { opacity: 0.8 }]}>
            {"  "}
            {target.partNumber}
          </RNText>
        ) : null}
      </RNText>
      {target.possible ? (
        <RNText style={[nativeTextStyle("label-13"), { color: t.color["overlay-warn"] }]}>
          Possible match
        </RNText>
      ) : null}
    </Pressable>
  );
}

export interface HighlightCorrectionProps {
  /** The highlighted part's name. */
  label: string;
  /** The step's other parts, offered as "It's the …". */
  otherParts?: Array<{ id: string; name: string }>;
  onConfirm?: () => void;
  onReject?: () => void;
  onOtherPart?: (part: { id: string; name: string }) => void;
  testID?: string;
}

/** Confirm or correct one highlight (design system: HighlightCorrection). */
export function HighlightCorrection({
  label,
  otherParts = [],
  onConfirm,
  onReject,
  onOtherPart,
  testID,
}: HighlightCorrectionProps) {
  const t = useTheme();
  const name = label.toLowerCase();
  return (
    <View
      testID={testID}
      style={{
        gap: space["space-2"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color["background-100"],
        boxShadow: t.shadow["shadow-md"],
      }}
    >
      <Text variant="heading-16" style={{ marginBottom: space["space-1"] }}>
        {`This looks like the ${name}. Is that right?`}
      </Text>
      <Button variant="primary" size="lg" block onPress={onConfirm} testID="confirm-highlight">
        {`Yes, that's the ${name}`}
      </Button>
      <Button variant="secondary" size="lg" block onPress={onReject} testID="reject-highlight">
        No, that's not it
      </Button>
      {otherParts.map((p) => (
        <Button key={p.id} variant="tertiary" size="lg" block onPress={() => onOtherPart?.(p)}>
          {`It's the ${p.name.toLowerCase()}`}
        </Button>
      ))}
    </View>
  );
}
