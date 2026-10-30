import { Button, Table, Text } from "@mantine/core";
import { DOMAIN } from "../../../config";
import type { Alias } from "../../api/aliases";

export function AliasRow({ alias, onDelete }: { alias: Alias; onDelete: (alias: Alias) => void }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500}>
          {alias.address.split("@")[0]}
          <Text component="span" size="sm" c="dimmed" display={{ base: "block", sm: "inline" }}>
            @{DOMAIN}
          </Text>
        </Text>
      </Table.Td>
      <Table.Td maw={300}>
        <Text size="sm" c="dimmed" lineClamp={2} title={alias.note}>
          {alias.note || "—"}
        </Text>
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
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          aria-label={`${alias.address} を削除`}
          onClick={() => onDelete(alias)}
        >
          削除
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}
