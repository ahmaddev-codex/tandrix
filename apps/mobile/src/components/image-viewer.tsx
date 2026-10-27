// A step picture full screen: pinch or double-tap to zoom into a manual figure or a photo.
import { space } from "@tandrix/ui";
import { Icon, SourceChip, Text, useTheme } from "@tandrix/ui/native";
import type { SourceKind } from "@tandrix/ui";
import { Image } from "expo-image";
import { useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ViewedImage {
  url: string;
  alt: string;
  source: string;
  sourceKind: SourceKind;
}

export function ImageViewer({ image, onClose }: { image?: ViewedImage; onClose: () => void }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  // A Modal has no safe-area provider of its own; the screen's insets still apply.
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const lastTap = useRef(0);
  const zoomed = useRef(false);

  // Double-tap toggles between the whole picture and 2.5× around the tap.
  const onTap = (x: number, y: number) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const z = zoomed.current ? 1 : 2.5;
      const w = width / z;
      const h = height / z;
      scroll.current?.scrollResponderZoomTo({ x: x - w / 2, y: y - h / 2, width: w, height: h });
      zoomed.current = !zoomed.current;
    }
    lastTap.current = now;
  };

  return (
    <Modal
      visible={!!image}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View testID="image-viewer" style={{ flex: 1, backgroundColor: t.color["overlay-ground"] }}>
        {image ? (
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ width, height }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={{ width, height }}
              onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              accessibilityRole="image"
              accessibilityLabel={image.alt}
            >
              <Image
                source={{ uri: image.url }}
                style={{ width, height }}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          </ScrollView>
        ) : null}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            inset: 0,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            justifyContent: "space-between",
          }}
        >
          <View
            pointerEvents="box-none"
            style={{ flexDirection: "row", justifyContent: "flex-end", padding: space["space-4"] }}
          >
            <Pressable
              testID="close-image"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.color["overlay-raised"],
              }}
            >
              <Icon name="x" size={20} color="overlay-ink" />
            </Pressable>
          </View>
          {image ? (
            <View
              pointerEvents="none"
              style={{ padding: space["space-4"], gap: space["space-2"], alignItems: "flex-start" }}
            >
              <SourceChip kind={image.sourceKind}>{image.source}</SourceChip>
              <Text variant="copy-13" color="overlay-ink">
                Pinch or double-tap to zoom
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
