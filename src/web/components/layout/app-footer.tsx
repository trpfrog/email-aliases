import { Group, Text } from "@mantine/core";

export function AppFooter() {
  return (
    <Group component="footer" justify="space-between" gap="xs">
      <Text size="xs" c="dimmed">
        Email Aliases
      </Text>
      <Text size="xs" c="dimmed">
        受信許可リスト
      </Text>
    </Group>
  );
}
