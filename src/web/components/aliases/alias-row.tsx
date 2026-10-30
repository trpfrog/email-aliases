import { Anchor, Badge, Button, Menu, Table, Text } from "@mantine/core";
import type { Alias } from "../../api/aliases";

export function AliasRow({
  alias,
  saving,
  onDelete,
  onSetDisabled,
  onEditDetails,
}: {
  alias: Alias;
  saving: boolean;
  onDelete: (alias: Alias) => void;
  onSetDisabled: (address: string, disabled: boolean) => void;
  onEditDetails: (alias: Alias) => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500}>
          {alias.address.split("@")[0]}
          <Text component="span" size="sm" c="dimmed" display={{ base: "block", sm: "inline" }}>
            @{alias.address.split("@")[1]}
          </Text>
        </Text>
        {alias.disabled_at !== null && (
          <Badge color="gray" variant="light" size="xs" mt={4}>
            無効
          </Badge>
        )}
      </Table.Td>
      <Table.Td maw={300}>
        <Text size="sm" c="dimmed" lineClamp={2} title={alias.note}>
          {alias.note || "—"}
        </Text>
        {alias.service_url && (
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
            {new URL(alias.service_url).hostname} ↗
          </Anchor>
        )}
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text component="time" dateTime={alias.created_at} size="xs" c="dimmed" textWrap="nowrap">
          {new Date(alias.created_at).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              disabled={saving}
              aria-label={`${alias.address} の操作`}
            >
              操作
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onEditDetails(alias)}>登録情報を編集</Menu.Item>
            <Menu.Item onClick={() => onSetDisabled(alias.address, alias.disabled_at === null)}>
              {alias.disabled_at !== null ? "有効化" : "無効化"}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => onDelete(alias)}>
              削除
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}
