import type { Job } from "@tandrix/contracts";
import { formatDateTime, radius, space } from "@tandrix/ui";
import { Icon, Text, useTheme } from "@tandrix/ui/native";
import { Pressable, View } from "react-native";
import type { HomeAction } from "@/lib/home";

const statusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Paused",
};

export function OverviewTile({
  title,
  value,
  detail,
  icon,
  tone,
  onPress,
}: {
  title: string;
  value: string;
  detail: string;
  icon: "actions" | "projects";
  tone: "light" | "dark";
  onPress: () => void;
}) {
  const t = useTheme();
  const lightTile = tone === "light";
  const backgroundColor = t.color[lightTile ? "surface-paper" : "surface-ink"];
  const primaryInk = lightTile ? "ink-on-paper" : "ink-on-surface";
  const secondaryInk = lightTile ? "ink-on-paper-secondary" : "ink-on-surface-secondary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}. ${detail}`}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 142,
        justifyContent: "space-between",
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor,
        borderWidth: !lightTile && t.name === "dark" ? 1 : 0,
        borderColor: t.color["gray-600"],
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label-13" color={primaryInk}>
          {title}
        </Text>
        <Icon name={icon} color={primaryInk} size={20} />
      </View>
      <View style={{ gap: space["space-1"] }}>
        <Text variant="heading-24" color={primaryInk}>
          {value}
        </Text>
        <Text variant="copy-12" color={secondaryInk} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

export function HomeActionRow({
  action,
  onPress,
  featured = false,
}: {
  action: HomeAction;
  onPress: () => void;
  separator?: boolean;
  featured?: boolean;
}) {
  const t = useTheme();
  const stepTitle = action.title.replace(/^(Start|Continue|Review|Resolve):\s*/, "");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action.title} for ${action.job.title}${action.stepNumber && action.stepCount ? `, step ${action.stepNumber} of ${action.stepCount}` : ""}`}
      accessibilityHint="Opens this action"
      style={({ pressed }) => ({
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: space["space-3"],
        padding: space["space-3"],
        borderRadius: radius["radius-lg"],
        backgroundColor: pressed ? t.color["gray-200"] : t.color["background-100"],
        borderWidth: 1,
        borderColor: t.color["gray-300"],
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius["radius-full"],
          backgroundColor: featured ? t.color["surface-paper"] : t.color["gray-300"],
        }}
      >
        <Icon
          name={featured ? "actions" : "progress"}
          color={featured ? "ink-on-paper" : "text-secondary"}
          size={20}
        />
      </View>
      <View style={{ flex: 1, gap: space["space-1"] }}>
        <Text variant="label-14" numberOfLines={1}>
          {stepTitle}
        </Text>
        <Text variant="copy-12" color="text-secondary" numberOfLines={1}>
          {action.job.title}
          {action.stepNumber && action.stepCount
            ? `  ·  Step ${action.stepNumber} of ${action.stepCount}`
            : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function ProjectRow({
  job,
  onPress,
}: {
  job: Job;
  onPress: () => void;
  separator?: boolean;
}) {
  const t = useTheme();
  const statusIcon =
    job.status === "completed" ? "check" : job.status === "stopped" ? "stop" : "progress";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${statusLabel[job.status]}`}
      accessibilityHint="Opens this project"
      style={({ pressed }) => ({
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: space["space-3"],
        padding: space["space-3"],
        borderRadius: radius["radius-lg"],
        backgroundColor: pressed ? t.color["gray-200"] : t.color["background-100"],
        borderWidth: 1,
        borderColor: t.color["gray-300"],
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius["radius-full"],
          backgroundColor: t.color["gray-300"],
        }}
      >
        <Icon name={statusIcon} color="text-secondary" size={20} />
      </View>
      <View style={{ flex: 1, gap: space["space-1"] }}>
        <Text variant="label-14" numberOfLines={2}>
          {job.title}
        </Text>
        <Text variant="copy-12" color="text-secondary">
          {statusLabel[job.status]} · Updated {formatDateTime(job.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
