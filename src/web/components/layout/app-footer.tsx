import { Group, Text } from "@mantine/core";
import { APP_NAME } from "../../../config";

export function AppFooter() {
  return (
    <Group component="footer" justify="space-between" gap="xs">
      <Text size="xs" c="dimmed">
        {APP_NAME}
      </Text>
      <Text size="xs" c="dimmed">
        受信許可リスト
      </Text>
    </Group>
  );
}
