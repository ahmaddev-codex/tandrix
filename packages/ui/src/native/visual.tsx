// Native Tabs and StepVisual (design system components of the same names): switching between views,
// and the pictures that go with a step (the user's reference, the manual page, the latest photo).
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { radius, size as sizes, space } from "../generated/tokens";
import type { SourceKind } from "../shared";
import { Icon, SourceChip, Text } from "./components";
import { useTheme } from "./theme";

// ---- Tabs ----

export interface TabsItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabsItem[];
  value?: string;
  defaultValue?: string;
  /** Names the tab list for screen readers. */
  label?: string;
  /** md 40, or field 48 for the phone in use. */
  size?: "md" | "field";
  onChange?: (id: string) => void;
  testID?: string;
}

/** Text tabs with a 2px gray-1000 underline on the selected one. */
export function Tabs({
  items,
  value,
  defaultValue,
  label,
  size = "field",
  onChange,
  testID,
}: TabsProps) {
  const t = useTheme();
  const [own, setOwn] = useState(defaultValue ?? items[0]?.id);
  const selected = value ?? own;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: t.color.border }}
      contentContainerStyle={{ gap: space["space-4"] }}
    >
      {items.map((it) => {
        const on = it.id === selected;
        return (
          <Pressable
            key={it.id}
            testID={testID ? `${testID}-${it.id}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (it.id !== selected) {
                if (value === undefined) setOwn(it.id);
                onChange?.(it.id);
              }
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space["space-2"],
              height: size === "field" ? sizes["control-lg"] : sizes["control-md"],
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: on ? t.color["gray-1000"] : "transparent",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="label-14" color={on ? "text" : "text-secondary"}>
              {it.label}
            </Text>
            {it.count != null ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  borderRadius: radius["radius-full"],
                  backgroundColor: on ? t.color["gray-200"] : t.color["gray-100"],
                  justifyContent: "center",
                }}
              >
                <Text
                  variant="label-12"
                  color={on ? "text" : "text-secondary"}
                  style={{ textAlign: "center" }}
                >
                  {String(it.count)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---- StepVisual ----

export interface StepVisualItem {
  id: string;
  /** Short tab label: "Your reference", "Manual p.4", "Last photo". */
  label: string;
  /** The SourceChip under the picture: "Manual p.4, fig. 2", "Your reference 10:46". */
  source: string;
  sourceKind: SourceKind;
  /** Width over height, so the frame has its size before the picture loads. */
  aspectRatio?: number;
  /** The picture, filling the frame and fitted inside it (contain). */
  image: ReactNode;
  /** What the picture shows, for screen readers. */
  alt: string;
}

export interface StepVisualProps {
  items: StepVisualItem[];
  value?: string;
  onChange?: (id: string) => void;
  /** Opens the picture full screen to zoom into; the frame shows the whole picture. */
  onOpen?: (id: string) => void;
  testID?: string;
}

/** Frames taller than this would push the instruction off screen; open the picture to zoom. */
export const STEP_VISUAL_MAX_HEIGHT = 280;

export function StepVisual({ items, value, onChange, onOpen, testID }: StepVisualProps) {
  const t = useTheme();
  const [own, setOwn] = useState(items[0]?.id);
  // The frame spans the card; its height follows the picture, up to the cap.
  const [width, setWidth] = useState(0);
  const selectedId = value ?? own;
  const item = items.find((i) => i.id === selectedId) ?? items[0];
  if (!item) return null;
  const height = width
    ? Math.min(width / (item.aspectRatio ?? 4 / 3), STEP_VISUAL_MAX_HEIGHT)
    : STEP_VISUAL_MAX_HEIGHT;
  return (
    <View testID={testID} style={{ gap: space["space-2"] }}>
      {items.length > 1 ? (
        <Tabs
          testID={testID ? `${testID}-tabs` : undefined}
          label="Pictures for this step"
          size="md"
          items={items.map((i) => ({ id: i.id, label: i.label }))}
          value={item.id}
          onChange={(id) => {
            if (value === undefined) setOwn(id);
            onChange?.(id);
          }}
        />
      ) : null}
      <Pressable
        testID={testID ? `${testID}-frame` : undefined}
        disabled={!onOpen}
        onPress={() => onOpen?.(item.id)}
        accessibilityRole={onOpen ? "imagebutton" : "image"}
        accessibilityLabel={item.alt}
        accessibilityHint={onOpen ? "Opens it full screen to zoom in" : undefined}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          width: "100%",
          height,
          borderRadius: radius["radius-md"],
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color["gray-100"],
          overflow: "hidden",
        }}
      >
        {item.image}
        {onOpen ? (
          <View
            style={{
              position: "absolute",
              top: space["space-2"],
              right: space["space-2"],
              width: 32,
              height: 32,
              borderRadius: radius["radius-full"],
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.color["background-100"],
              boxShadow: t.shadow["shadow-sm"],
            }}
          >
            <Icon name="expand" color="text" />
          </View>
        ) : null}
      </Pressable>
      <SourceChip kind={item.sourceKind}>{item.source}</SourceChip>
    </View>
  );
}
