import {
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  ThemeIcon,
  VisuallyHidden,
} from "@mantine/core";
import type { ReceivedEmail } from "../../api/received";
import { RECEIVED_FILTER_LABELS, type ReceivedViewFilter } from "../../lib/received-display";
import { ErrorAlert } from "../feedback/error-alert";
import { ReceivedRow, type ReceivedActions } from "./received-row";

const FILTER_OPTIONS = Object.entries(RECEIVED_FILTER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function isViewFilter(value: string): value is ReceivedViewFilter {
  return Object.hasOwn(RECEIVED_FILTER_LABELS, value);
}

export function ReceivedHistory({
  filter,
  onFilterChange,
  emails,
  registered,
  loading,
  busy,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
  onClear,
  actions,
}: {
  filter: ReceivedViewFilter;
  onFilterChange: (filter: ReceivedViewFilter) => void;
  emails: ReceivedEmail[];
  /** 登録済みのエイリアスのアドレス（小文字）。 */
  registered: ReadonlySet<string>;
  loading: boolean;
  busy: boolean;
  error: string;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  onClear: () => void;
  actions: ReceivedActions;
}) {
  const actionsDisabled = loading || busy;

  return (
    <Paper component="section" withBorder shadow="xs" aria-label="受信履歴">
      <Group p="md">
        <SegmentedControl
          aria-label="受信の結果"
          value={filter}
          onChange={(value) => {
            if (isViewFilter(value)) onFilterChange(value);
          }}
          data={FILTER_OPTIONS}
        />
        <Group gap="xs" ml="auto">
          <Button
            variant="subtle"
            color="red"
            onClick={onClear}
            disabled={actionsDisabled || emails.length === 0}
          >
            表示中の履歴を削除
          </Button>
          <Button
            variant="subtle"
            color="gray"
            onClick={onRefresh}
            disabled={actionsDisabled}
            aria-label="履歴を更新"
          >
            更新
          </Button>
        </Group>
      </Group>
      <Divider />
      <ErrorAlert message={error} m="md" />
      <Table.ScrollContainer minWidth={560} type="native">
        <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th>受信日時</Table.Th>
              <Table.Th>宛先</Table.Th>
              <Table.Th>送信元</Table.Th>
              <Table.Th visibleFrom="sm">サイズ</Table.Th>
              <Table.Th>
                <VisuallyHidden>操作</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {emails.map((email) => (
              <ReceivedRow
                key={email.id}
                email={email}
                registered={registered.has(email.recipient.toLowerCase())}
                busy={actionsDisabled}
                actions={actions}
              />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {loading ? (
        <Center py={48} role="status" aria-label="読み込み中">
          <Loader size="sm" />
        </Center>
      ) : (
        emails.length === 0 && (
          <Stack align="center" gap="md" py={64} px="md">
            <ThemeIcon variant="light" size={48} radius="xl" aria-hidden="true">
              @
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              該当する受信履歴はありません
            </Text>
          </Stack>
        )
      )}
      {hasMore && !loading && (
        <Center p="md">
          <Button variant="default" onClick={onLoadMore} disabled={busy}>
            さらに読み込む
          </Button>
        </Center>
      )}
      <Divider />
      <Group justify="space-between" p="md" gap="xs">
        <Text size="xs" c="dimmed">
          {loading ? "—" : `${emails.length} 件${hasMore ? "以上" : ""}`}
        </Text>
        <Text size="xs" c="dimmed">
          180 日分を保存します。未登録の宛先は大量に届くと記録しません
        </Text>
      </Group>
    </Paper>
  );
}
