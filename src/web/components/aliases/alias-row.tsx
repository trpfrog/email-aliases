import { Anchor, Badge, Button, Menu, Table, Text } from "@mantine/core";
import type { Alias } from "../../api/aliases";
import { hostnameOf, isDisabled, splitAddress } from "../../lib/alias-display";
import type { AliasActions } from "./alias-actions";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function AliasRow({
  alias,
  busy,
  actions,
}: {
  alias: Alias;
  busy: boolean;
  actions: AliasActions;
}) {
  const [local, domain] = splitAddress(alias.address);
  const disabled = isDisabled(alias);

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500}>
          {local}
          <Text component="span" size="sm" c="dimmed" display={{ base: "block", sm: "inline" }}>
            {domain}
          </Text>
        </Text>
        {disabled && (
          <Badge color="gray" variant="light" size="xs" mt={4}>
            無効
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={300}>
        <Text size="sm" c="dimmed" lineClamp={2} title={alias.note}>
          {alias.note === "" ? "—" : alias.note}
        </Text>
        {alias.service_url !== "" && (
          <Anchor
            href={alias.service_url}
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
            display="block"
            mt={4}
            lineClamp={1}
            title={alias.service_url}
          >
            {hostnameOf(alias.service_url)} ↗
          </Anchor>
        )}
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text component="time" dateTime={alias.created_at} size="xs" c="dimmed" textWrap="nowrap">
          {dateFormat.format(new Date(alias.created_at))}
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
              aria-label={`${alias.address} の操作`}
            >
              操作
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => actions.edit(alias)}>登録情報を編集</Menu.Item>
            <Menu.Item onClick={() => actions.toggleDisabled(alias)}>
              {disabled ? "有効化" : "無効化"}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => actions.remove(alias)}>
              削除
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}
