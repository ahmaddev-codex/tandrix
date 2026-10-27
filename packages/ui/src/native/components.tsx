// Native foundation components. Feature components build on these: PartHighlight and
// HighlightCorrection (highlight.tsx), StepCard (step.tsx), Notice, ActionCard, SummaryCard and
// StepRow (cards.tsx), ProgressState (progress.tsx), SafetyGate, CheckResult, PartsList and
// HandoffBanner (feedback.tsx).
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  radius,
  size as sizes,
  space,
  type ColorToken,
  type TextStyleName,
} from "../generated/tokens";
import {
  genericSourceLabel,
  iconPathsFor,
  sourceIcon,
  statusMeta,
  type IconName,
  type IconWeight,
  type SourceKind,
  type StepStatus,
} from "../shared";
import { nativeTextStyle, useTheme } from "./theme";

export interface TextProps {
  variant?: TextStyleName;
  color?: ColorToken;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function Text({
  variant = "copy-14",
  color = "text",
  children,
  style,
  numberOfLines,
}: TextProps) {
  const t = useTheme();
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[nativeTextStyle(variant), { color: t.color[color] }, style]}
    >
      {children}
    </RNText>
  );
}

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 24;
  color?: ColorToken;
  /** Defaults to the design system's rule: solid (fill) below 20 px, outline at 20 px and up. */
  weight?: IconWeight;
  label?: string;
}

export function Icon({ name, size = 16, color = "text", weight, label }: IconProps) {
  const t = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill={t.color[color]}
      accessible={!!label}
      accessibilityLabel={label}
    >
      {iconPathsFor(name, size, weight).map((p) => (
        <Path key={p.d} d={p.d} {...(p.o !== undefined ? { opacity: p.o } : {})} />
      ))}
    </Svg>
  );
}

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "mandatory";
export type ButtonSize = "md" | "lg" | "field";

const buttonColors: Record<
  ButtonVariant,
  { bg: ColorToken | null; fg: ColorToken; border?: ColorToken }
> = {
  primary: { bg: "primary", fg: "on-primary" },
  secondary: { bg: "background-100", fg: "text", border: "border-control" },
  tertiary: { bg: null, fg: "text" },
  danger: { bg: "red-700", fg: "on-red" },
  mandatory: { bg: "mandatory", fg: "on-mandatory" },
};

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: ButtonVariant;
  /** md 40, lg 48, field 48 (full-width phone actions, 15px semibold). Nothing on the phone is below lg. */
  size?: ButtonSize;
  icon?: IconName;
  /** Icon-only buttons must pass accessibilityLabel. */
  iconOnly?: boolean;
  block?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  variant = "secondary",
  size = "field",
  icon,
  iconOnly,
  block,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const t = useTheme();
  const c = buttonColors[variant];
  const height =
    size === "field"
      ? sizes["control-field"]
      : size === "lg"
        ? sizes["control-lg"]
        : sizes["control-md"];
  const fg: ColorToken = disabled ? "gray-700" : c.fg;
  const label: TextStyleName =
    size === "field" ? "button-15" : size === "lg" ? "button-14" : "button-13";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height,
          minWidth: iconOnly ? height : undefined,
          paddingHorizontal: iconOnly ? 0 : size === "field" ? space["space-5"] : space["space-4"],
          borderRadius: radius["radius-md"],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space["space-2"],
          alignSelf: block ? "stretch" : "flex-start",
          backgroundColor: disabled
            ? t.color["gray-100"]
            : c.bg
              ? t.color[c.bg]
              : pressed
                ? t.color["gray-100"]
                : "transparent",
          borderWidth: c.border || disabled ? 1 : 0,
          borderColor: disabled ? t.color.border : c.border ? t.color[c.border] : undefined,
          opacity: pressed && c.bg && !disabled ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "field" ? 24 : 20} color={fg} /> : null}
      {children != null && !iconOnly ? (
        <Text variant={label} color={fg}>
          {children}
        </Text>
      ) : null}
    </Pressable>
  );
}

