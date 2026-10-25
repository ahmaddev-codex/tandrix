// ProgressState: a long wait that says what is happening, or why it stopped and how to retry.
import { ActivityIndicator, View } from "react-native";
import { space } from "../generated/tokens";
import { Notice } from "./cards";
import { Button, Text } from "./components";
import { useTheme } from "./theme";

export interface ProgressStateProps {
  /** What is happening now. Change it as time passes. */
  label: string;
  /** Set when the work stopped: why, in plain words. */
  failed?: string;
  retryLabel?: string;
  onRetry?: () => void;
  backLabel?: string;
  onBack?: () => void;
  testID?: string;
}

export function ProgressState({
  label,
  failed,
  retryLabel = "Try again",
  onRetry,
  backLabel,
  onBack,
  testID,
}: ProgressStateProps) {
  const t = useTheme();
  if (failed) {
    return (
      <View testID={testID} style={{ gap: space["space-3"] }}>
        <Notice icon="alert" testID={testID ? `${testID}-failed` : undefined}>
          {failed}
        </Notice>
        <Button
          variant="primary"
          block
          onPress={onRetry}
          testID={testID ? `${testID}-retry` : undefined}
        >
          {retryLabel}
        </Button>
        {backLabel ? (
          <Button variant="secondary" block onPress={onBack}>
            {backLabel}
          </Button>
        ) : null}
      </View>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ alignItems: "center", gap: space["space-3"], paddingVertical: space["space-8"] }}
    >
      <ActivityIndicator color={t.color["text-secondary"]} />
      <Text variant="field-body" color="text-secondary" style={{ textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}
