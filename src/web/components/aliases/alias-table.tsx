import { Table, VisuallyHidden } from "@mantine/core";
import type { Alias } from "../../api/aliases";
import { AliasRow, type AliasActions } from "./alias-row";

export function AliasTable({
  aliases,
  busy,
  actions,
}: {
  aliases: Alias[];
  busy: boolean;
  actions: AliasActions;
}) {
  return (
    <Table.ScrollContainer minWidth={480} type="native">
      <Table highlightOnHover horizontalSpacing="md" verticalSpacing="md">
        <Table.Thead bg="gray.0">
          <Table.Tr>
            <Table.Th>アドレス</Table.Th>
            <Table.Th>メモ</Table.Th>
            <Table.Th visibleFrom="sm">作成日</Table.Th>
            <Table.Th>
              <VisuallyHidden>操作</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {aliases.map((alias) => (
            <AliasRow key={alias.address} alias={alias} busy={busy} actions={actions} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
