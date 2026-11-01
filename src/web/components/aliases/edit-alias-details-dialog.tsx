import { Button, Group, Stack, Text } from "@mantine/core";
import type { SubmitEvent } from "react";
import type { Alias } from "../../api/aliases";
import type { AliasDetails } from "../../hooks/use-aliases";
import { useAsyncAction } from "../../hooks/use-async-action";
import { readText } from "../../lib/form";
import { ErrorAlert } from "../feedback/error-alert";
import { AliasDetailsFields, DETAILS_FIELD } from "./alias-details-fields";
import { AliasModal } from "./alias-modal";

export function EditAliasDetailsDialog({
  alias,
  onClose,
  onSave,
}: {
  alias: Alias;
  onClose: () => void;
  onSave: (details: AliasDetails) => Promise<void>;
}) {
  const action = useAsyncAction(onSave);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run({
      address: alias.address,
      note: readText(form, DETAILS_FIELD.note),
      service_url: readText(form, DETAILS_FIELD.serviceUrl),
    });
  }

  return (
    <AliasModal title="登録情報を編集" busy={action.pending} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <Stack gap="lg">
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>
            {alias.address}
          </Text>
          <AliasDetailsFields defaults={alias} disabled={action.pending} autoFocus />
          <ErrorAlert message={action.error} />
          <Group justify="flex-end">
            <Button variant="default" disabled={action.pending} onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={action.pending}>
              保存
            </Button>
          </Group>
        </Stack>
      </form>
    </AliasModal>
  );
}
