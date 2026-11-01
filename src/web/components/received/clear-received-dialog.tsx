import { Button, Group, Stack, Text } from "@mantine/core";
import { useAsyncAction } from "../../hooks/use-async-action";
import { RECEIVED_FILTER_LABELS, type ReceivedViewFilter } from "../../lib/received-display";
import { ErrorAlert } from "../feedback/error-alert";
import { AliasModal } from "../aliases/alias-modal";

export function ClearReceivedDialog({
  filter,
  onClose,
  onClear,
}: {
  filter: ReceivedViewFilter;
  onClose: () => void;
  onClear: () => Promise<void>;
}) {
  const action = useAsyncAction(onClear);
  const target =
    filter === "all" ? "すべての受信履歴" : `「${RECEIVED_FILTER_LABELS[filter]}」の受信履歴`;

  return (
    <AliasModal title="受信履歴を削除" busy={action.pending} onClose={onClose}>
      <Stack gap="lg">
        <Text size="sm">
          {target}
          を削除します。読み込んでいない古い履歴も含みます。この操作は取り消せません。
        </Text>
        <Text size="sm" c="dimmed">
          エイリアスの登録や、転送済みのメールには影響しません。
        </Text>
        <ErrorAlert message={action.error} />
        <Group justify="flex-end">
          <Button variant="default" disabled={action.pending} onClick={onClose} data-autofocus>
            キャンセル
          </Button>
          <Button color="red" loading={action.pending} onClick={() => void action.run()}>
            削除
          </Button>
        </Group>
      </Stack>
    </AliasModal>
  );
}
