import type { Asset, EvidenceWithUrl, Job, Manual } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { Button, Icon, SourceChip, Text, useTheme } from "@tandrix/ui/native";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";

const COLUMNS = 3;

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<Job>();
  const [asset, setAsset] = useState<Asset | null>();
  const [manual, setManual] = useState<Manual | null>(null);
  const [opening, setOpening] = useState(false);
  const [photos, setPhotos] = useState<EvidenceWithUrl[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, items] = await Promise.all([api.getJob(id), api.listEvidence(id)]);
      setJob(detail.job);
      setAsset(detail.asset);
      setManual(detail.manual);
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

  const openManual = async (m: Manual) => {
    setOpening(true);
    try {
      await Linking.openURL(await api.manualUrl(id, m.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  };

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
            {asset === undefined ? null : asset ? (
              <View
                testID="asset-card"
                accessibilityLabel={`Equipment: ${asset.make} ${asset.model}`}
                style={{
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["background-100"],
                  borderWidth: 1,
                  borderColor: t.color.border,
                  gap: space["space-1"],
                }}
              >
                <Text variant="label-14" color="text-secondary">
                  Equipment
                </Text>
                <Text variant="heading-20">
                  {asset.make} {asset.model}
                </Text>
                {asset.serial ? (
                  <Text variant="mono-14" color="text-secondary">
                    Serial {asset.serial}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View
                style={{
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["blue-100"],
                  gap: space["space-3"],
                }}
              >
                <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}>
                  <Icon name="camera" size={20} color="blue-900" />
                  <Text variant="heading-20" color="blue-900">
                    Identify the equipment
                  </Text>
                </View>
                <Text variant="copy-16" color="text">
                  Photograph the nameplate. Tandrix reads the make and model and uses them to find
                  the manual.
                </Text>
                <Button
                  variant="primary"
                  block
                  onPress={() =>
                    router.push({
                      pathname: "/job/[id]/capture",
                      params: { id, purpose: "nameplate" },
                    })
                  }
                  testID="photograph-nameplate"
                >
                  Photograph the nameplate
                </Button>
              </View>
            )}
            {asset && manual ? (
              <View
                testID="manual-card"
                style={{
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["background-100"],
                  borderWidth: 1,
                  borderColor: t.color.border,
                  gap: space["space-3"],
                }}
              >
                <View style={{ gap: space["space-1"] }}>
                  <Text variant="label-14" color="text-secondary">
                    Manual
                  </Text>
                  <Text variant="heading-16">{manual.title}</Text>
                  <Text variant="copy-14" color="text-secondary">
                    {manual.pageCount} {manual.pageCount === 1 ? "page" : "pages"}
                  </Text>
                </View>
                <SourceChip kind="manual">
                  {manual.sourceUrl
                    ? new URL(manual.sourceUrl).hostname.replace(/^www\./, "")
                    : "Your copy"}
                </SourceChip>
                <Button
                  variant="secondary"
                  block
                  icon="book"
                  disabled={opening}
                  onPress={() => openManual(manual)}
                  testID="open-manual"
                >
                  Open manual
                </Button>
              </View>
            ) : asset ? (
              <View
                style={{
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["blue-100"],
                  gap: space["space-3"],
                }}
              >
                <View style={{ flexDirection: "row", gap: space["space-2"], alignItems: "center" }}>
                  <Icon name="book" size={20} color="blue-900" />
                  <Text variant="heading-20" color="blue-900">
                    Add the manual
                  </Text>
                </View>
                <Text variant="copy-16" color="text">
                  Tandrix builds the steps from the manufacturer's manual, so every step cites a
                  page.
                </Text>
                <Button
                  variant="primary"
                  block
                  onPress={() =>
                    router.push({
                      pathname: "/job/[id]/manual",
                      params: { id, equipment: `${asset.make} ${asset.model}` },
                    })
                  }
                  testID="find-manual"
                >
                  Find the manual
                </Button>
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
                Photos you take for this job appear here.
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
