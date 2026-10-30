// The tab bar: a compact pill of frosted glass floating over the page, centred, with the selected
// tab in a soft grey pill. Rendered once by the app layout, so it stays put while the tab screens
// change underneath it.
import { radius, space } from "@tandrix/ui";
import { Icon, Text, useTheme } from "@tandrix/ui/native";
import { BlurView } from "expo-blur";
import { router, usePathname } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const items = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Actions", icon: "actions", href: "/actions" },
  { label: "Projects", icon: "projects", href: "/projects" },
  { label: "Settings", icon: "gear", href: "/settings" },
] as const;

/** The routes the bar shows on. */
export const TAB_ROUTES: readonly string[] = items.map((i) => i.href);

/** Room a tab screen leaves at the bottom so its last row clears the bar. */
export const TAB_BAR_SPACE = 112;

export function MobileBottomNav() {
  const t = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const dark = t.name === "dark";

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom - 6, space["space-3"]),
        alignItems: "center",
      }}
    >
      <BlurView
        intensity={60}
        tint={dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 5,
          gap: 2,
          borderRadius: radius["radius-full"],
          overflow: "hidden",
          borderWidth: 1,
          borderColor: t.color.border,
          boxShadow: t.shadow["shadow-md"],
        }}
      >
        {items.map((item) => {
          const selected = pathname === item.href;
          return (
            <Pressable
              key={item.href}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              testID={`main-tab-${item.label.toLowerCase()}`}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => ({
                minWidth: 76,
                paddingVertical: 7,
                paddingHorizontal: space["space-3"],
                alignItems: "center",
                gap: 2,
                borderRadius: radius["radius-full"],
                backgroundColor: selected ? t.color["gray-200"] : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name={item.icon} size={24} color={selected ? "highlight" : "text"} />
              <Text variant="label-12" color="text">
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}
