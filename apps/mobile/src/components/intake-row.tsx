// One thing the user can add when starting a project: what it is for, what they've added
// (thumbnails they can remove) and one quiet Add button. Built from design system tokens and
// primitives; the screen's one primary action stays "Set up project".
import { radius, space } from "@tandrix/ui";
import type { IconName } from "@tandrix/ui";
import { Button, Icon, Text, useTheme } from "@tandrix/ui/native";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

export interface IntakeThumb {
  key: string;
  /** A photo's uri; omit for a file, which shows its name instead. */
  uri?: string;
  label: string;
}

export function IntakeRow({
  icon,
  title,
  body,
  thumbs = [],
  addLabel = "Add",
  canAdd = true,
  onAdd,
  onRemove,
  children,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  thumbs?: IntakeThumb[];
  addLabel?: string;
  canAdd?: boolean;
  onAdd?: () => void;
  onRemove?: (key: string) => void;
  /** In place of thumbnails, e.g. a text field. */
  children?: ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        gap: space["space-3"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: t.color["background-100"],
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: space["space-3"], alignItems: "flex-start" }}>
        <Icon name={icon} size={20} color="text-secondary" />
        <View style={{ flex: 1, gap: space["space-1"] }}>
          <Text variant="heading-16">{title}</Text>
          <Text variant="copy-14" color="text-secondary">
            {body}
          </Text>
        </View>
        {onAdd && canAdd ? (
          <Button
            variant="secondary"
            size="md"
            onPress={onAdd}
            testID={testID ? `${testID}-add` : undefined}
            accessibilityLabel={`${addLabel}: ${title}`}
          >
            {addLabel}
          </Button>
        ) : null}
      </View>
      {thumbs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: space["space-2"] }}>
            {thumbs.map((th) => (
              <View key={th.key}>
                {th.uri ? (
                  <Image
                    source={{ uri: th.uri }}
                    style={{ width: 64, height: 64, borderRadius: radius["radius-sm"] }}
                    contentFit="cover"
                    accessibilityLabel={th.label}
                  />
                ) : (
                  <View
                    style={{
                      height: 64,
                      maxWidth: 220,
                      paddingHorizontal: space["space-3"],
                      justifyContent: "center",
                      borderRadius: radius["radius-sm"],
                      backgroundColor: t.color["gray-100"],
                    }}
                  >
                    <Text variant="copy-13" numberOfLines={2}>
                      {th.label}
                    </Text>
                  </View>
                )}
                {onRemove ? (
                  <Pressable
                    onPress={() => onRemove(th.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${th.label}`}
                    hitSlop={10}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 24,
                      height: 24,
                      borderRadius: radius["radius-full"],
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: t.color["gray-1000"],
                    }}
                  >
                    <Icon name="x" size={16} color="background-100" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {children}
    </View>
  );
}