const statusColors: Record<StepStatus, { bg: ColorToken; fg: ColorToken; border?: ColorToken }> = {
  verified: { bg: "green-100", fg: "green-900" },
  confirmed: { bg: "gray-100", fg: "text", border: "border" },
  attention: { bg: "amber-100", fg: "amber-900" },
  unverifiable: { bg: "background-100", fg: "text-secondary", border: "border-control" },
  blocked: { bg: "red-100", fg: "red-900" },
  pending: { bg: "gray-100", fg: "text-secondary" },
  progress: { bg: "blue-100", fg: "blue-900" },
};

export interface StatusChipProps {
  /** verified: a recorded check passed. confirmed: the user said so; never shown as verified. */
  status: StepStatus;
  children?: string;
}

export function StatusChip({ status, children }: StatusChipProps) {
  const t = useTheme();
  const c = statusColors[status];
  const meta = statusMeta[status];
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: space["space-1"],
        // As on the web: 24px with 12px text, so the status reads without shouting.
        height: 24,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: radius["radius-full"],
        backgroundColor: t.color[c.bg],
        borderWidth: c.border ? 1 : 0,
        borderColor: c.border ? t.color[c.border] : undefined,
      }}
    >
      <Icon name={meta.icon} color={c.fg} />
      <Text variant="label-12" color={c.fg}>
        {children ?? meta.label}
      </Text>
    </View>
  );
}

export interface SourceChipProps {
  kind?: SourceKind;
  children?: string;
}

export function SourceChip({ kind = "manual", children }: SourceChipProps) {
  const t = useTheme();
  const generic = kind === "generic";
  const fg: ColorToken = generic ? "amber-900" : "text-secondary";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        minHeight: 24,
        paddingHorizontal: space["space-2"],
        borderRadius: radius["radius-sm"],
        backgroundColor: generic ? t.color["amber-100"] : t.color["background-100"],
        borderWidth: generic ? 0 : 1,
        borderColor: t.color.border,
      }}
    >
      <Icon name={sourceIcon[kind]} color={fg} />
      <Text variant="mono-12" color={fg}>
        {children ?? (generic ? genericSourceLabel : "")}
      </Text>
    </View>
  );
}

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Unit shown inside the field, e.g. "Nm". */
  suffix?: string;
  mono?: boolean;
  /** field (default on phone) or lg, both 48. */
  size?: "field" | "lg";
  keyboardType?: TextInputProps["keyboardType"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  maxLength?: number;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  testID?: string;
}

