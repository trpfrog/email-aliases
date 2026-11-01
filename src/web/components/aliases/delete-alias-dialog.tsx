import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { Alias } from "../../api/aliases";
import { useAsyncAction } from "../../hooks/use-async-action";
import { ErrorAlert } from "../feedback/error-alert";
import { AliasModal } from "./alias-modal";

export function DeleteAliasDialog({
  alias,
  onClose,
  onDelete,
}: {
  alias: Alias;
  onClose: () => void;
  onDelete: (address: string) => Promise<void>;
}) {
  const action = useAsyncAction(onDelete);

  return (
    <AliasModal title="エイリアスを削除" busy={action.pending} onClose={onClose}>
      <Stack gap="lg">
        <Paper withBorder p="md" bg="gray.0">
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>
            {alias.address}
          </Text>
        </Paper>
        <Text size="sm" c="dimmed">
          登録情報とメモを完全に削除します。削除後、この宛先へのメールは転送されません。
          情報を残して転送を止めたい場合は、無効化してください。
        </Text>
        <ErrorAlert message={action.error} />
        <Group justify="flex-end">
          <Button variant="default" disabled={action.pending} onClick={onClose} data-autofocus>
            キャンセル
          </Button>
          <Button
            color="red"
            loading={action.pending}
            onClick={() => void action.run(alias.address)}
          >
            削除
          </Button>
        </Group>
      </Stack>
    </AliasModal>
  );
}
