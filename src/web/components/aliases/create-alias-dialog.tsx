import type { SubmitEvent } from "react";
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DOMAIN } from "../../../config";

export function CreateAliasDialog({
  saving,
  error,
  onClose,
  onCreate,
}: {
  saving: boolean;
  error: string;
  onClose: () => void;
  onCreate: (address: string, note: string) => Promise<boolean>;
}) {
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const address = `${String(data.get("address")).trim()}@${DOMAIN}`;
    if (await onCreate(address, String(data.get("note")))) onClose();
  }
  return (
    <Modal
      opened
      onClose={onClose}
      title="エイリアスを追加"
      centered
      padding="xl"
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
      closeButtonProps={{ "aria-label": "閉じる" }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Stack gap="lg">
          <TextInput
            label="アドレス"
            name="address"
            placeholder="shopping"
            description="@ より前の部分を入力してください"
            rightSection={
              <Text size="sm" c="dimmed" pr="sm">
                @{DOMAIN}
              </Text>
            }
            rightSectionWidth={170}
            rightSectionPointerEvents="none"
            required
            maxLength={64}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            disabled={saving}
            data-autofocus
          />
          <Textarea
            label="メモ（任意）"
            name="note"
            placeholder="用途・サービス名"
            maxLength={1000}
            minRows={3}
            autosize
            disabled={saving}
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" disabled={saving} onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={saving}>
              追加
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
