import { Alert, Button, Group, Modal, Paper, Stack, Text } from "@mantine/core";
import type { Alias } from "../../api/aliases";

export function DeleteAliasDialog({
  alias,
  saving,
  error,
  onClose,
  onDelete,
}: {
  alias: Alias;
  saving: boolean;
  error: string;
  onClose: () => void;
  onDelete: (address: string) => Promise<boolean>;
}) {
  async function remove() {
    if (await onDelete(alias.address)) onClose();
  }
  return (
    <Modal
      opened
      onClose={onClose}
      title="エイリアスを削除"
      centered
      padding="xl"
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
      closeButtonProps={{ "aria-label": "閉じる" }}
    >
      <Stack gap="lg">
        <Paper withBorder p="md" bg="gray.0">
          <Text size="sm" textWrap="wrap">
            {alias.address}
          </Text>
        </Paper>
        <Text size="sm" c="dimmed">
          登録情報とメモを完全に削除します。削除後、この宛先へのメールは転送されません。
          情報を残して転送を止めたい場合は、無効化してください。
        </Text>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" disabled={saving} onClick={onClose} data-autofocus>
            キャンセル
          </Button>
          <Button color="red" loading={saving} onClick={() => void remove()}>
            削除
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
