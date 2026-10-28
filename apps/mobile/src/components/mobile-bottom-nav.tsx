import { radius, space } from "@tandrix/ui";
import { Icon, Text, useTheme } from "@tandrix/ui/native";
import { router, usePathname } from "expo-router";
import { Pressable, View } from "react-native";

const items = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Actions", icon: "actions", href: "/actions" },
  { label: "Projects", icon: "projects", href: "/projects" },
  { label: "Settings", icon: "gear", href: "/settings" },
] as const;

export function MobileBottomNav() {
  const t = useTheme();
  const pathname = usePathname();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingTop: space["space-2"],
        paddingHorizontal: space["space-2"],
        borderTopWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color["background-100"],
      }}
    >
      {items.map((item) => {
        const selected = pathname === item.href || (item.href === "/" && pathname === "/");
        return (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            testID={`main-tab-${item.label.toLowerCase()}`}
            onPress={() => router.navigate(item.href)}
            style={({ pressed }) => ({
              minWidth: 68,
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              opacity: pressed ? 0.76 : 1,
            })}
          >
            <View
              style={{
                minWidth: 48,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius["radius-full"],
                backgroundColor: selected ? t.color["surface-paper"] : "transparent",
              }}
            >
              <Icon
                name={item.icon}
                size={20}
                color={selected ? "ink-on-paper" : "text-secondary"}
              />
            </View>
            <Text variant="label-12" color={selected ? "text" : "text-secondary"}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
