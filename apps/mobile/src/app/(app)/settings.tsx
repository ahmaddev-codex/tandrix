import { space } from "@tandrix/ui";
import { Button, Input, Notice, Text } from "@tandrix/ui/native";
import { Link, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
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
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState("");
  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        setName(p.displayName ?? "");
        setSavedName(p.displayName ?? "");
        setNameLoaded(true);
      })
      .catch(() => setNameLoaded(true));
  }, []);
  const chooseTheme = async (value: ThemePreference) => {
    try {
      await setTheme(value);
      setError(undefined);
    } catch {
      setError("Couldn't save that appearance setting. Try again.");
    }
  };
  const saveName = async () => {
    // An empty name clears it: Tandrix stops using one.
    const displayName = name.trim() || null;
    setSavingName(true);
    try {
      await api.updateProfile({ displayName });
      setSavedName(displayName ?? "");
      setError(undefined);
    } catch {
      setError("Couldn't save that name. Try again.");
    } finally {
      setSavingName(false);
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
          <Text variant="heading-18">What Tandrix calls you</Text>
          <Text variant="copy-14" color="text-secondary">
            First name is fine. Tandrix uses it rarely, so it feels personal.
          </Text>
          {nameLoaded ? (
            <>
              <Input
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                testID="settings-name"
              />
              <Button
                variant="secondary"
                block
                onPress={() => void saveName()}
                disabled={savingName || name.trim() === savedName}
                testID="settings-name-save"
              >
                {name.trim() || !savedName ? "Save name" : "Clear name"}
              </Button>
            </>
          ) : null}
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
