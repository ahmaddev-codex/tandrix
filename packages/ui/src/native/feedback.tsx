// Native SafetyGate, CheckResult, PartsList and HandoffBanner (design system components of the
// same names): what stands before a step, what a check found, the parts check, and the handoff.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { radius, size as sizes, space, type ColorToken } from "../generated/tokens";
import { checkMeta, partStatusMeta, type CheckOutcome, type PartStatus } from "../shared";
import { Button, Icon, SourceChip, StatusChip, Text } from "./components";
import { useTheme } from "./theme";

// ---- SafetyGate ----

export interface SafetyGateProps {
  title: string;
  body: string;
  /** mandatory (default): blue, needs confirming. stop: red refusal with no action. */
  tone?: "mandatory" | "stop";
  actionLabel?: string;
  onConfirm?: () => void;
  confirmed?: boolean;
  /** Shown once confirmed, e.g. "Confirmed at 10:42". */
  confirmedLabel?: string;
  testID?: string;
}

/** The ISO 7010 disc: blue mandatory action, or red prohibition. */
function SafetyDisc({ stop }: { stop: boolean }) {
  const t = useTheme();
  return (
    <Svg width={28} height={28} viewBox="0 0 36 36" accessibilityElementsHidden>
      <Circle cx={18} cy={18} r={18} fill={stop ? t.color["red-700"] : t.color.mandatory} />
      {stop ? (
        <Path d="M10 10l16 16" stroke={t.color["on-red"]} strokeWidth={3.5} strokeLinecap="round" />
      ) : (
        <G fill="none" stroke={t.color["on-mandatory"]} strokeWidth={3} strokeLinecap="round">
          <Path d="M18 9v9" />
          <Path d="M12 13a8 8 0 1 0 12 0" />
        </G>
      )}
    </Svg>
  );
}

