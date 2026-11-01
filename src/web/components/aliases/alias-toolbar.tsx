import { Button, Group, SegmentedControl, TextInput } from "@mantine/core";
import type { AliasStatus } from "../../lib/alias-display";

const STATUS_OPTIONS = [
  { label: "有効", value: "enabled" },
  { label: "無効", value: "disabled" },
  { label: "すべて", value: "all" },
] as const satisfies readonly { label: string; value: AliasStatus }[];

export function AliasToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  refreshDisabled,
  onRefresh,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  status: AliasStatus;
  onStatusChange: (status: AliasStatus) => void;
  refreshDisabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <Group p="md">
      <SegmentedControl<AliasStatus>
        aria-label="エイリアスの状態"
        value={status}
        onChange={onStatusChange}
        data={[...STATUS_OPTIONS]}
      />
      <TextInput
        flex={1}
        maw={400}
        miw={0}
        type="search"
        aria-label="アドレス・メモ・URL を検索"
        placeholder="アドレス・メモ・URL を検索"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <Button
        variant="subtle"
        color="gray"
        onClick={onRefresh}
        disabled={refreshDisabled}
        aria-label="一覧を更新"
      >
        更新
      </Button>
    </Group>
  );
}
