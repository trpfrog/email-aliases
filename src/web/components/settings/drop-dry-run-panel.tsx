import { Group, Paper, Stack, Switch, Text } from "@mantine/core";
import type { Settings } from "../../api/settings";
import { formatDateTime } from "../../lib/received-display";
import { ErrorAlert } from "../feedback/error-alert";

/** 移行期間用のドライランの切り替え。有効な間は目立つ色で表示する。 */
export function DropDryRunPanel({
  settings,
  error,
  busy,
  onChange,
}: {
  settings: Settings | undefined;
  error: string;
  busy: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const since = settings?.drop_dry_run_since ?? null;
  const enabled = since !== null;

  return (
    <Paper
      component="section"
      withBorder
      p="md"
      bg={enabled ? "yellow.0" : undefined}
      aria-label="drop のドライラン"
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {enabled ? `ドライラン中（${formatDateTime(since)} から）` : "drop のドライラン"}
          </Text>
          <Text size="xs" c="dimmed">
            {enabled
              ? "無効・未登録の宛先へのメールも drop せずに転送しています。受信履歴の「ドロップ」で、本来 drop されるメールを確認できます"
              : "有効にすると、無効・未登録の宛先へのメールも転送し、受信履歴に本来の判定を残します。移行期間の確認に使います"}
          </Text>
        </Stack>
        <Switch
          checked={enabled}
          disabled={settings === undefined || busy}
          onChange={(event) => onChange(event.currentTarget.checked)}
          aria-label="drop のドライラン"
          color="yellow"
        />
      </Group>
      <ErrorAlert message={error} mt="sm" />
    </Paper>
  );
}
