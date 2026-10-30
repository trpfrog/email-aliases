import { Table, VisuallyHidden } from "@mantine/core";
import type { Alias } from "../../api/aliases";
import { AliasRow } from "./alias-row";

export function AliasTable({
  aliases,
  onDelete,
  saving,
  onSetDisabled,
  onEditNote,
}: {
  aliases: Alias[];
  onDelete: (alias: Alias) => void;
  saving: boolean;
  onSetDisabled: (address: string, disabled: boolean) => void;
  onEditNote: (alias: Alias) => void;
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
            <AliasRow
              key={alias.address}
              alias={alias}
              saving={saving}
              onDelete={onDelete}
              onSetDisabled={onSetDisabled}
              onEditNote={onEditNote}
            />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
