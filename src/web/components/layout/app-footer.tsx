import { Group, Text } from "@mantine/core";
import { APP_NAME, APP_VERSION } from "../../../config";

export function AppFooter() {
  return (
    <Group component="footer" justify="space-between" gap="xs">
      <Text size="xs" c="dimmed">
        {APP_NAME} v{APP_VERSION}
      </Text>
      <Text size="xs" c="dimmed">
        受信許可リスト
      </Text>
    </Group>
  );
}
