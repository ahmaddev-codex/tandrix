// The phone's page kit, in the website's language: white pages, large tight-tracked titles with a
// quieter second line, grey trays of white rows, blue icon squares and pill buttons. Built from the
// design system's tokens only, so every theme (light, dark, sunlight) follows.
import type { ColorToken, IconName } from "@tandrix/ui";
import { radius, space } from "@tandrix/ui";
import { Icon, nativeFontNames, Text, useTheme } from "@tandrix/ui/native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TAB_BAR_SPACE } from "@/components/mobile-bottom-nav";

/** The page gutter: the same on every screen. */
export const GUTTER = 20;

/** A page: safe area, a white scrolling body with the gutter, and an optional fixed footer. */
export function Page({
  children,
  footer,
  onRefresh,
  refreshing = false,
  edges,
  gap = space["space-6"],
  tabs = false,
  testID,
}: {
  children: ReactNode;
  /** Stays put under the scrolling body (the bottom bar, or a main action). */
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: Array<"top" | "bottom">;
  gap?: number;
  /** A tab screen: content scrolls under the floating tab bar and clears it at the end. */
  tabs?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.color["background-100"] }}
      edges={edges ?? (tabs ? ["top"] : ["top", "bottom"])}
    >
      <ScrollView
        testID={testID}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: space["space-4"],
          paddingBottom: tabs ? TAB_BAR_SPACE : space["space-8"],
          gap,
          flexGrow: 1,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={t.color["text-secondary"]}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

/** The display face for titles: Geist Medium, tight, like the website's headings. */
const display = (size: number) => ({
  fontFamily: nativeFontNames.sans[500],
  fontSize: size,
  lineHeight: Math.round(size * 1.08),
  letterSpacing: -size * 0.045,
});

/** A page's title, with an optional quieter second half and a lead line under it. */
export function PageTitle({
  title,
  soft,
  lead,
  size = 34,
}: {
  title: string;
  soft?: string;
  lead?: string;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: space["space-2"] }}>
      <RNText accessibilityRole="header" style={{ ...display(size), color: t.color.text }}>
        {title}
        {soft ? <RNText style={{ color: t.color["gray-600"] }}>{` ${soft}`}</RNText> : null}
      </RNText>
      {lead ? (
        <Text variant="copy-15" color="text-secondary">
          {lead}
        </Text>
      ) : null}
    </View>
  );
}

/** A section's heading inside a page, with an optional action on the right. */
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space["space-3"],
      }}
    >
      <RNText accessibilityRole="header" style={{ ...display(22), color: t.color.text }}>
        {title}
      </RNText>
      {action}
    </View>
  );
}

/** The grey tray white rows sit in, as on the website. */
export function Tray({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          gap: 6,
          padding: 6,
          borderRadius: 24,
          backgroundColor: t.color["background-200"],
          borderWidth: t.name === "sunlight" ? 1 : 0,
          borderColor: t.color.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The blue square an icon sits in. */
export function IconSquare({
  name,
  tone = "blue",
  size = 40,
}: {
  name: IconName;
  tone?: "blue" | "quiet";
  size?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "blue" ? t.color.highlight : t.color["gray-100"],
      }}
    >
      <Icon
        name={name}
        size={size >= 40 ? 20 : 16}
        color={tone === "blue" ? "on-blue" : "text-secondary"}
      />
    </View>
  );
}

/** One white row in a tray: a leading icon, a title and a quieter line, and what's on the right. */
export function Row({
  title,
  detail,
  icon,
  leading,
  trailing,
  onPress,
  chevron = Boolean(onPress),
  accessibilityLabel,
  testID,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const t = useTheme();
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space["space-3"],
        minHeight: 64,
        paddingVertical: space["space-3"],
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: t.color["background-100"],
        opacity: pressed ? 0.7 : 1,
      }}
    >
      {leading ?? (icon ? <IconSquare name={icon} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label-14" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="copy-13" color="text-secondary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevronRight" size={16} color="text-tertiary" /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body(false)}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}. ${detail}` : title)}
      testID={testID}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** The site's pill button: ink with the blue arrow disc, or quiet mist; full width when asked. */
export function Pill({
  children,
  onPress,
  tone = "ink",
  icon = "arrowRight",
  block = false,
  disabled = false,
  busy = false,
  accessibilityLabel,
  testID,
}: {
  children: string;
  onPress?: () => void;
  tone?: "ink" | "mist" | "white";
  /** The icon in the disc; null for none. */
  icon?: IconName | null;
  block?: boolean;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const t = useTheme();
  const bg: Record<typeof tone, ColorToken> = {
    ink: "surface-ink",
    mist: "gray-100",
    white: "background-100",
  };
  const ink: Record<typeof tone, ColorToken> = {
    ink: "ink-on-surface",
    mist: "text",
    white: "text",
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={testID}
      style={({ pressed }) => ({
        alignSelf: block ? "stretch" : "flex-start",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: icon ? "space-between" : "center",
        gap: space["space-3"],
        minHeight: 52,
        paddingLeft: 22,
        paddingRight: icon ? 6 : 22,
        borderRadius: radius["radius-full"],
        backgroundColor: t.color[bg[tone]],
        borderWidth: tone === "white" ? 0 : t.name === "dark" && tone === "ink" ? 1 : 0,
        borderColor: t.color.border,
        opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Text variant="label-14" color={ink[tone]} style={{ fontSize: 16 }}>
        {children}
      </Text>
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tone === "mist" ? t.color["surface-ink"] : t.color.highlight,
          }}
        >
          {busy ? (
            <ActivityIndicator color={t.color["on-blue"]} />
          ) : (
            <Icon name={icon} size={20} color={tone === "mist" ? "ink-on-surface" : "on-blue"} />
          )}
        </View>
      ) : null}
    </Pressable>
  );
}