export function SafetyGate({
  title,
  body,
  tone = "mandatory",
  actionLabel = "Confirm",
  onConfirm,
  confirmed,
  confirmedLabel = "Confirmed",
  testID,
}: SafetyGateProps) {
  const t = useTheme();
  const stop = tone === "stop";
  return (
    <View
      testID={testID}
      accessibilityLabel={title}
      style={{
        gap: space["space-3"],
        padding: space["space-5"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color[stop ? "red-100" : "blue-100"],
      }}
    >
      <View style={{ flexDirection: "row", gap: space["space-3"], alignItems: "center" }}>
        <SafetyDisc stop={stop} />
        <View style={{ flex: 1 }}>
          <Text variant="heading-16" color={stop ? "red-900" : "text"}>
            {title}
          </Text>
        </View>
      </View>
      <Text variant="copy-14" color="text-secondary">
        {body}
      </Text>
      {stop ? null : confirmed ? (
        <View
          accessibilityRole="text"
          style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}
        >
          <Icon name="sealCheck" size={20} weight="fill" color="green-900" />
          <Text variant="label-14" color="green-900">
            {confirmedLabel}
          </Text>
        </View>
      ) : (
        <Button
          variant="mandatory"
          block
          onPress={onConfirm}
          testID={testID ? `${testID}-confirm` : undefined}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

// ---- CheckResult ----

const checkColors: Record<CheckOutcome, { bg: ColorToken; fg: ColorToken; border?: ColorToken }> = {
  pass: { bg: "green-100", fg: "green-900" },
  fail: { bg: "amber-100", fg: "amber-900" },
  not_verifiable: { bg: "background-100", fg: "text", border: "border-control" },
};

export interface CheckResultProps {
  result: CheckOutcome;
  /** One or two plain sentences about the part, not the model. */
  reason: string;
  title?: string;
  /** The photo it judged, 88px wide. */
  thumbnail?: ReactNode;
  /** Photo time, shown as a photo SourceChip. */
  evidence?: string;
  actions?: ReactNode;
  testID?: string;
}

export function CheckResult({
  result,
  reason,
  title,
  thumbnail,
  evidence,
  actions,
  testID,
}: CheckResultProps) {
  const t = useTheme();
  const c = checkColors[result];
  const meta = checkMeta[result];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        gap: space["space-4"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color[c.bg],
        borderWidth: c.border ? 1 : 0,
        borderColor: c.border ? t.color[c.border] : undefined,
      }}
    >
      {thumbnail ? (
        <View style={{ width: 88, borderRadius: radius["radius-md"], overflow: "hidden" }}>
          {thumbnail}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: space["space-2"], alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}>
          <Icon
            name={meta.icon}
            size={20}
            weight={result === "pass" ? "fill" : "outline"}
            color={c.fg}
          />
          <Text variant="heading-16" color={c.fg}>
            {title ?? meta.title}
          </Text>
        </View>
        <Text variant="copy-14">{reason}</Text>
        {evidence ? <SourceChip kind="photo">{evidence}</SourceChip> : null}
        {actions ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: space["space-2"],
              marginTop: space["space-1"],
              alignSelf: "stretch",
            }}
          >
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---- PartsList ----

export interface PartsListItem {
  /** Part number. */
  part?: string;
  name: string;
  qty: number;
  status: PartStatus;
  note?: string;
}

export interface PartsListProps {
  parts: PartsListItem[];
  onSelect?: (part: PartsListItem, index: number) => void;
  testID?: string;
}

export function PartsList({ parts, onSelect, testID }: PartsListProps) {
  const t = useTheme();
  const found = parts.filter((p) => p.status === "found").length;
  const missing = parts.filter((p) => p.status === "missing").length;
  const possible = parts.filter((p) => p.status === "possible").length;
  const sub =
    [missing ? `${missing} missing` : null, possible ? `${possible} to confirm` : null]
      .filter(Boolean)
      .join(", ") || "Everything on the list is here";
  return (
    <View testID={testID} style={{ gap: space["space-3"] }}>
      <View style={{ gap: 2 }}>
        <Text variant="heading-18">{`${found} of ${parts.length} parts found`}</Text>
        <Text variant="copy-14" color="text-secondary">
          {sub}
        </Text>
      </View>
      <View
        style={{
          borderRadius: radius["radius-lg"],
          backgroundColor: t.color["background-100"],
          boxShadow: t.shadow["shadow-border"],
          overflow: "hidden",
        }}
      >
        {parts.map((p, i) => {
          const s = partStatusMeta[p.status];
          return (
            <Pressable
              key={`${p.part ?? ""}-${p.name}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}${p.part ? `, part ${p.part}` : ""}, ${p.qty} needed, ${s.label}`}
              disabled={!onSelect}
              onPress={() => onSelect?.(p, i)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space["space-3"],
                minHeight: sizes["control-field"],
                paddingHorizontal: space["space-4"],
                paddingVertical: space["space-2"],
                backgroundColor: pressed ? t.color["gray-100"] : undefined,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: t.color.border,
              })}
            >
              {p.part ? (
                <Text
                  variant="mono-12"
                  color="text-tertiary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {p.part}
                </Text>
              ) : null}
              {/* On a phone the status sits under the name, so long names don't wrap early. */}
              <View style={{ flex: 1, gap: space["space-1"], alignItems: "flex-start" }}>
                <Text variant="label-14">{p.name}</Text>
                {p.note ? (
                  <Text variant="copy-12" color="text-secondary">
                    {p.note}
                  </Text>
                ) : null}
                <StatusChip status={s.chip}>{s.label}</StatusChip>
              </View>
              <Text variant="mono-12" color="text-secondary">{`×${p.qty}`}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---- HandoffBanner ----

export interface HandoffBannerProps {
  /** offer (phone): continue on the Mac. waiting (phone): open there. incoming (Mac). */
  state: "offer" | "waiting" | "incoming";
  step: number;
  stepTitle?: string;
  /** The name the user gave the device. */
  device?: string;
  job?: string;
  onAction?: () => void;
  testID?: string;
}

export function HandoffBanner({
  state,
  step,
  stepTitle,
  device,
  job,
  onAction,
  testID,
}: HandoffBannerProps) {
  const t = useTheme();
  const title =
    state === "offer"
      ? "Next step is on your Mac"
      : state === "waiting"
        ? `Waiting on ${device ?? "your Mac"}`
        : `${job ?? "Job"}: step ${step} is ready`;
  const body =
    state === "offer"
      ? stepTitle
        ? `Step ${step}: ${stepTitle}`
        : `Open it on ${device ?? "your Mac"}.`
      : state === "waiting"
        ? `Step ${step} is open there. You can still go back to the physical steps.`
        : `Sent from ${device ?? "your phone"}${stepTitle ? `. ${stepTitle}` : "."}`;
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      style={{
        gap: space["space-3"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color["background-100"],
        boxShadow: t.shadow[state === "incoming" ? "shadow-md" : "shadow-sm"],
      }}
    >
      <View style={{ flexDirection: "row", gap: space["space-3"], alignItems: "flex-start" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius["radius-md"],
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.color["blue-100"],
          }}
        >
          <Icon name={state === "incoming" ? "phone" : "laptop"} size={20} color="blue-900" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading-14">{title}</Text>
          <Text variant="copy-13" color="text-secondary">
            {body}
          </Text>
        </View>
      </View>
      {state === "offer" ? (
        <Button variant="primary" block onPress={onAction}>
          Continue on Mac
        </Button>
      ) : state === "waiting" ? (
        <Button variant="secondary" size="lg" onPress={onAction}>
          Back to physical steps
        </Button>
      ) : (
        <Button variant="primary" size="md" onPress={onAction}>
          {`Open step ${step}`}
        </Button>
      )}
    </View>
  );
}
