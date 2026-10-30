import { Button, Group, SegmentedControl, TextInput } from "@mantine/core";

export type AliasStatus = "enabled" | "disabled" | "all";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  disabled: boolean;
  onRefresh: () => void;
  status: AliasStatus;
  onStatusChange: (status: AliasStatus) => void;
};

export function AliasToolbar({
  search,
  onSearch,
  disabled,
  onRefresh,
  status,
  onStatusChange,
}: Props) {
  return (
    <Group p="md">
      <SegmentedControl<AliasStatus>
        aria-label="エイリアスの状態"
        value={status}
        onChange={onStatusChange}
        data={[
          { label: "有効", value: "enabled" },
          { label: "無効", value: "disabled" },
          { label: "すべて", value: "all" },
        ]}
      />
      <TextInput
        flex={1}
        maw={400}
        miw={0}
        type="search"
        aria-label="アドレス・メモ・URL を検索"
        placeholder="アドレス・メモ・URL を検索"
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
