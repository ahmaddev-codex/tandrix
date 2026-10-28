import { Button, Text } from "@tandrix/ui/native";
import { View } from "react-native";

export function PaginationControls({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Button variant="tertiary" size="md" disabled={page === 0} onPress={() => onChange(page - 1)}>
        Previous
      </Button>
      <Text variant="label-13" color="text-secondary">
        Page {page + 1} of {pageCount}
      </Text>
      <Button
        variant="tertiary"
        size="md"
        disabled={page >= pageCount - 1}
        onPress={() => onChange(page + 1)}
      >
        Next
      </Button>
    </View>
  );
}
