import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { DOMAIN } from "../../../config";

export function AliasPageHeading({
  loading,
  count,
  onCreate,
}: {
  loading: boolean;
  count: number;
  onCreate: () => void;
}) {
  return (
    <Group justify="space-between" align="flex-end">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {DOMAIN}
        </Text>
        <Group gap="sm">
          <Title order={1} size="h2">
            エイリアス
          </Title>
          <Badge variant="light" size="lg">
            {loading ? "—" : count}
          </Badge>
        </Group>
      </Stack>
      <Button leftSection={<span aria-hidden="true">＋</span>} onClick={onCreate}>
        追加
      </Button>
    </Group>
  );
}
