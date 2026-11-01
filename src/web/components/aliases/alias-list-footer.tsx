import { Group, Text } from "@mantine/core";
import { MAIL_DOMAIN } from "../../../config";

export function AliasListFooter({ loading, count }: { loading: boolean; count: number }) {
  return (
    <Group justify="space-between" p="md" gap="xs">
      <Text size="xs" c="dimmed">
        {loading ? "—" : `${count} 件`}
      </Text>
      <Text size="xs" c="dimmed">
        {MAIL_DOMAIN}
      </Text>
    </Group>
  );
}
