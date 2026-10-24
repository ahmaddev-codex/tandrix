// Native foundation components. Feature components (CaptureView, PartHighlight, CheckResult,
// PartsList, HandoffBanner, StepCard, SafetyGate) are built on these in their feature tasks.
import type { ReactNode } from "react";
import {
  Pressable,
  Text as RNText,
  View,
  type PressableProps,
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
  iconPaths,
  sourceIcon,
  statusMeta,
  type IconName,
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
  variant = "copy-16",
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
  label?: string;
}

export function Icon({ name, size = 16, color = "text", label }: IconProps) {
  const t = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={t.color[color]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={!!label}
      accessibilityLabel={label}
    >
      {iconPaths[name].map((d) => (
        <Path key={d} d={d} />
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
  /** md 40, lg 48, field 56. Phone primary actions use field; nothing on the phone is below lg. */
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
    size === "field" ? "button-18" : size === "lg" ? "button-16" : "button-14";
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
        height: 32,
        paddingLeft: 10,
        paddingRight: 12,
        borderRadius: radius["radius-full"],
        backgroundColor: t.color[c.bg],
        borderWidth: c.border ? 1 : 0,
        borderColor: c.border ? t.color[c.border] : undefined,
      }}
    >
      <Icon name={meta.icon} color={c.fg} />
      <Text variant="label-14" color={c.fg}>
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
        minHeight: 28,
        paddingHorizontal: space["space-2"],
        borderRadius: radius["radius-sm"],
        backgroundColor: generic ? t.color["amber-100"] : t.color["background-100"],
        borderWidth: generic ? 0 : 1,
        borderColor: t.color.border,
      }}
    >
      <Icon name={sourceIcon[kind]} color={fg} />
      <Text variant="mono-13" color={fg}>
        {children ?? (generic ? genericSourceLabel : "")}
      </Text>
    </View>
  );
}
