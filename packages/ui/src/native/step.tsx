// StepCard: the phone's single working step (design system: StepCard). Count, status and
// source; the instruction; why; an optional caution; then one primary action plus the mic.
import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, space } from "../generated/tokens";
import type { SourceKind, StepStatus } from "../shared";
import { Icon, SourceChip, StatusChip, Text } from "./components";
import { useTheme } from "./theme";

export interface StepCardProps {
  index: number;
  total: number;
  /** The one action, imperative, one sentence. */
  title: string;
  body?: string;
  caution?: string;
  status?: StepStatus;
  /** Status chip text when it differs from the status's own label (e.g. "To do"). */
  statusLabel?: string;
  /** Citation text, e.g. "Manual p.14, fig. 3". Generic steps pass sourceKind "generic". */
  source?: string;
  sourceKind?: SourceKind;
  /** Usually a field-size primary Button plus an icon-only mic Button. */
  actions?: ReactNode;
  testID?: string;
}

export function StepCard({
  index,
  total,
  title,
  body,
  caution,
  status,
  statusLabel,
  source,
  sourceKind = "manual",
  actions,
  testID,
}: StepCardProps) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={`Step ${index} of ${total}`}
      style={{
        gap: space["space-3"],
        padding: space["space-5"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color["background-100"],
        boxShadow: t.shadow["shadow-sm"],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space["space-2"],
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text variant="label-14" color="text-secondary" style={{ fontVariant: ["tabular-nums"] }}>
          {`Step ${index} of ${total}`}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
          {status ? <StatusChip status={status}>{statusLabel}</StatusChip> : null}
          {source || sourceKind === "generic" ? (
            <SourceChip kind={sourceKind}>{source}</SourceChip>
          ) : null}
        </View>
      </View>
      <Text variant="field-instruction">{title}</Text>
      {body ? (
        <Text variant="field-body" color="text-secondary">
          {body}
        </Text>
      ) : null}
      {caution ? (
        <View
          accessibilityRole="text"
          style={{
            flexDirection: "row",
            gap: space["space-2"],
            alignItems: "flex-start",
            padding: space["space-3"],
            borderRadius: radius["radius-md"],
            backgroundColor: t.color["amber-100"],
          }}
        >
          <Icon name="alert" size={20} color="amber-900" />
          <View style={{ flex: 1 }}>
            <Text variant="copy-16" color="amber-900">
              {caution}
            </Text>
          </View>
        </View>
      ) : null}
      {actions ? (
        <View style={{ flexDirection: "row", gap: space["space-2"] }}>{actions}</View>
      ) : null}
    </View>
  );
}
