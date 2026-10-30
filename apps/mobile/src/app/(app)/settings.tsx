import { radius, space } from "@tandrix/ui";
import { Button, Input, Notice, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Page, PageTitle, Row, Tray } from "@/components/kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePreferences, type ThemePreference } from "@/lib/preferences";

const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "sunlight", label: "Sunlight" },
];

export default function Settings() {
  const t = useTheme();
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
    <Page tabs>
      <Stack.Screen options={{ headerShown: false }} />
      <PageTitle title="Settings" lead="These apply to this phone." />
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Group title="Account">
        <Row
          icon="user"
          title="Signed in"
          detail={session?.user.email ?? undefined}
          trailing={
            <Button variant="danger" size="md" onPress={signOut} testID="settings-sign-out">
              Sign out
            </Button>
          }
        />
      </Group>

      <Group title="What Tandrix calls you">
        <View style={[card(t), { gap: space["space-3"] }]}>
          <Text variant="copy-13" color="text-secondary">
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
      </Group>

      <Group title="Your devices">
        <Row
          icon="laptop"
          title="Sign in a Mac"
          detail="Pick up a project there, and ask Tandrix about your screen."
          onPress={() => router.push("/pair")}
          testID="settings-pair-mac"
        />
      </Group>

      <Group title="Appearance">
        <View style={[card(t), { gap: space["space-3"] }]}>
          <View
            accessibilityRole="radiogroup"
            style={{
              flexDirection: "row",
              padding: 4,
              borderRadius: radius["radius-full"],
              backgroundColor: t.color["background-200"],
            }}
          >
            {themes.map((option) => {
              const on = theme === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={option.label}
                  onPress={() => void chooseTheme(option.value)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius["radius-full"],
                    backgroundColor: on ? t.color["surface-ink"] : "transparent",
                  }}
                >
                  <Text variant="label-13" color={on ? "ink-on-surface" : "text-secondary"}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="copy-13" color="text-secondary">
            {theme === "sunlight"
              ? "Sunlight mode uses stronger contrast outdoors."
              : "System follows your phone; Sunlight is for bright light outdoors."}
          </Text>
        </View>
      </Group>
    </Page>
  );
}

/** A titled tray of settings. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space["space-2"] }}>
      <Text variant="label-13" color="text-secondary" style={{ paddingHorizontal: space["space-1"] }}>
        {title}
      </Text>
      <Tray>{children}</Tray>
    </View>
  );
}

/** A white card inside a tray, for settings that need more than a row. */
const card = (t: ReturnType<typeof useTheme>) => ({
  padding: 14,
  borderRadius: 18,
  backgroundColor: t.color["background-100"],
});
