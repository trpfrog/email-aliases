import { Button, Stack, Text, ThemeIcon } from "@mantine/core";

export function AliasEmptyState({
  searching,
  onCreate,
}: {
  searching: boolean;
  onCreate: () => void;
}) {
  return (
    <Stack align="center" gap="md" py={64} px="md">
      <ThemeIcon variant="light" size={48} radius="xl" aria-hidden="true">
        @
      </ThemeIcon>
      <Text size="sm" c="dimmed">
        {searching ? "一致するエイリアスはありません" : "エイリアスはまだありません"}
      </Text>
      {!searching && (
        <Button variant="subtle" onClick={onCreate}>
          ＋ 最初のエイリアスを追加
        </Button>
      )}
    </Stack>
  );
}
