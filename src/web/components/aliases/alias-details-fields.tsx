import { Textarea, TextInput } from "@mantine/core";

export const DETAILS_FIELD = { serviceUrl: "service_url", note: "note" } as const;

/** 追加・編集ダイアログで共通の、サービス URL とメモの入力欄。 */
export function AliasDetailsFields({
  defaults,
  disabled,
  autoFocus = false,
}: {
  defaults?: { note: string; service_url: string };
  disabled: boolean;
  autoFocus?: boolean;
}) {
  return (
    <>
      <TextInput
        label="サービス URL（任意）"
        name={DETAILS_FIELD.serviceUrl}
        type="url"
        defaultValue={defaults?.service_url}
        placeholder="https://example.com/settings"
        maxLength={2048}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        data-autofocus={autoFocus || undefined}
      />
      <Textarea
        label="メモ（任意）"
        name={DETAILS_FIELD.note}
        defaultValue={defaults?.note}
        placeholder="用途・サービス名"
        maxLength={1000}
        minRows={3}
        autosize
        disabled={disabled}
      />
    </>
  );
}
