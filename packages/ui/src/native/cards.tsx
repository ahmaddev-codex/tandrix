// Job-screen building blocks (design system: Notice, ActionCard, SummaryCard, StepRow).
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { radius, size as sizes, space, type ColorToken } from "../generated/tokens";
import {
  genericSourceLabel,
  statusMeta,
  type IconName,
  type SourceKind,
  type StepStatus,
} from "../shared";
import { Button, Icon, SourceChip, StatusChip, Text } from "./components";
import { useTheme } from "./theme";

const card = (bg: string, shadow: string) => ({
  padding: space["space-5"],
  borderRadius: radius["radius-lg"],
  backgroundColor: bg,
  boxShadow: shadow,
});

// ---- Notice ----

/** No success tone: green means verified only. */
export type NoticeTone = "neutral" | "info" | "attention" | "error";

const noticeColors: Record<NoticeTone, { bg: ColorToken; fg: ColorToken; icon: IconName }> = {
  neutral: { bg: "gray-100", fg: "text", icon: "file" },
  info: { bg: "blue-100", fg: "blue-900", icon: "info" },
  attention: { bg: "amber-100", fg: "amber-900", icon: "alert" },
  error: { bg: "red-100", fg: "red-900", icon: "stop" },
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: string;
  icon?: IconName;
  /** At most one Button. */
  action?: ReactNode;
  testID?: string;
}

export function Notice({ tone = "neutral", title, children, icon, action, testID }: NoticeProps) {
  const t = useTheme();
  const c = noticeColors[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === "error" ? "alert" : "text"}
      style={{
        flexDirection: "row",
        gap: space["space-2"],
        alignItems: "flex-start",
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color[c.bg],
      }}
    >
      <Icon name={icon ?? c.icon} size={20} color={c.fg} />
      <View style={{ flex: 1, gap: space["space-1"] }}>
        {title ? (
          <Text variant="heading-14" color={c.fg}>
            {title}
          </Text>
        ) : null}
        <Text variant="copy-14" color={c.fg}>
          {children}
        </Text>
        {action ? <View style={{ marginTop: space["space-2"] }}>{action}</View> : null}
      </View>
    </View>
  );
}

// ---- ActionCard ----

export interface ActionCardProps {
  title: string;
  body?: string;
  icon?: IconName;
  actionLabel: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  testID?: string;
  actionTestID?: string;
  secondaryTestID?: string;
}

/** The screen's one next thing to do. Monochrome: the primary button carries it. */
export function ActionCard({
  title,
  body,
  icon,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  testID,
  actionTestID,
  secondaryTestID,
}: ActionCardProps) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ ...card(t.color["background-100"], t.shadow["shadow-sm"]), gap: space["space-3"] }}
    >
      <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}>
        {icon ? <Icon name={icon} size={20} /> : null}
        <Text variant="heading-16">{title}</Text>
      </View>
      {body ? (
        <Text variant="copy-14" color="text-secondary">
          {body}
        </Text>
      ) : null}
      <View style={{ gap: space["space-2"] }}>
        <Button variant="primary" block onPress={onAction} testID={actionTestID}>
          {actionLabel}
        </Button>
        {secondaryLabel ? (
          <Button variant="tertiary" block onPress={onSecondary} testID={secondaryTestID}>
            {secondaryLabel}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

// ---- SummaryCard ----

export interface SummaryCardProps {
  label: string;
  title: string;
  facts?: Array<{ text: string; mono?: boolean }>;
  source?: string;
  sourceKind?: SourceKind;
  /** At most one secondary Button. */
  action?: ReactNode;
  testID?: string;
}

/** Something the job already has: equipment, manual. */
export function SummaryCard({
  label,
  title,
  facts = [],
  source,
  sourceKind = "manual",
  action,
  testID,
}: SummaryCardProps) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ ...card(t.color["background-100"], t.shadow["shadow-sm"]), gap: space["space-1"] }}
    >
      {/* The text reads as one element; the chip and action stay separately reachable. */}
      <View
        accessible
        accessibilityLabel={[`${label}: ${title}`, ...facts.map((f) => f.text)].join(", ")}
        style={{ gap: space["space-1"] }}
      >
        <Text variant="label-13" color="text-secondary">
          {label}
        </Text>
        <Text variant="heading-16">{title}</Text>
        {facts.map((f) => (
          <Text
            key={f.text}
            variant={f.mono ? "mono-12" : "copy-13"}
            color="text-secondary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {f.text}
          </Text>
        ))}
      </View>
      {source ? (
        <View style={{ marginTop: space["space-2"] }}>
          <SourceChip kind={sourceKind}>{source}</SourceChip>
        </View>
      ) : null}
      {action ? <View style={{ marginTop: space["space-2"] }}>{action}</View> : null}
    </View>
  );
}

// ---- StepRow ----

export interface StepRowProps {
  index: number;
  title: string;
  status?: StepStatus;
  statusLabel?: string;
  /** The citation; omit for a generic step. */
  source?: string;
  sourceKind?: SourceKind;
  onSelect?: () => void;
  disabled?: boolean;
  testID?: string;
}

/** One step in a job's list; the whole row opens it, and its label carries status and source. */
export function StepRow({
  index,
  title,
  status = "pending",
  statusLabel,
  source,
  sourceKind = "manual",
  onSelect,
  disabled,
  testID,
}: StepRowProps) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Step ${index}: ${title}, ${statusLabel ?? statusMeta[status].label}, ${
        source ?? genericSourceLabel
      }`}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: space["space-3"],
        minHeight: sizes["control-field"],
        alignItems: "flex-start",
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: pressed ? t.color["gray-200"] : t.color["background-100"],
        boxShadow: t.shadow["shadow-sm"],
      })}
    >
      <Text
        variant="mono-13"
        color="text-secondary"
        style={{ width: 24, fontVariant: ["tabular-nums"] }}
      >
        {String(index)}
      </Text>
      <View style={{ flex: 1, gap: space["space-2"] }}>
        {/* Status first, on the title's line, so every row's state reads down one edge. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
          <StatusChip status={status}>{statusLabel}</StatusChip>
          <Text variant="heading-14" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
        {source ? (
          <SourceChip kind={sourceKind}>{source}</SourceChip>
        ) : (
          <SourceChip kind="generic" />
        )}
      </View>
    </Pressable>
  );
}
