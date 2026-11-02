import { Badge, Button, Menu, Table, Text } from "@mantine/core";
import type { ReceivedEmail } from "../../api/received";
import { splitAddress } from "../../lib/alias-display";
import { formatDateTime, formatSize, OUTCOME_BADGES } from "../../lib/received-display";

/** 履歴の各行から呼び出す操作。 */
export type ReceivedActions = {
  /** 未登録の宛先をエイリアスとして登録する。 */
  register: (email: ReceivedEmail) => void;
  remove: (email: ReceivedEmail) => void;
};

export function ReceivedRow({
  email,
  registered,
  busy,
  actions,
}: {
  email: ReceivedEmail;
  /** 受信後にエイリアスとして登録済みなら true。 */
  registered: boolean;
  busy: boolean;
  actions: ReceivedActions;
}) {
  const [local, domain] = splitAddress(email.recipient);
  const badge = OUTCOME_BADGES[email.outcome];
  const canRegister = email.outcome === "unknown" && !registered;

  return (
    <Table.Tr>
      <Table.Td>
        <Text component="time" dateTime={email.received_at} size="xs" c="dimmed" textWrap="nowrap">
          {formatDateTime(email.received_at)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} style={{ overflowWrap: "anywhere" }}>
          {local}
          <Text component="span" size="sm" c="dimmed" display={{ base: "block", sm: "inline" }}>
            {domain}
          </Text>
        </Text>
        <Badge color={badge.color} variant="light" size="xs" mt={4}>
          {badge.label}
        </Badge>
        {email.dry_run && (
          <Badge color="yellow" variant="outline" size="xs" mt={4} ml={4}>
            ドライランで転送
          </Badge>
        )}
        {email.outcome === "unknown" && registered && (
          <Badge color="teal" variant="outline" size="xs" mt={4} ml={4}>
            登録済み
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={260}>
        <Text size="sm" c="dimmed" lineClamp={1} title={email.sender}>
          {email.sender === "" ? "—" : email.sender}
        </Text>
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text size="xs" c="dimmed" textWrap="nowrap">
          {formatSize(email.size)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              disabled={busy}
              aria-label={`${formatDateTime(email.received_at)} の ${email.recipient} 宛ての履歴の操作`}
            >
              操作
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {canRegister && (
              <>
                <Menu.Item onClick={() => actions.register(email)}>エイリアスとして登録</Menu.Item>
                <Menu.Divider />
              </>
            )}
            <Menu.Item color="red" onClick={() => actions.remove(email)}>
              履歴から削除
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}
