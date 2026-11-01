import { Button, Stack, Text, ThemeIcon } from "@mantine/core";

export function AliasEmptyState({
  filtered,
  onCreate,
}: {
  /** 登録はあるが、状態や検索語で絞り込んだ結果が空のとき true。 */
  filtered: boolean;
  onCreate: () => void;
}) {
  return (
    <Stack align="center" gap="md" py={64} px="md">
      <ThemeIcon variant="light" size={48} radius="xl" aria-hidden="true">
        @
      </ThemeIcon>
      <Text size="sm" c="dimmed">
        {filtered ? "一致するエイリアスはありません" : "エイリアスはまだありません"}
      </Text>
      {!filtered && (
        <Button variant="subtle" onClick={onCreate}>
          ＋ 最初のエイリアスを追加
        </Button>
      )}
    </Stack>
  );
}
