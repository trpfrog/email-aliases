import { Button, Group, TextInput } from "@mantine/core";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  disabled: boolean;
  onRefresh: () => void;
};

export function AliasToolbar({ search, onSearch, disabled, onRefresh }: Props) {
  return (
    <Group p="md" wrap="nowrap">
      <TextInput
        flex={1}
        maw={400}
        miw={0}
        type="search"
        aria-label="アドレス・メモを検索"
        placeholder="アドレス・メモを検索"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <Button
        variant="subtle"
        color="gray"
        onClick={onRefresh}
        disabled={disabled}
        aria-label="一覧を更新"
      >
        更新
      </Button>
    </Group>
  );
}
