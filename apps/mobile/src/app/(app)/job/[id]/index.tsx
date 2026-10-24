import type { EvidenceWithUrl, Job } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { Button, Text, useTheme } from "@tandrix/ui/native";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";

const COLUMNS = 3;

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<Job>();
  const [photos, setPhotos] = useState<EvidenceWithUrl[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, items] = await Promise.all([api.getJob(id), api.listEvidence(id)]);
      setJob(detail.job);
      setPhotos(items);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const gap = space["space-2"];
  const tile = (width - space["space-4"] * 2 - gap * (COLUMNS - 1)) / COLUMNS;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen options={{ title: job?.title ?? "Job" }} />
      <FlatList
        data={photos ?? []}
        keyExtractor={(p) => p.evidence.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: space["space-4"], gap, flexGrow: 1 }}
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
          <View style={{ gap: space["space-2"], marginBottom: space["space-2"] }}>
            {error ? (
              <View
                style={{
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["red-100"],
                }}
              >
                <Text variant="copy-16" color="red-900">
                  {error}
                </Text>
              </View>
            ) : null}
            <Text variant="label-16" color="text-secondary">
              {photos ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"}` : " "}
            </Text>
          </View>
        }
        ListEmptyComponent={
          photos && !error ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                gap: space["space-3"],
                padding: space["space-6"],
              }}
            >
              <Text variant="heading-24">No photos yet</Text>
              <Text variant="field-body" color="text-secondary">
                Start with the nameplate. Tandrix uses it to find the right manual.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url, cacheKey: item.evidence.id }}
            accessibilityLabel={`Photo taken ${new Date(item.evidence.capturedAt).toLocaleString()}`}
            testID="evidence-photo"
            contentFit="cover"
            style={{
              width: tile,
              height: tile,
              borderRadius: radius["radius-md"],
              backgroundColor: t.color["gray-200"],
            }}
          />
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
        <Button
          variant="primary"
          block
          icon="camera"
          onPress={() => router.push({ pathname: "/job/[id]/capture", params: { id } })}
          testID="take-photo"
        >
          Take photo
        </Button>
      </View>
    </SafeAreaView>
  );
}
