// The header's back button: a light grey pill with dark text, as on the website's quiet buttons.
import { radius, space } from "@tandrix/ui";
import { Icon, Text, useTheme } from "@tandrix/ui/native";
import { router } from "expo-router";
import { Pressable } from "react-native";

export function BackPill({ label = "Back" }: { label?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="header-back"
      hitSlop={8}
      onPress={() => router.back()}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        height: 34,
        paddingLeft: space["space-2"],
        paddingRight: space["space-3"],
        borderRadius: radius["radius-full"],
        backgroundColor: t.color["gray-100"],
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="chevronLeft" size={16} color="text" />
      <Text variant="label-14" color="text">
        {label}
      </Text>
    </Pressable>
  );
}
