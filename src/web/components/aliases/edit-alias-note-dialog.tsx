import type { SubmitEvent } from "react";
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import type { Alias } from "../../api/aliases";

export function EditAliasNoteDialog({
  alias,
  saving,
  error,
  onClose,
  onSave,
}: {
  alias: Alias;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (address: string, note: string) => Promise<boolean>;
}) {
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (await onSave(alias.address, String(data.get("note")))) onClose();
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title="メモを編集"
      centered
      padding="xl"
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
      closeButtonProps={{ "aria-label": "閉じる" }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Stack gap="lg">
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>
            {alias.address}
          </Text>
          <Textarea
            label="メモ"
            name="note"
            defaultValue={alias.note}
            placeholder="用途・サービス名"
            maxLength={1000}
            minRows={3}
            autosize
            disabled={saving}
            data-autofocus
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={saving}>
              保存
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
