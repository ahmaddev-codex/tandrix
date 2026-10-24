import type { Job } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { Button, Icon, Text, useTheme } from "@tandrix/ui/native";
import { Link, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isLocal } from "@/lib/env";

const statusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Stopped",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      if (e instanceof ApiError && e.status === 401) return signOut();
      setError((e as Error).message);
    }
  }, [signOut]);

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
          error ? (
            <View
              style={{
                padding: space["space-4"],
                borderRadius: radius["radius-lg"],
                backgroundColor: t.color["red-100"],
                gap: space["space-3"],
              }}
            >
              <Text variant="copy-16" color="red-900">
                {error}
              </Text>
              <Button variant="secondary" size="lg" onPress={load}>
                Try again
              </Button>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          jobs && !error ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                gap: space["space-3"],
                padding: space["space-6"],
              }}
            >
              <Text variant="heading-24">No jobs yet</Text>
              <Text variant="field-body" color="text-secondary">
                Start a job when you're at the equipment. Tandrix keeps it in step across your
                phone, glasses and Mac.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/job/[id]", params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${statusLabel[item.status]}`}
            style={({ pressed }) => ({
              padding: space["space-4"],
              borderRadius: radius["radius-lg"],
              backgroundColor: pressed ? t.color["gray-100"] : t.color["background-100"],
              borderWidth: 1,
              borderColor: t.color.border,
              gap: space["space-2"],
            })}
          >
            <Text variant="heading-20" numberOfLines={2}>
              {item.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
              <Icon
                name={item.status === "completed" ? "check" : "progress"}
                color="text-secondary"
              />
              <Text variant="copy-14" color="text-secondary">
                {statusLabel[item.status]}, started {when(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <View
        style={{
          padding: space["space-4"],
          borderTopWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color["background-100"],
        }}
      >
        <Button variant="primary" block onPress={() => router.push("/new-job")} testID="new-job">
          New job
        </Button>
      </View>
    </SafeAreaView>
  );
}
