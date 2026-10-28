import { space } from "@tandrix/ui";
import { Button, Notice, Text } from "@tandrix/ui/native";
import { Link, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { usePreferences, type ThemePreference } from "@/lib/preferences";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "sunlight", label: "Sunlight" },
];

export default function Settings() {
  const { session, signOut } = useAuth();
  const { theme, setTheme } = usePreferences();
  const [error, setError] = useState<string>();
  const chooseTheme = async (value: ThemePreference) => {
    try {
      await setTheme(value);
      setError(undefined);
    } catch {
      setError("Couldn't save that appearance setting. Try again.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: space["space-4"], gap: space["space-6"] }}>
        <Text variant="heading-24">Settings</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-18">Account</Text>
          <Text variant="copy-14" color="text-secondary">
            {session?.user.email ?? "Signed in"}
          </Text>
          <Button variant="danger" block onPress={signOut} testID="settings-sign-out">
            Sign out
          </Button>
        </View>

        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-18">Your devices</Text>
          <Text variant="copy-14" color="text-secondary">
            Sign in your Mac to pick up a project there.
          </Text>
          <Link href="/pair" asChild>
            <Button variant="secondary" block icon="laptop" testID="settings-pair-mac">
              Sign in a Mac
            </Button>
          </Link>
        </View>

        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-18">Appearance</Text>
          <Text variant="copy-14" color="text-secondary">
            Choose how Tandrix looks on this phone.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
            {themes.map((option) => (
              <Button
                key={option.value}
                variant={theme === option.value ? "primary" : "secondary"}
                size="md"
                accessibilityRole="radio"
                accessibilityState={{ checked: theme === option.value }}
                onPress={() => void chooseTheme(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </View>
          {theme === "sunlight" ? (
            <Text variant="copy-13" color="text-secondary">
              Sunlight mode uses stronger contrast outdoors.
            </Text>
          ) : null}
        </View>

        <Text variant="copy-13" color="text-tertiary">
          Tandrix settings apply to this phone.
        </Text>
      </ScrollView>
      <MobileBottomNav />
    </SafeAreaView>
  );
}
