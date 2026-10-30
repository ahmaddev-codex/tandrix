import type { Job } from "@tandrix/contracts";
import { formatDateTime, space } from "@tandrix/ui";
import { Icon, Text, useTheme } from "@tandrix/ui/native";
import { Pressable, View } from "react-native";
import { IconSquare, Row } from "@/components/kit";
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
  // The light tile wears the Tandrix blue, as on the website; the other is ink.
  const backgroundColor = t.color[lightTile ? "highlight" : "surface-ink"];
  const primaryInk = lightTile ? "on-blue" : "ink-on-surface";
  const secondaryInk = lightTile ? "on-blue" : "ink-on-surface-secondary";
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
        borderRadius: 24,
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
        <Text
          variant="heading-32"
          color={primaryInk}
          style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.8 }}
        >
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
  const stepTitle = action.title.replace(/^(Start|Continue|Review|Resolve):\s*/, "");
  return (
    <Row
      title={stepTitle}
      detail={`${action.job.title}${action.stepNumber && action.stepCount ? `  ·  Step ${action.stepNumber} of ${action.stepCount}` : ""}`}
      leading={
        <IconSquare name={featured ? "actions" : "progress"} tone={featured ? "blue" : "quiet"} />
      }
      onPress={onPress}
      accessibilityLabel={`${action.title} for ${action.job.title}${action.stepNumber && action.stepCount ? `, step ${action.stepNumber} of ${action.stepCount}` : ""}`}
    />
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
  const statusIcon =
    job.status === "completed" ? "check" : job.status === "stopped" ? "stop" : "progress";
  return (
    <Row
      title={job.title}
      detail={`${statusLabel[job.status]} · Updated ${formatDateTime(job.updatedAt)}`}
      leading={
        <IconSquare name={statusIcon} tone={job.status === "completed" ? "blue" : "quiet"} />
      }
      onPress={onPress}
      accessibilityLabel={`${job.title}, ${statusLabel[job.status]}`}
    />
  );
}