export function Input({
  label,
  hint,
  error,
  suffix,
  mono,
  size = "field",
  editable = true,
  testID,
  ...field
}: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const height = size === "field" ? sizes["control-field"] : sizes["control-lg"];
  const message = error ?? hint;
  const borderColor = error
    ? t.color["red-700"]
    : focused
      ? t.color["focus-ring"]
      : t.color["border-control"];
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label-14">{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height,
          paddingHorizontal: space["space-4"],
          borderRadius: radius["radius-md"],
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          backgroundColor: editable ? t.color["background-100"] : t.color["gray-100"],
        }}
      >
        <TextInput
          {...field}
          testID={testID}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={message}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={t.color["gray-700"]}
          style={[
            nativeTextStyle(mono ? "mono-13" : "field-body"),
            { flex: 1, color: editable ? t.color.text : t.color["gray-700"] },
          ]}
        />
        {suffix ? (
          <Text variant="mono-12" color="text-secondary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {message ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {error ? <Icon name="alert" color="red-900" /> : null}
          <Text variant="copy-13" color={error ? "red-900" : "text-secondary"}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type CaptureState = "live" | "preview" | "analyzing";

export interface CaptureViewProps {
  /** Camera preview or the captured photo, filling the frame. */
  children: ReactNode;
  state: CaptureState;
  source?: "phone" | "glasses";
  /** One line of framing guidance, e.g. "Show the open housing from the front". */
  hint?: string;
  /** What Tandrix is looking for while analysing, e.g. "Finding the impeller". */
  analyzingLabel?: string;
  useLabel?: string;
  /** Live: false while the camera isn't ready, which disables the shutter. */
  canCapture?: boolean;
  onCapture?: () => void;
  onRetake?: () => void;
  onUse?: () => void;
  /** Shown beside the shutter; omit to hide. */
  secondaryAction?: ReactNode;
  testID?: string;
}

/** The phone camera surface: live view, captured photo, and the wait while Tandrix analyses it. */
export function CaptureView({
  children,
  state,
  source = "phone",
  hint,
  analyzingLabel = "Looking at the photo",
  useLabel = "Use photo",
  canCapture = true,
  onCapture,
  onRetake,
  onUse,
  secondaryAction,
  testID,
}: CaptureViewProps) {
  const t = useTheme();
  const overlayText = { color: t.color["overlay-ink"] };
  const shutter = sizes["control-shutter"];
  const shutterDisabled = !canCapture || state === "analyzing";
  return (
    <View style={{ flex: 1, gap: space["space-3"] }} testID={testID}>
      <View
        style={{
          flex: 1,
          borderRadius: radius["radius-lg"],
          overflow: "hidden",
          backgroundColor: t.color["highlight-keyline"],
        }}
      >
        {children}
        {state === "live" ? (
          <View
            accessibilityRole="text"
            style={{
              position: "absolute",
              top: space["space-3"],
              left: space["space-3"],
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              height: 28,
              borderRadius: radius["radius-full"],
              backgroundColor: t.color["overlay-ground"],
              boxShadow: t.shadow["shadow-overlay"],
            }}
          >
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color["red-700"] }}
            />
            <RNText style={[nativeTextStyle("label-12"), overlayText]}>
              {source === "glasses" ? "Glasses camera on" : "Camera on"}
            </RNText>
          </View>
        ) : null}
        {hint && state !== "analyzing" ? (
          <View
            style={{
              position: "absolute",
              bottom: space["space-3"],
              left: space["space-3"],
              right: space["space-3"],
              alignItems: "center",
            }}
          >
            <RNText
              style={[
                nativeTextStyle("field-caption"),
                overlayText,
                {
                  textAlign: "center",
                  paddingHorizontal: space["space-3"],
                  paddingVertical: 6,
                  borderRadius: radius["radius-md"],
                  backgroundColor: t.color["overlay-ground"],
                  overflow: "hidden",
                },
              ]}
            >
              {hint}
            </RNText>
          </View>
        ) : null}
        {state === "analyzing" ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={analyzingLabel}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: "center",
              justifyContent: "center",
              gap: space["space-2"],
              backgroundColor: t.color["overlay-scrim"],
            }}
          >
            <ActivityIndicator color={t.color["overlay-ink"]} />
            <RNText style={[nativeTextStyle("field-caption"), overlayText]}>
              {analyzingLabel}
            </RNText>
          </View>
        ) : null}
      </View>

      {state === "preview" ? (
        <View style={{ flexDirection: "row", gap: space["space-2"] }}>
          <Button
            variant="secondary"
            icon="retake"
            onPress={onRetake}
            style={{ flex: 1 }}
            testID="retake"
          >
            Retake
          </Button>
          <Button variant="primary" onPress={onUse} style={{ flex: 1 }} testID="use-photo">
            {useLabel}
          </Button>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: shutterDisabled }}
            disabled={shutterDisabled}
            onPress={onCapture}
            testID="shutter"
            style={({ pressed }) => ({
              width: shutter,
              height: shutter,
              borderRadius: shutter / 2,
              borderWidth: 4,
              borderColor: t.color["gray-1000"],
              backgroundColor: pressed ? t.color["gray-300"] : t.color["background-100"],
              opacity: shutterDisabled ? 0.4 : 1,
            })}
          />
          <View style={{ flex: 1, alignItems: "flex-end" }}>{secondaryAction}</View>
        </View>
      )}
    </View>
  );
}
