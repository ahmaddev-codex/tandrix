import type { Job } from "@tandrix/contracts";
import { radius, space, formatDateTime } from "@tandrix/ui";
import { Button, Icon, Text, useTheme, Notice } from "@tandrix/ui/native";
import { Link, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { exampleGoals } from "@/lib/goals";
import { useAuth } from "@/lib/auth";
import { isLocal } from "@/lib/env";

const statusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Stopped",
};

const when = formatDateTime;

export default function Jobs() {
  const t = useTheme();
  const { signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await api.listJobs());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload whenever the list comes back into view, e.g. after creating a job.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: space["space-1"] }}>
              {isLocal ? (
                <Link href="/gallery" asChild>
                  <Button variant="tertiary" size="md" accessibilityLabel="Design system">
                    Design
                  </Button>
                </Link>
              ) : null}
              <Link href="/pair" asChild>
                <Button
                  variant="tertiary"
                  size="md"
                  icon="laptop"
                  iconOnly
                  accessibilityLabel="Sign in a Mac"
                  testID="sign-in-mac"
                />
              </Link>
              <Button variant="tertiary" size="md" onPress={signOut} testID="sign-out">
                Sign out
              </Button>
            </View>
          ),
        }}
      />
      <FlatList
        data={jobs ?? []}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"], flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.color["text-secondary"]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: space["space-5"], marginBottom: space["space-2"] }}>
            {error ? (
              <Notice
                tone="error"
                action={
                  <Button variant="secondary" size="lg" onPress={load}>
                    Try again
                  </Button>
                }
              >
                {error}
              </Notice>
            ) : null}
            <View style={{ gap: space["space-3"] }}>
              <View style={{ gap: space["space-2"] }}>
                <Text variant="heading-24">What are you building or fixing?</Text>
                <Text variant="field-body" color="text-secondary">
                  Describe the job in a sentence. Add a photo or manual if you have one.
                </Text>
              </View>
              <Button
                variant="primary"
                block
                onPress={() => router.push("/new-job")}
                testID="new-job"
              >
                Start a project
              </Button>
              <View style={{ gap: space["space-2"] }}>
                <Text variant="label-12" color="text-tertiary">
                  Or try an example
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
                  {exampleGoals.map((goal) => (
                    <Button
                      key={goal}
                      variant="secondary"
                      size="md"
                      onPress={() => router.push({ pathname: "/new-job", params: { goal } })}
                    >
                      {goal}
                    </Button>
                  ))}
                </View>
              </View>
            </View>
            {jobs?.length ? (
              <Text variant="label-14" color="text-secondary">
                Your projects
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/job/[id]", params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${statusLabel[item.status]}`}
            style={({ pressed }) => ({
              padding: space["space-3"],
              borderRadius: radius["radius-md"],
              backgroundColor: pressed ? t.color["gray-100"] : t.color["background-100"],
              borderWidth: 1,
              borderColor: t.color.border,
              gap: space["space-1"],
            })}
          >
            <Text variant="label-14" numberOfLines={2}>
              {item.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
              <Icon
                name={
                  item.status === "completed"
                    ? "check"
                    : item.status === "stopped"
                      ? "stop"
                      : "progress"
                }
                color="text-secondary"
              />
              <Text variant="copy-13" color="text-secondary">
                {statusLabel[item.status]} · started {when(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
