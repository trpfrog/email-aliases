import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { SubmitEvent } from "react";
import { DOMAIN } from "../../../config";
import type { CreateAliasRequest } from "../../api/aliases";
import { useAsyncAction } from "../../hooks/use-async-action";
import { readText } from "../../lib/form";
import { ErrorAlert } from "../feedback/error-alert";
import { AliasDetailsFields, DETAILS_FIELD } from "./alias-details-fields";
import { AliasModal } from "./alias-modal";

export function CreateAliasDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateAliasRequest) => Promise<void>;
}) {
  const action = useAsyncAction(onCreate);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // UI では @ より前だけを入力し、ドメインを付けて送る。
    await action.run({
      address: `${readText(form, "address").trim()}@${DOMAIN}`,
      note: readText(form, DETAILS_FIELD.note),
      service_url: readText(form, DETAILS_FIELD.serviceUrl),
    });
  }

  return (
    <AliasModal title="エイリアスを追加" busy={action.pending} onClose={onClose}>
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
            disabled={action.pending}
            data-autofocus
          />
          <AliasDetailsFields disabled={action.pending} />
          <ErrorAlert message={action.error} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" disabled={action.pending} onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={action.pending}>
              追加
            </Button>
          </Group>
        </Stack>
      </form>
    </AliasModal>
  );
}
